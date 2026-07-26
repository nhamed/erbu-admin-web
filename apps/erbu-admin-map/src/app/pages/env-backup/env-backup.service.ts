import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, tap, throwError, finalize } from 'rxjs';

// ---------- DTOs ----------

export type BackupStatus = 'Completed' | 'InProgress' | 'Failed' | 'Restoring';

export interface EnvBackup {
  id: string;
  name: string;
  environment: string;
  status: BackupStatus;
  createdAt: string;
  completedAt: string | null;
  sizeBytes: number;
  serviceCount: number;
  createdBy: string;
  notes: string | null;
  tags: string[];
  includesSecrets: boolean;
  checksumSha256: string | null;
}

export interface BackupDetail extends EnvBackup {
  services: BackupServiceEntry[];
  metadata: Record<string, string>;
  restoreHistory: RestoreRecord[];
}

export interface BackupServiceEntry {
  serviceName: string;
  configKeys: number;
  secretKeys: number;
  sizeBytes: number;
  status: 'Ok' | 'Warning' | 'Error';
  errorMessage: string | null;
}

export interface RestoreRecord {
  id: string;
  restoredAt: string;
  restoredBy: string;
  targetEnvironment: string;
  status: 'Success' | 'Failed' | 'Partial';
  affectedServices: number;
  notes: string | null;
}

export interface BackupComparison {
  baseBackupId: string;
  compareBackupId: string;
  baseBackupName: string;
  compareBackupName: string;
  addedKeys: ComparisonEntry[];
  removedKeys: ComparisonEntry[];
  changedKeys: ComparisonChange[];
  unchangedCount: number;
}

export interface ComparisonEntry {
  serviceName: string;
  key: string;
  value: string;
  isSecret: boolean;
}

export interface ComparisonChange {
  serviceName: string;
  key: string;
  oldValue: string;
  newValue: string;
  isSecret: boolean;
}

export interface CreateBackupRequest {
  name: string;
  environment: string;
  notes?: string;
  tags?: string[];
  includeSecrets: boolean;
}

export interface RestoreBackupRequest {
  backupId: string;
  targetEnvironment: string;
  totpCode: string;
  notes?: string;
}

export interface TotpVerification {
  totpCode: string;
  operationId: string;
}

export interface TotpChallengeResponse {
  operationId: string;
  expiresAt: string;
  message: string;
}

