import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, tap, throwError, finalize } from 'rxjs';
import { DevToolsService } from '@erbu-admin-web/shared/data-access';

// ── Models ──────────────────────────────────────────────────

export interface LogRetentionPolicy {
  id: string;
  name: string;
  logSource: string;
  retentionDays: number;
  maxSizeGb: number;
  currentSizeGb: number;
  currentSizeDisplay: string;
  utilizationPercent: number;
  isEnabled: boolean;
  compressionEnabled: boolean;
  lastPurgedAt: string | null;
  rowsPurgedLastRun: number;
  createdAt: string;
  updatedAt: string;
}

export interface MetricsStorageStats {
  totalSeriesCount: number;
  activeSeriesCount: number;
  samplesPerSecond: number;
  totalDataPointsStored: number;
  storageSizeBytes: number;
  storageSizeDisplay: string;
  retentionDays: number;
  compactionStatus: string;
  walSizeBytes: number;
  walSizeDisplay: string;
  lastCompactedAt: string | null;
  ingestionRate: number;
  queryRatePerSecond: number;
}

export interface TraceStorageQuota {
  id: string;
  serviceName: string;
  quotaSizeGb: number;
  usedSizeGb: number;
  usedSizeDisplay: string;
  utilizationPercent: number;
  retentionDays: number;
  spanCount: number;
  traceCount: number;
  avgSpanDurationMs: number;
  samplingRate: number;
  isOverQuota: boolean;
  lastCleanupAt: string | null;
}

export interface CleanupSchedule {
  id: string;
  name: string;
  targetType: 'logs' | 'metrics' | 'traces';
  cronExpression: string;
  isEnabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: 'Success' | 'Failed' | 'Running' | 'Never';
  lastRunDurationSeconds: number;
  lastRunBytesFreed: number;
  lastRunBytesFreedDisplay: string;
  nextRunAt: string | null;
  dryRun: boolean;
  createdAt: string;
}

export interface ObservabilityOverview {
  totalStorageSizeBytes: number;
  totalStorageSizeDisplay: string;
  logStorageSizeBytes: number;
  logStorageSizeDisplay: string;
  metricsStorageSizeBytes: number;
  metricsStorageSizeDisplay: string;
  traceStorageSizeBytes: number;
  traceStorageSizeDisplay: string;
  diskQuotaBytes: number;
  diskQuotaDisplay: string;
  diskUtilizationPercent: number;
  ingestionRateMbPerMin: number;
  estimatedDaysUntilFull: number | null;
}

