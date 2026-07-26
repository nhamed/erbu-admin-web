import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map, catchError, of, Subject, timer, switchMap, takeUntil, tap, retry } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  PipelineRun,
  PipelineStatus,
  PipelineStage,
} from '@erbu-admin-web/shared/models';

// ---------------------------------------------------------------------------
// DTOs specific to the pipelines API (not shared across libs)
// ---------------------------------------------------------------------------

export interface PipelineHistoryPoint {
  date: string;
  succeeded: number;
  failed: number;
  cancelled: number;
  avgDurationSeconds: number;
}

export interface PipelineLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  stepName: string | null;
}

export interface PipelineListResponse {
  items: PipelineRun[];
  totalCount: number;
}

export interface PipelineSessionConfig {
  profile: 'fast' | 'full';
  hibernate: boolean;
  commitOnDone: boolean;
  pushOnDone: boolean;
  testHandoff: boolean;
  agentProvider: string;
  agentModel: string;
  target: string;
}

export interface OrchestratorState {
  isRunning: boolean;
  isPaused: boolean;
  pauseReason: string | null;
  status: string;
  externalPids: Record<string, { pid: number; started: string; logFile: string }>;
}

export interface PipelineFrameworkConfig {
  autoCommit: boolean;
  autoPush: boolean;
  hibernateOnSuccess: boolean;
  maxAttemptsPerTask: number;
  defaultBranch: string;
  gatewayBaseUrl: string;
  simulatorMode: string;
  simulatorAuthMode: string;
  intervalMinutes: number;
  heavyChecksEveryNthCycle: number;
  sshHost: string;
}

export type PipelineStatusFilter = PipelineStatus | 'All';

