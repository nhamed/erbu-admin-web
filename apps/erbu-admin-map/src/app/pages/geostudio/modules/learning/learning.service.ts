import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  Observable,
  timer,
  switchMap,
  shareReplay,
  catchError,
  throwError,
  tap,
  finalize,
} from 'rxjs';
import { LearningModel, LearningModelStatus } from '@erbu-admin-web/shared/models';

// ---------- DTOs ----------

export interface TrainingHistoryEntry {
  id: string;
  modelId: string;
  modelName: string;
  version: string;
  action: 'Train' | 'Evaluate' | 'Approve' | 'Promote' | 'Rollback';
  status: 'Success' | 'Failed' | 'InProgress';
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  performedBy: string;
  metrics: Record<string, number>;
  errorMessage: string | null;
}

export interface ModelComparisonRow {
  metricName: string;
  unit: string;
  values: Record<string, number>; // modelId -> value
}

export interface ModelComparisonResult {
  modelIds: string[];
  modelNames: string[];
  rows: ModelComparisonRow[];
  generatedAt: string;
}

export interface TrainingChartPoint {
  date: string;
  modelName: string;
  accuracy: number;
  loss: number;
  epoch: number;
}

export interface LearningDashboard {
  models: LearningModel[];
  trainingHistory: TrainingHistoryEntry[];
  trainingChartData: TrainingChartPoint[];
  activeModelId: string | null;
}

// ---------- Service ----------

const REFRESH_INTERVAL_MS = 30_000;
const API_BASE = '/api/geo/learning';

@Injectable({ providedIn: 'root' })
export class LearningService {
  private readonly http = inject(HttpClient);

  // ---------- state signals ----------
  readonly models = signal<LearningModel[]>([]);
  readonly trainingHistory = signal<TrainingHistoryEntry[]>([]);
  readonly trainingChartData = signal<TrainingChartPoint[]>([]);
  readonly activeModelId = signal<string | null>(null);
  readonly selectedModel = signal<LearningModel | null>(null);
  readonly comparison = signal<ModelComparisonResult | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedStatus = signal<LearningModelStatus | null>(null);

  // ---------- computed ----------
  readonly filteredModels = computed(() => {
    const status = this.selectedStatus();
    if (!status) return this.models();
    return this.models().filter((m) => m.status === status);
  });

  readonly activeModel = computed(() => {
    const id = this.activeModelId();
    return this.models().find((m) => m.id === id) ?? null;
  });

  readonly modelsByStatus = computed(() => {
    const models = this.models();
    const counts: Record<string, number> = {};
    for (const m of models) {
      counts[m.status] = (counts[m.status] ?? 0) + 1;
    }
    return counts;
  });

  readonly trainedModels = computed(
    () => this.models().filter((m) => m.status === LearningModelStatus.Trained),
  );

  readonly evaluatedModels = computed(
    () => this.models().filter((m) => m.status === LearningModelStatus.Evaluated),
  );

  readonly approvedModels = computed(
    () => this.models().filter((m) => m.status === LearningModelStatus.Approved),
  );

  readonly recentHistory = computed(() =>
    this.trainingHistory().slice(0, 20),
  );

  // ---------- polling ----------
  readonly dashboard$: Observable<LearningDashboard> = timer(0, REFRESH_INTERVAL_MS).pipe(
    switchMap(() => this.http.get<LearningDashboard>(`${API_BASE}/dashboard`)),
    tap((d) => this.applyDashboard(d)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  // ---------- commands ----------
  loadDashboard(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http
      .get<LearningDashboard>(`${API_BASE}/dashboard`)
      .pipe(
        tap((d) => this.applyDashboard(d)),
        catchError((err) => {
          this.error.set('Failed to load learning dashboard.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  fetchModels(status?: LearningModelStatus): Observable<LearningModel[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);

    return this.http.get<LearningModel[]>(`${API_BASE}/models`, { params }).pipe(
      tap((models) => this.models.set(models)),
      catchError((err) => {
        this.error.set('Failed to load models.');
        return throwError(() => err);
      }),
    );
  }

  fetchModel(modelId: string): Observable<LearningModel> {
    return this.http.get<LearningModel>(`${API_BASE}/models/${modelId}`).pipe(
      tap((model) => this.selectedModel.set(model)),
      catchError((err) => {
        this.error.set('Failed to load model details.');
        return throwError(() => err);
      }),
    );
  }

  compareModels(modelIds: string[]): Observable<ModelComparisonResult> {
    return this.http
      .post<ModelComparisonResult>(`${API_BASE}/models/compare`, { modelIds })
      .pipe(
        tap((result) => this.comparison.set(result)),
        catchError((err) => {
          this.error.set('Failed to compare models.');
          return throwError(() => err);
        }),
      );
  }

  // -- lifecycle actions --
  trainModel(modelId: string): Observable<LearningModel> {
    return this.http.post<LearningModel>(`${API_BASE}/models/${modelId}/train`, {}).pipe(
      tap((model) => this.updateModelInList(model)),
      catchError((err) => {
        this.error.set('Failed to start training.');
        return throwError(() => err);
      }),
    );
  }

  approveModel(modelId: string): Observable<LearningModel> {
    return this.http.post<LearningModel>(`${API_BASE}/models/${modelId}/approve`, {}).pipe(
      tap((model) => this.updateModelInList(model)),
      catchError((err) => {
        this.error.set('Failed to approve model.');
        return throwError(() => err);
      }),
    );
  }

  promoteModel(modelId: string): Observable<LearningModel> {
    return this.http.post<LearningModel>(`${API_BASE}/models/${modelId}/promote`, {}).pipe(
      tap((model) => {
        this.updateModelInList(model);
        this.activeModelId.set(model.id);
      }),
      catchError((err) => {
        this.error.set('Failed to promote model.');
        return throwError(() => err);
      }),
    );
  }

  rollbackModel(modelId: string): Observable<LearningModel> {
    return this.http.post<LearningModel>(`${API_BASE}/models/${modelId}/rollback`, {}).pipe(
      tap((model) => this.updateModelInList(model)),
      catchError((err) => {
        this.error.set('Failed to rollback model.');
        return throwError(() => err);
      }),
    );
  }

  setStatusFilter(status: LearningModelStatus | null): void {
    this.selectedStatus.set(status);
  }

  clearError(): void {
    this.error.set(null);
  }

  // ---------- private ----------
  private applyDashboard(d: LearningDashboard): void {
    this.models.set(d.models);
    this.trainingHistory.set(d.trainingHistory);
    this.trainingChartData.set(d.trainingChartData);
    this.activeModelId.set(d.activeModelId);
    this.error.set(null);
  }

  private updateModelInList(updated: LearningModel): void {
    this.models.update((list) =>
      list.map((m) => (m.id === updated.id ? updated : m)),
    );
  }
}
