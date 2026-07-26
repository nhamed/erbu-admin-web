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
import {
  Experiment,
  ExperimentType,
  ExperimentStatus,
} from '@erbu-admin-web/shared/models';

// ---------- DTOs ----------

export interface ExperimentMetric {
  metricName: string;
  controlValue: number;
  treatmentValue: number;
  absoluteDelta: number;
  relativeDeltaPercent: number;
  pValue: number;
  confidenceLevel: number;
  isSignificant: boolean;
  sampleSizeControl: number;
  sampleSizeTreatment: number;
}

export interface ExperimentDetail {
  experiment: Experiment;
  metrics: ExperimentMetric[];
  timeline: ExperimentTimelineEntry[];
  dailyData: ExperimentDailyPoint[];
}

export interface ExperimentTimelineEntry {
  id: string;
  action: string;
  performedBy: string;
  performedAt: string;
  description: string;
}

export interface ExperimentDailyPoint {
  date: string;
  controlMetricValue: number;
  treatmentMetricValue: number;
  cumulativeSignificance: number;
  sampleSize: number;
}

export interface TrafficSplitConfig {
  experimentId: string;
  controlPercent: number;
  treatmentPercent: number;
  updatedAt: string;
  updatedBy: string;
}

export interface ExperimentsDashboard {
  experiments: Experiment[];
  runningCount: number;
  completedCount: number;
  draftCount: number;
  overallSignificanceRate: number;
}

// ---------- Service ----------

const REFRESH_INTERVAL_MS = 30_000;
const API_BASE = '/api/geo/experiments';

@Injectable({ providedIn: 'root' })
export class ExperimentsService {
  private readonly http = inject(HttpClient);

  // ---------- state signals ----------
  readonly experiments = signal<Experiment[]>([]);
  readonly selectedExperiment = signal<ExperimentDetail | null>(null);
  readonly runningCount = signal(0);
  readonly completedCount = signal(0);
  readonly draftCount = signal(0);
  readonly overallSignificanceRate = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedStatus = signal<ExperimentStatus | null>(null);
  readonly selectedType = signal<ExperimentType | null>(null);

  // ---------- computed ----------
  readonly filteredExperiments = computed(() => {
    let result = this.experiments();
    const status = this.selectedStatus();
    const type = this.selectedType();
    if (status) {
      result = result.filter((e) => e.status === status);
    }
    if (type) {
      result = result.filter((e) => e.type === type);
    }
    return result;
  });

  readonly runningExperiments = computed(
    () => this.experiments().filter((e) => e.status === ExperimentStatus.Running),
  );

  readonly significantExperiments = computed(
    () => this.experiments().filter(
      (e) => e.statisticalSignificance !== null && e.statisticalSignificance >= 95,
    ),
  );

  readonly winnerExperiments = computed(
    () => this.experiments().filter((e) => e.isWinner === true),
  );

  // ---------- polling ----------
  readonly dashboard$: Observable<ExperimentsDashboard> = timer(0, REFRESH_INTERVAL_MS).pipe(
    switchMap(() => this.http.get<ExperimentsDashboard>(`${API_BASE}/dashboard`)),
    tap((d) => this.applyDashboard(d)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  // ---------- commands ----------
  loadDashboard(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http
      .get<ExperimentsDashboard>(`${API_BASE}/dashboard`)
      .pipe(
        tap((d) => this.applyDashboard(d)),
        catchError((err) => {
          this.error.set('Failed to load experiments dashboard.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  fetchExperiments(
    status?: ExperimentStatus,
    type?: ExperimentType,
  ): Observable<Experiment[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (type) params = params.set('type', type);

    return this.http.get<Experiment[]>(`${API_BASE}/list`, { params }).pipe(
      tap((experiments) => this.experiments.set(experiments)),
      catchError((err) => {
        this.error.set('Failed to load experiments.');
        return throwError(() => err);
      }),
    );
  }

  fetchExperimentDetail(experimentId: string): Observable<ExperimentDetail> {
    return this.http
      .get<ExperimentDetail>(`${API_BASE}/${experimentId}/detail`)
      .pipe(
        tap((detail) => this.selectedExperiment.set(detail)),
        catchError((err) => {
          this.error.set('Failed to load experiment details.');
          return throwError(() => err);
        }),
      );
  }

  updateTrafficSplit(
    experimentId: string,
    controlPercent: number,
    treatmentPercent: number,
  ): Observable<TrafficSplitConfig> {
    return this.http
      .put<TrafficSplitConfig>(`${API_BASE}/${experimentId}/traffic-split`, {
        controlPercent,
        treatmentPercent,
      })
      .pipe(
        tap(() => {
          this.experiments.update((list) =>
            list.map((e) =>
              e.id === experimentId
                ? { ...e, trafficSplitPercent: treatmentPercent }
                : e,
            ),
          );
        }),
        catchError((err) => {
          this.error.set('Failed to update traffic split.');
          return throwError(() => err);
        }),
      );
  }

  startExperiment(experimentId: string): Observable<Experiment> {
    return this.http
      .post<Experiment>(`${API_BASE}/${experimentId}/start`, {})
      .pipe(
        tap((exp) => this.updateExperimentInList(exp)),
        catchError((err) => {
          this.error.set('Failed to start experiment.');
          return throwError(() => err);
        }),
      );
  }

  pauseExperiment(experimentId: string): Observable<Experiment> {
    return this.http
      .post<Experiment>(`${API_BASE}/${experimentId}/pause`, {})
      .pipe(
        tap((exp) => this.updateExperimentInList(exp)),
        catchError((err) => {
          this.error.set('Failed to pause experiment.');
          return throwError(() => err);
        }),
      );
  }

  completeExperiment(experimentId: string, conclusion: string): Observable<Experiment> {
    return this.http
      .post<Experiment>(`${API_BASE}/${experimentId}/complete`, { conclusion })
      .pipe(
        tap((exp) => this.updateExperimentInList(exp)),
        catchError((err) => {
          this.error.set('Failed to complete experiment.');
          return throwError(() => err);
        }),
      );
  }

  cancelExperiment(experimentId: string): Observable<Experiment> {
    return this.http
      .post<Experiment>(`${API_BASE}/${experimentId}/cancel`, {})
      .pipe(
        tap((exp) => this.updateExperimentInList(exp)),
        catchError((err) => {
          this.error.set('Failed to cancel experiment.');
          return throwError(() => err);
        }),
      );
  }

  setStatusFilter(status: ExperimentStatus | null): void {
    this.selectedStatus.set(status);
  }

  setTypeFilter(type: ExperimentType | null): void {
    this.selectedType.set(type);
  }

  clearError(): void {
    this.error.set(null);
  }

  // ---------- private ----------
  private applyDashboard(d: ExperimentsDashboard): void {
    this.experiments.set(d.experiments);
    this.runningCount.set(d.runningCount);
    this.completedCount.set(d.completedCount);
    this.draftCount.set(d.draftCount);
    this.overallSignificanceRate.set(d.overallSignificanceRate);
    this.error.set(null);
  }

  private updateExperimentInList(updated: Experiment): void {
    this.experiments.update((list) =>
      list.map((e) => (e.id === updated.id ? updated : e)),
    );
  }
}