const PIPELINE_NAMES = ['monitoring', 'dev', 'test', 'perf', 'planner', 'security'] as const;
export type PipelineName = (typeof PIPELINE_NAMES)[number];

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class PipelinesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject<string>('PIPELINES_API_URL' as never, { optional: true }) ?? '/api/pipelines';

  private readonly destroy$ = new Subject<void>();

  // ---- Polling state ----
  private readonly _pollingActive = signal(false);
  readonly pollingActive = this._pollingActive.asReadonly();

  // ---- Pipeline names (static, matches WPF PipelineNames) ----
  readonly pipelineNames: readonly PipelineName[] = PIPELINE_NAMES;

  // ==========================================================================
  // CRUD
  // ==========================================================================

  list(params?: {
    status?: PipelineStatusFilter;
    pipelineName?: string;
    branch?: string;
    page?: number;
    pageSize?: number;
  }): Observable<PipelineListResponse> {
    let httpParams = new HttpParams();
    if (params?.status && params.status !== 'All') {
      httpParams = httpParams.set('status', params.status);
    }
    if (params?.pipelineName) {
      httpParams = httpParams.set('pipelineName', params.pipelineName);
    }
    if (params?.branch) {
      httpParams = httpParams.set('branch', params.branch);
    }
    if (params?.page != null) {
      httpParams = httpParams.set('page', params.page);
    }
    if (params?.pageSize != null) {
      httpParams = httpParams.set('pageSize', params.pageSize);
    }
    return this.http.get<PipelineListResponse>(this.baseUrl, { params: httpParams }).pipe(
      catchError(() => of({ items: [], totalCount: 0 })),
    );
  }

  getById(id: string): Observable<PipelineRun | null> {
    return this.http.get<PipelineRun>(`${this.baseUrl}/${id}`).pipe(
      catchError(() => of(null)),
    );
  }

  getLogs(runId: string, stageName?: string): Observable<PipelineLogEntry[]> {
    let params = new HttpParams();
    if (stageName) {
      params = params.set('stageName', stageName);
    }
    return this.http.get<PipelineLogEntry[]>(`${this.baseUrl}/${runId}/logs`, { params }).pipe(
      catchError(() => of([])),
    );
  }

  // ==========================================================================
  // Actions: run / cancel / retry
  // ==========================================================================

  run(pipelineName: string, branch?: string): Observable<PipelineRun | null> {
    const body: Record<string, string> = { pipelineName };
    if (branch) body['branch'] = branch;
    return this.http.post<PipelineRun>(`${this.baseUrl}/run`, body).pipe(
      catchError(() => of(null)),
    );
  }

  cancel(runId: string): Observable<boolean> {
    return this.http.post<void>(`${this.baseUrl}/${runId}/cancel`, {}).pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }

  retry(runId: string): Observable<PipelineRun | null> {
    return this.http.post<PipelineRun>(`${this.baseUrl}/${runId}/retry`, {}).pipe(
      catchError(() => of(null)),
    );
  }

  // ==========================================================================
  // Orchestrator actions
  // ==========================================================================

  getOrchestratorState(): Observable<OrchestratorState> {
    return this.http.get<OrchestratorState>(`${this.baseUrl}/orchestrator/state`).pipe(
      catchError(() =>
        of({
          isRunning: false,
          isPaused: false,
          pauseReason: null,
          status: 'Unreachable',
          externalPids: {},
        }),
      ),
    );
  }

  runOrchestrator(): Observable<boolean> {
    return this.http.post<void>(`${this.baseUrl}/orchestrator/run`, {}).pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }

  stopOrchestrator(): Observable<boolean> {
    return this.http.post<void>(`${this.baseUrl}/orchestrator/stop`, {}).pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }

  clearPause(): Observable<boolean> {
    return this.http.post<void>(`${this.baseUrl}/orchestrator/clear-pause`, {}).pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }

  killSprawl(): Observable<{ killed: number }> {
    return this.http.post<{ killed: number }>(`${this.baseUrl}/orchestrator/kill-sprawl`, {}).pipe(
      catchError(() => of({ killed: -1 })),
    );
  }

  // ==========================================================================
  // Per-pipeline actions (play / stop / reboot / init / reset-lock / requeue)
  // ==========================================================================

  play(pipelineName: string): Observable<boolean> {
    return this.http.post<void>(`${this.baseUrl}/${pipelineName}/play`, {}).pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }

  stop(pipelineName: string): Observable<boolean> {
    return this.http.post<void>(`${this.baseUrl}/${pipelineName}/stop`, {}).pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }

  reboot(pipelineName: string): Observable<boolean> {
    return this.http.post<void>(`${this.baseUrl}/${pipelineName}/reboot`, {}).pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }

  init(pipelineName: string): Observable<boolean> {
    return this.http.post<void>(`${this.baseUrl}/${pipelineName}/init`, {}).pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }

  resetLock(pipelineName: string): Observable<{ evicted: number }> {
    return this.http.post<{ evicted: number }>(`${this.baseUrl}/${pipelineName}/reset-lock`, {}).pipe(
      catchError(() => of({ evicted: 0 })),
    );
  }

  requeueFailed(pipelineName: string): Observable<{ requeued: number }> {
    return this.http.post<{ requeued: number }>(`${this.baseUrl}/${pipelineName}/requeue-failed`, {}).pipe(
      catchError(() => of({ requeued: 0 })),
    );
  }

  requeueDeferred(pipelineName: string): Observable<{ requeued: number }> {
    return this.http.post<{ requeued: number }>(`${this.baseUrl}/${pipelineName}/requeue-deferred`, {}).pipe(
      catchError(() => of({ requeued: 0 })),
    );
  }

  // ==========================================================================
  // Session & framework config
  // ==========================================================================

  getSessionConfig(): Observable<PipelineSessionConfig> {
    return this.http.get<PipelineSessionConfig>(`${this.baseUrl}/orchestrator/session`).pipe(
      catchError(() =>
        of({
          profile: 'fast' as const,
          hibernate: false,
          commitOnDone: true,
          pushOnDone: true,
          testHandoff: false,
          agentProvider: 'claude',
          agentModel: '',
          target: 'localhost',
        }),
      ),
    );
  }

  saveSessionConfig(config: PipelineSessionConfig): Observable<boolean> {
    return this.http.put<void>(`${this.baseUrl}/orchestrator/session`, config).pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }

  getFrameworkConfig(pipelineName: string): Observable<PipelineFrameworkConfig> {
    return this.http.get<PipelineFrameworkConfig>(`${this.baseUrl}/${pipelineName}/config`).pipe(
      catchError(() =>
        of({
          autoCommit: true,
          autoPush: true,
          hibernateOnSuccess: false,
          maxAttemptsPerTask: 8,
          defaultBranch: 'develop',
          gatewayBaseUrl: 'http://localhost:5100',
          simulatorMode: 'Gateway',
          simulatorAuthMode: 'Oidc',
          intervalMinutes: 10,
          heavyChecksEveryNthCycle: 3,
          sshHost: 'root@85.10.199.206',
        }),
      ),
    );
  }

  saveFrameworkConfig(pipelineName: string, config: PipelineFrameworkConfig): Observable<boolean> {
    return this.http.put<void>(`${this.baseUrl}/${pipelineName}/config`, config).pipe(
      map(() => true),
      catchError(() => of(false)),
    );
  }

  // ==========================================================================
  // History (ECharts timeline data)
  // ==========================================================================

  getHistory(pipelineName?: string, days?: number): Observable<PipelineHistoryPoint[]> {
    let params = new HttpParams();
    if (pipelineName) {
      params = params.set('pipelineName', pipelineName);
    }
    params = params.set('days', days ?? 14);
    return this.http.get<PipelineHistoryPoint[]>(`${this.baseUrl}/history`, { params }).pipe(
      catchError(() => of([])),
    );
  }

  // ==========================================================================
  // Polling (replaces WPF DispatcherTimer + SignalR fallback)
  // ==========================================================================

  startPolling(intervalMs: number = 4000): Observable<PipelineListResponse> {
    this._pollingActive.set(true);
    this.destroy$.next();
    return timer(0, intervalMs).pipe(
      takeUntil(this.destroy$),
      switchMap(() => this.list()),
      tap({ error: () => this._pollingActive.set(false) }),
      retry({ count: 3, delay: 2000 }),
    );
  }

  stopPolling(): void {
    this._pollingActive.set(false);
    this.destroy$.next();
  }

  // ==========================================================================
  // Purge logs
  // ==========================================================================

  purgeLogs(olderThanHours: number = 24): Observable<{ deleted: number; freedMb: number }> {
    return this.http.post<{ deleted: number; freedMb: number }>(
      `${this.baseUrl}/orchestrator/purge-logs`,
      { olderThanHours },
    ).pipe(
      catchError(() => of({ deleted: 0, freedMb: 0 })),
    );
  }
}
