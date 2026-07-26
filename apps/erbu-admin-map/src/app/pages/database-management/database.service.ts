import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, tap, throwError, finalize } from 'rxjs';
import {
  DevToolsService,
  PgQueryResult,
} from '@erbu-admin-web/shared/data-access';

// ── Models ──────────────────────────────────────────────────

export interface PgTableInfo {
  schemaName: string;
  tableName: string;
  rowCount: number;
  sizeBytes: number;
  sizeDisplay: string;
  indexCount: number;
  hasRecentWrites: boolean;
  lastVacuumAt: string | null;
  lastAnalyzeAt: string | null;
}

export interface PgConnectionPool {
  maxConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingClients: number;
  totalConnectionsCreated: number;
  avgAcquireTimeMs: number;
  poolUtilizationPercent: number;
}

export interface PgBackupStatus {
  lastBackupAt: string | null;
  lastBackupSizeBytes: number;
  lastBackupSizeDisplay: string;
  lastBackupDurationSeconds: number;
  backupType: string;
  destinationPath: string;
  isScheduled: boolean;
  nextScheduledAt: string | null;
  status: 'Completed' | 'Running' | 'Failed' | 'Scheduled' | 'Never';
  errorMessage: string | null;
}

export interface PgPurgeSchedule {
  id: string;
  tableName: string;
  retentionDays: number;
  cronExpression: string;
  isEnabled: boolean;
  lastRunAt: string | null;
  lastRunRowsDeleted: number;
  nextRunAt: string | null;
  whereClause: string;
  createdAt: string;
}

export interface PgDatabaseStats {
  databaseName: string;
  databaseSizeBytes: number;
  databaseSizeDisplay: string;
  tableCount: number;
  totalRowCount: number;
  indexCount: number;
  activeQueries: number;
  deadTuples: number;
  cacheHitRatio: number;
  uptimeSeconds: number;
  postgresVersion: string;
}

// ── Service ─────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class DatabaseService {
  private readonly http = inject(HttpClient);
  private readonly devTools = inject(DevToolsService);
  private readonly baseUrl = '/api/devtools/pg';

  // ── State signals ──────────────────────────────────────
  readonly tables = signal<PgTableInfo[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly connectionPool = signal<PgConnectionPool | null>(null);
  readonly backupStatus = signal<PgBackupStatus | null>(null);
  readonly purgeSchedules = signal<PgPurgeSchedule[]>([]);
  readonly databaseStats = signal<PgDatabaseStats | null>(null);
  readonly queryResult = signal<PgQueryResult | null>(null);
  readonly queryLoading = signal(false);
  readonly queryError = signal<string | null>(null);

  // ── Computed ───────────────────────────────────────────
  readonly totalTables = computed(() => this.tables().length);
  readonly totalRows = computed(
    () => this.tables().reduce((sum, t) => sum + t.rowCount, 0),
  );
  readonly poolUtilization = computed(
    () => this.connectionPool()?.poolUtilizationPercent ?? 0,
  );

  // ── Tables ─────────────────────────────────────────────
  loadTables(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http
      .get<PgTableInfo[]>(`${this.baseUrl}/tables`)
      .pipe(
        tap((data) => this.tables.set(data)),
        catchError((err) => {
          this.error.set('Failed to load database tables.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  // ── Read-only query runner ─────────────────────────────
  executeQuery(sql: string): void {
    this.queryLoading.set(true);
    this.queryError.set(null);
    this.queryResult.set(null);

    this.devTools.pgQuery(sql).pipe(
      tap((result) => this.queryResult.set(result)),
      catchError((err) => {
        this.queryError.set(
          err?.error?.message ?? 'Query execution failed.',
        );
        return throwError(() => err);
      }),
      finalize(() => this.queryLoading.set(false)),
    ).subscribe();
  }

  // ── Connection pool ────────────────────────────────────
  loadConnectionPool(): void {
    this.http
      .get<PgConnectionPool>(`${this.baseUrl}/pool`)
      .pipe(
        tap((data) => this.connectionPool.set(data)),
        catchError((err) => {
          this.error.set('Failed to load connection pool stats.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  // ── Backup status ──────────────────────────────────────
  loadBackupStatus(): void {
    this.http
      .get<PgBackupStatus>(`${this.baseUrl}/backup/status`)
      .pipe(
        tap((data) => this.backupStatus.set(data)),
        catchError((err) => {
          this.error.set('Failed to load backup status.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  triggerBackup(): Observable<PgBackupStatus> {
    return this.http
      .post<PgBackupStatus>(`${this.baseUrl}/backup/trigger`, {})
      .pipe(
        tap((data) => this.backupStatus.set(data)),
        catchError((err) => {
          this.error.set('Failed to trigger backup.');
          return throwError(() => err);
        }),
      );
  }

  // ── Purge schedules ────────────────────────────────────
  loadPurgeSchedules(): void {
    this.http
      .get<PgPurgeSchedule[]>(`${this.baseUrl}/purge/schedules`)
      .pipe(
        tap((data) => this.purgeSchedules.set(data)),
        catchError((err) => {
          this.error.set('Failed to load purge schedules.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  togglePurgeSchedule(id: string, enabled: boolean): Observable<PgPurgeSchedule> {
    return this.http
      .patch<PgPurgeSchedule>(`${this.baseUrl}/purge/schedules/${id}`, {
        isEnabled: enabled,
      })
      .pipe(
        tap((updated) =>
          this.purgeSchedules.update((list) =>
            list.map((s) => (s.id === id ? updated : s)),
          ),
        ),
        catchError((err) => {
          this.error.set('Failed to update purge schedule.');
          return throwError(() => err);
        }),
      );
  }

  // ── Database stats ─────────────────────────────────────
  loadDatabaseStats(): void {
    this.http
      .get<PgDatabaseStats>(`${this.baseUrl}/stats`)
      .pipe(
        tap((data) => this.databaseStats.set(data)),
        catchError((err) => {
          this.error.set('Failed to load database stats.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  // ── Helpers ────────────────────────────────────────────
  clearQuery(): void {
    this.queryResult.set(null);
    this.queryError.set(null);
  }

  clearError(): void {
    this.error.set(null);
  }
}