export interface BackupListResponse {
  items: EnvBackup[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------- Service ----------

const API_BASE = '/api/devtools/env-backup';

@Injectable({ providedIn: 'root' })
export class EnvBackupService {
  private readonly http = inject(HttpClient);

  // ---- State signals ----
  readonly backups = signal<EnvBackup[]>([]);
  readonly selectedBackup = signal<BackupDetail | null>(null);
  readonly comparison = signal<BackupComparison | null>(null);
  readonly loading = signal(false);
  readonly detailLoading = signal(false);
  readonly creating = signal(false);
  readonly restoring = signal(false);
  readonly comparing = signal(false);
  readonly error = signal<string | null>(null);
  readonly totalCount = signal(0);
  readonly totpChallenge = signal<TotpChallengeResponse | null>(null);
  readonly pendingRestoreRequest = signal<RestoreBackupRequest | null>(null);

  // ---- Computed ----
  readonly completedBackups = computed(
    () => this.backups().filter((b) => b.status === 'Completed'),
  );

  readonly failedBackups = computed(
    () => this.backups().filter((b) => b.status === 'Failed'),
  );

  readonly inProgressBackups = computed(
    () => this.backups().filter((b) => b.status === 'InProgress' || b.status === 'Restoring'),
  );

  readonly latestBackup = computed(() => {
    const completed = this.completedBackups();
    if (completed.length === 0) return null;
    return completed.reduce((latest, b) =>
      new Date(b.createdAt) > new Date(latest.createdAt) ? b : latest,
    );
  });

  readonly totalSizeBytes = computed(() =>
    this.backups().reduce((sum, b) => sum + b.sizeBytes, 0),
  );

  readonly environments = computed(() => {
    const envSet = new Set(this.backups().map((b) => b.environment));
    return Array.from(envSet).sort();
  });

  // ---- Load backup list ----
  loadBackups(page = 1, pageSize = 25, environment?: string): void {
    this.loading.set(true);
    this.error.set(null);

    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (environment) params = params.set('environment', environment);

    this.http
      .get<BackupListResponse>(API_BASE, { params })
      .pipe(
        tap((res) => {
          this.backups.set(res.items);
          this.totalCount.set(res.total);
        }),
        catchError((err) => {
          this.error.set('Failed to load backups.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  // ---- Load backup detail ----
  loadBackupDetail(id: string): void {
    this.detailLoading.set(true);

    this.http
      .get<BackupDetail>(`${API_BASE}/${id}`)
      .pipe(
        tap((detail) => this.selectedBackup.set(detail)),
        catchError((err) => {
          this.error.set('Failed to load backup details.');
          return throwError(() => err);
        }),
        finalize(() => this.detailLoading.set(false)),
      )
      .subscribe();
  }

  // ---- Create backup ----
  createBackup(request: CreateBackupRequest): void {
    this.creating.set(true);
    this.error.set(null);

    this.http
      .post<EnvBackup>(API_BASE, request)
      .pipe(
        tap((created) => {
          this.backups.update((list) => [created, ...list]);
          this.totalCount.update((n) => n + 1);
        }),
        catchError((err) => {
          this.error.set('Failed to create backup.');
          return throwError(() => err);
        }),
        finalize(() => this.creating.set(false)),
      )
      .subscribe();
  }

  // ---- Request TOTP challenge (server-side generation) ----
  requestTotpChallenge(backupId: string, targetEnvironment: string): void {
    this.error.set(null);

    this.http
      .post<TotpChallengeResponse>(`${API_BASE}/${backupId}/restore/challenge`, {
        targetEnvironment,
      })
      .pipe(
        tap((challenge) => {
          this.totpChallenge.set(challenge);
        }),
        catchError((err) => {
          this.error.set('Failed to initiate TOTP challenge. Check DevTools API connectivity.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  // ---- Restore backup (requires TOTP from challenge) ----
  restoreBackup(request: RestoreBackupRequest): void {
    this.restoring.set(true);
    this.error.set(null);

    this.http
      .post<void>(`${API_BASE}/${request.backupId}/restore`, {
        targetEnvironment: request.targetEnvironment,
        totpCode: request.totpCode,
        notes: request.notes,
      })
      .pipe(
        tap(() => {
          // Mark backup as restoring in local state
          this.backups.update((list) =>
            list.map((b) =>
              b.id === request.backupId ? { ...b, status: 'Restoring' as BackupStatus } : b,
            ),
          );
          this.totpChallenge.set(null);
          this.pendingRestoreRequest.set(null);
        }),
        catchError((err) => {
          const msg =
            err?.error?.message ?? 'Failed to restore backup. TOTP verification may have failed.';
          this.error.set(msg);
          return throwError(() => err);
        }),
        finalize(() => this.restoring.set(false)),
      )
      .subscribe();
  }

  // ---- Compare two backups ----
  compareBackups(baseId: string, compareId: string): void {
    this.comparing.set(true);
    this.error.set(null);

    this.http
      .get<BackupComparison>(`${API_BASE}/compare`, {
        params: new HttpParams().set('base', baseId).set('compare', compareId),
      })
      .pipe(
        tap((result) => this.comparison.set(result)),
        catchError((err) => {
          this.error.set('Failed to compare backups.');
          return throwError(() => err);
        }),
        finalize(() => this.comparing.set(false)),
      )
      .subscribe();
  }

  // ---- Delete backup ----
  deleteBackup(id: string, totpCode: string): Observable<void> {
    return this.http
      .delete<void>(`${API_BASE}/${id}`, {
        body: { totpCode },
      })
      .pipe(
        tap(() => {
          this.backups.update((list) => list.filter((b) => b.id !== id));
          this.totalCount.update((n) => n - 1);
          if (this.selectedBackup()?.id === id) {
            this.selectedBackup.set(null);
          }
        }),
        catchError((err) => {
          this.error.set('Failed to delete backup.');
          return throwError(() => err);
        }),
      );
  }

  // ---- Utility ----
  clearSelection(): void {
    this.selectedBackup.set(null);
  }

  clearComparison(): void {
    this.comparison.set(null);
  }

  clearTotpChallenge(): void {
    this.totpChallenge.set(null);
    this.pendingRestoreRequest.set(null);
  }

  clearError(): void {
    this.error.set(null);
  }
}