// ── Service ─────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class ObservabilityService {
  private readonly http = inject(HttpClient);
  private readonly devTools = inject(DevToolsService);
  private readonly baseUrl = '/api/devtools/observability';

  // ── State signals ──────────────────────────────────────
  readonly overview = signal<ObservabilityOverview | null>(null);
  readonly logPolicies = signal<LogRetentionPolicy[]>([]);
  readonly metricsStats = signal<MetricsStorageStats | null>(null);
  readonly traceQuotas = signal<TraceStorageQuota[]>([]);
  readonly cleanupSchedules = signal<CleanupSchedule[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // ── Computed ───────────────────────────────────────────
  readonly diskUtilization = computed(
    () => this.overview()?.diskUtilizationPercent ?? 0,
  );

  readonly daysUntilFull = computed(
    () => this.overview()?.estimatedDaysUntilFull ?? null,
  );

  readonly totalStorageDisplay = computed(
    () => this.overview()?.totalStorageSizeDisplay ?? '--',
  );

  readonly logStorageDisplay = computed(
    () => this.overview()?.logStorageSizeDisplay ?? '--',
  );

  readonly metricsStorageDisplay = computed(
    () => this.overview()?.metricsStorageSizeDisplay ?? '--',
  );

  readonly traceStorageDisplay = computed(
    () => this.overview()?.traceStorageSizeDisplay ?? '--',
  );

  readonly diskUtilizationClass = computed(() => {
    const pct = this.diskUtilization();
    if (pct >= 90) return 'util-critical';
    if (pct >= 75) return 'util-warning';
    return 'util-healthy';
  });

  readonly overQuotaServices = computed(
    () => this.traceQuotas().filter((q) => q.isOverQuota).length,
  );

  readonly activeCleanups = computed(
    () => this.cleanupSchedules().filter((s) => s.isEnabled).length,
  );

  readonly totalPolicies = computed(
    () => this.logPolicies().length,
  );

  // ── Overview ───────────────────────────────────────────
  loadOverview(): void {
    this.http
      .get<ObservabilityOverview>(`${this.baseUrl}/overview`)
      .pipe(
        tap((data) => this.overview.set(data)),
        catchError((err) => {
          this.error.set('Failed to load observability overview.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  // ── Log retention policies ─────────────────────────────
  loadLogPolicies(): void {
    this.loading.set(true);

    this.http
      .get<LogRetentionPolicy[]>(`${this.baseUrl}/logs/policies`)
      .pipe(
        tap((data) => this.logPolicies.set(data)),
        catchError((err) => {
          this.error.set('Failed to load log retention policies.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  updateLogPolicy(
    id: string,
    updates: Partial<Pick<LogRetentionPolicy, 'retentionDays' | 'maxSizeGb' | 'isEnabled' | 'compressionEnabled'>>,
  ): Observable<LogRetentionPolicy> {
    return this.http
      .patch<LogRetentionPolicy>(`${this.baseUrl}/logs/policies/${id}`, updates)
      .pipe(
        tap((updated) =>
          this.logPolicies.update((list) =>
            list.map((p) => (p.id === id ? updated : p)),
          ),
        ),
        catchError((err) => {
          this.error.set('Failed to update log retention policy.');
          return throwError(() => err);
        }),
      );
  }

  // ── Metrics storage ────────────────────────────────────
  loadMetricsStats(): void {
    this.http
      .get<MetricsStorageStats>(`${this.baseUrl}/metrics/stats`)
      .pipe(
        tap((data) => this.metricsStats.set(data)),
        catchError((err) => {
          this.error.set('Failed to load metrics storage stats.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  // ── Trace storage quotas ───────────────────────────────
  loadTraceQuotas(): void {
    this.http
      .get<TraceStorageQuota[]>(`${this.baseUrl}/traces/quotas`)
      .pipe(
        tap((data) => this.traceQuotas.set(data)),
        catchError((err) => {
          this.error.set('Failed to load trace storage quotas.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  updateTraceQuota(
    id: string,
    updates: Partial<Pick<TraceStorageQuota, 'quotaSizeGb' | 'retentionDays' | 'samplingRate'>>,
  ): Observable<TraceStorageQuota> {
    return this.http
      .patch<TraceStorageQuota>(`${this.baseUrl}/traces/quotas/${id}`, updates)
      .pipe(
        tap((updated) =>
          this.traceQuotas.update((list) =>
            list.map((q) => (q.id === id ? updated : q)),
          ),
        ),
        catchError((err) => {
          this.error.set('Failed to update trace quota.');
          return throwError(() => err);
        }),
      );
  }

  // ── Cleanup schedules ──────────────────────────────────
  loadCleanupSchedules(): void {
    this.http
      .get<CleanupSchedule[]>(`${this.baseUrl}/cleanup/schedules`)
      .pipe(
        tap((data) => this.cleanupSchedules.set(data)),
        catchError((err) => {
          this.error.set('Failed to load cleanup schedules.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  toggleCleanupSchedule(id: string, enabled: boolean): Observable<CleanupSchedule> {
    return this.http
      .patch<CleanupSchedule>(`${this.baseUrl}/cleanup/schedules/${id}`, {
        isEnabled: enabled,
      })
      .pipe(
        tap((updated) =>
          this.cleanupSchedules.update((list) =>
            list.map((s) => (s.id === id ? updated : s)),
          ),
        ),
        catchError((err) => {
          this.error.set('Failed to update cleanup schedule.');
          return throwError(() => err);
        }),
      );
  }

  triggerCleanup(id: string): Observable<CleanupSchedule> {
    return this.http
      .post<CleanupSchedule>(`${this.baseUrl}/cleanup/schedules/${id}/run`, {})
      .pipe(
        tap((updated) =>
          this.cleanupSchedules.update((list) =>
            list.map((s) => (s.id === id ? updated : s)),
          ),
        ),
        catchError((err) => {
          this.error.set('Failed to trigger cleanup.');
          return throwError(() => err);
        }),
      );
  }

  // ── Helpers ────────────────────────────────────────────
  clearError(): void {
    this.error.set(null);
  }
}
