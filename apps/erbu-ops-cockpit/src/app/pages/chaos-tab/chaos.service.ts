import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, tap, throwError, finalize } from 'rxjs';
import {
  ChaosExperiment,
  ChaosStatus,
  ChaosType,
  ChaosSeverity,
} from '@erbu-admin-web/shared/models';

export interface ChaosExperimentFormData {
  name: string;
  description: string;
  targetService: string;
  faultType: ChaosType;
  severity: ChaosSeverity;
  durationSeconds: number;
  rollbackOnFailure: boolean;
  hypothesis: string;
}

export interface ChaosImpactMetrics {
  experimentId: string;
  errorRatePercent: number;
  latencyP50Ms: number;
  latencyP95Ms: number;
  latencyP99Ms: number;
  availabilityPercent: number;
  affectedEndpoints: string[];
  recoveryTimeSeconds: number;
  blastRadius: number;
  steadyStateViolations: string[];
}

export interface ChaosListResponse {
  items: ChaosExperiment[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable({ providedIn: 'root' })
export class ChaosService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/chaos/experiments';

  readonly experiments = signal<ChaosExperiment[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly totalCount = signal(0);
  readonly selectedExperiment = signal<ChaosExperiment | null>(null);
  readonly impactMetrics = signal<ChaosImpactMetrics | null>(null);
  readonly metricsLoading = signal(false);

  readonly runningCount = computed(
    () => this.experiments().filter((e) => e.status === ChaosStatus.Running).length
  );

  readonly hasRunningExperiments = computed(() => this.runningCount() > 0);

  loadExperiments(
    page = 1,
    pageSize = 25,
    statusFilter?: ChaosStatus,
    typeFilter?: ChaosType
  ): void {
    this.loading.set(true);
    this.error.set(null);

    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (statusFilter) {
      params = params.set('status', statusFilter);
    }
    if (typeFilter) {
      params = params.set('faultType', typeFilter);
    }

    this.http
      .get<ChaosListResponse>(this.baseUrl, { params })
      .pipe(
        tap((response) => {
          this.experiments.set(response.items);
          this.totalCount.set(response.total);
        }),
        catchError((err) => {
          this.error.set('Failed to load chaos experiments.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe();
  }

  getExperiment(id: string): Observable<ChaosExperiment> {
    return this.http.get<ChaosExperiment>(`${this.baseUrl}/${id}`).pipe(
      tap((experiment) => this.selectedExperiment.set(experiment)),
      catchError((err) => {
        this.error.set('Failed to load experiment details.');
        return throwError(() => err);
      })
    );
  }

  createExperiment(data: ChaosExperimentFormData): Observable<ChaosExperiment> {
    this.loading.set(true);
    return this.http.post<ChaosExperiment>(this.baseUrl, data).pipe(
      tap((created) => {
        this.experiments.update((list) => [created, ...list]);
        this.totalCount.update((c) => c + 1);
      }),
      catchError((err) => {
        this.error.set('Failed to create experiment.');
        return throwError(() => err);
      }),
      finalize(() => this.loading.set(false))
    );
  }

  updateExperiment(
    id: string,
    data: Partial<ChaosExperimentFormData>
  ): Observable<ChaosExperiment> {
    this.loading.set(true);
    return this.http.patch<ChaosExperiment>(`${this.baseUrl}/${id}`, data).pipe(
      tap((updated) => {
        this.experiments.update((list) =>
          list.map((e) => (e.id === id ? updated : e))
        );
        if (this.selectedExperiment()?.id === id) {
          this.selectedExperiment.set(updated);
        }
      }),
      catchError((err) => {
        this.error.set('Failed to update experiment.');
        return throwError(() => err);
      }),
      finalize(() => this.loading.set(false))
    );
  }

  runExperiment(id: string): Observable<ChaosExperiment> {
    return this.http
      .post<ChaosExperiment>(`${this.baseUrl}/${id}/run`, {})
      .pipe(
        tap((updated) => {
          this.experiments.update((list) =>
            list.map((e) => (e.id === id ? updated : e))
          );
          if (this.selectedExperiment()?.id === id) {
            this.selectedExperiment.set(updated);
          }
        }),
        catchError((err) => {
          this.error.set('Failed to start experiment.');
          return throwError(() => err);
        })
      );
  }

  stopExperiment(id: string): Observable<ChaosExperiment> {
    return this.http
      .post<ChaosExperiment>(`${this.baseUrl}/${id}/stop`, {})
      .pipe(
        tap((updated) => {
          this.experiments.update((list) =>
            list.map((e) => (e.id === id ? updated : e))
          );
          if (this.selectedExperiment()?.id === id) {
            this.selectedExperiment.set(updated);
          }
        }),
        catchError((err) => {
          this.error.set('Failed to stop experiment.');
          return throwError(() => err);
        })
      );
  }

  deleteExperiment(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => {
        this.experiments.update((list) => list.filter((e) => e.id !== id));
        this.totalCount.update((c) => c - 1);
        if (this.selectedExperiment()?.id === id) {
          this.selectedExperiment.set(null);
          this.impactMetrics.set(null);
        }
      }),
      catchError((err) => {
        this.error.set('Failed to delete experiment.');
        return throwError(() => err);
      })
    );
  }

  loadImpactMetrics(experimentId: string): void {
    this.metricsLoading.set(true);
    this.http
      .get<ChaosImpactMetrics>(`${this.baseUrl}/${experimentId}/metrics`)
      .pipe(
        tap((metrics) => this.impactMetrics.set(metrics)),
        catchError((err) => {
          this.error.set('Failed to load impact metrics.');
          return throwError(() => err);
        }),
        finalize(() => this.metricsLoading.set(false))
      )
      .subscribe();
  }

  clearSelection(): void {
    this.selectedExperiment.set(null);
    this.impactMetrics.set(null);
  }

  clearError(): void {
    this.error.set(null);
  }
}
