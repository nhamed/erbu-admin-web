import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

// ---------- DTOs ----------

export type PipelineStatus = 'running' | 'paused' | 'error' | 'stopped' | 'starting';

export interface PipelineThroughput {
  documentsPerSecond: number;
  bytesPerSecond: number;
  avgProcessingMs: number;
}

export interface Pipeline {
  id: string;
  name: string;
  status: PipelineStatus;
  source: string;
  destination: string;
  documentCount: number;
  errorCount: number;
  throughput: PipelineThroughput;
  lastDocumentAt: string | null;
  createdAt: string;
  updatedAt: string;
  schedule: string | null;
  tags: string[];
}

export interface PipelineErrorLog {
  id: string;
  pipelineId: string;
  pipelineName: string;
  message: string;
  stackTrace: string | null;
  documentId: string | null;
  occurredAt: string;
  severity: 'warning' | 'error' | 'fatal';
}

export interface IngestionKpi {
  totalPipelines: number;
  runningPipelines: number;
  pausedPipelines: number;
  errorPipelines: number;
  totalDocumentsIngested: number;
  totalErrors: number;
  avgThroughputDocsPerSec: number;
  avgProcessingMs: number;
}

export interface IngestionDashboard {
  kpi: IngestionKpi;
  pipelines: Pipeline[];
  recentErrors: PipelineErrorLog[];
  lastUpdatedAt: string;
}

export interface PipelineConfig {
  batchSize: number;
  maxRetries: number;
  retryDelayMs: number;
  schedule: string | null;
  sourceConfig: Record<string, unknown>;
  destinationConfig: Record<string, unknown>;
}

// ---------- Service ----------

const REFRESH_INTERVAL_MS = 10_000;
const API_BASE = '/api/admin/geo-search/ingestion';

@Injectable({ providedIn: 'root' })
export class IngestionService {
  private readonly http = inject(HttpClient);

  // ---------- state signals ----------
  readonly pipelines = signal<Pipeline[]>([]);
  readonly recentErrors = signal<PipelineErrorLog[]>([]);
  readonly kpi = signal<IngestionKpi>({
    totalPipelines: 0,
    runningPipelines: 0,
    pausedPipelines: 0,
    errorPipelines: 0,
    totalDocumentsIngested: 0,
    totalErrors: 0,
    avgThroughputDocsPerSec: 0,
    avgProcessingMs: 0,
  });
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedStatus = signal<PipelineStatus | null>(null);
  readonly searchTerm = signal('');

  // ---------- computed ----------
  readonly filteredPipelines = computed(() => {
    let result = this.pipelines();
    const status = this.selectedStatus();
    const search = this.searchTerm().toLowerCase();

    if (status) {
      result = result.filter((p) => p.status === status);
    }
    if (search) {
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(search) ||
          p.source.toLowerCase().includes(search) ||
          p.destination.toLowerCase().includes(search),
      );
    }
    return result;
  });

  readonly runningCount = computed(() => this.kpi().runningPipelines);
  readonly errorCount = computed(() => this.kpi().errorPipelines);

  // ---------- polling ----------
  readonly dashboard$: Observable<IngestionDashboard> = timer(
    0,
    REFRESH_INTERVAL_MS,
  ).pipe(
    switchMap(() => this.http.get<IngestionDashboard>(`${API_BASE}/dashboard`)),
    tap((d) => this.applyDashboard(d)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  // ---------- commands ----------
  loadDashboard(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http
      .get<IngestionDashboard>(`${API_BASE}/dashboard`)
      .pipe(
        tap((d) => this.applyDashboard(d)),
        catchError((err) => {
          this.error.set('Failed to load ingestion dashboard.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  startPipeline(pipelineId: string): Observable<{ success: boolean; message: string }> {
    return this.http
      .post<{ success: boolean; message: string }>(`${API_BASE}/pipelines/${pipelineId}/start`, {})
      .pipe(
        tap(() => this.updatePipelineStatus(pipelineId, 'starting')),
        catchError((err) => {
          this.error.set(`Failed to start pipeline ${pipelineId}.`);
          return throwError(() => err);
        }),
      );
  }

  stopPipeline(pipelineId: string): Observable<{ success: boolean; message: string }> {
    return this.http
      .post<{ success: boolean; message: string }>(`${API_BASE}/pipelines/${pipelineId}/stop`, {})
      .pipe(
        tap(() => this.updatePipelineStatus(pipelineId, 'stopped')),
        catchError((err) => {
          this.error.set(`Failed to stop pipeline ${pipelineId}.`);
          return throwError(() => err);
        }),
      );
  }

  pausePipeline(pipelineId: string): Observable<{ success: boolean; message: string }> {
    return this.http
      .post<{ success: boolean; message: string }>(`${API_BASE}/pipelines/${pipelineId}/pause`, {})
      .pipe(
        tap(() => this.updatePipelineStatus(pipelineId, 'paused')),
        catchError((err) => {
          this.error.set(`Failed to pause pipeline ${pipelineId}.`);
          return throwError(() => err);
        }),
      );
  }

  restartPipeline(pipelineId: string): Observable<{ success: boolean; message: string }> {
    return this.http
      .post<{ success: boolean; message: string }>(`${API_BASE}/pipelines/${pipelineId}/restart`, {})
      .pipe(
        tap(() => this.updatePipelineStatus(pipelineId, 'starting')),
        catchError((err) => {
          this.error.set(`Failed to restart pipeline ${pipelineId}.`);
          return throwError(() => err);
        }),
      );
  }

  fetchPipelineConfig(pipelineId: string): Observable<PipelineConfig> {
    return this.http.get<PipelineConfig>(`${API_BASE}/pipelines/${pipelineId}/config`);
  }

  fetchErrorLogs(pipelineId?: string, limit = 50): Observable<PipelineErrorLog[]> {
    const params: Record<string, string> = { limit: limit.toString() };
    if (pipelineId) params['pipelineId'] = pipelineId;
    return this.http.get<PipelineErrorLog[]>(`${API_BASE}/errors`, { params });
  }

  setStatusFilter(status: PipelineStatus | null): void {
    this.selectedStatus.set(status);
  }

  setSearchTerm(term: string): void {
    this.searchTerm.set(term);
  }

  clearError(): void {
    this.error.set(null);
  }

  // ---------- private ----------
  private applyDashboard(d: IngestionDashboard): void {
    this.kpi.set(d.kpi);
    this.pipelines.set(d.pipelines);
    this.recentErrors.set(d.recentErrors);
    this.error.set(null);
  }

  private updatePipelineStatus(id: string, status: PipelineStatus): void {
    this.pipelines.update((list) =>
      list.map((p) => (p.id === id ? { ...p, status } : p)),
    );
  }
}
