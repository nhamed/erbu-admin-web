import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, tap, throwError, finalize } from 'rxjs';
import {
  DevToolsService,
  RedisKeyInfo,
} from '@erbu-admin-web/shared/data-access';

// ── Models ──────────────────────────────────────────────────

export type RedisKeyType = 'string' | 'hash' | 'list' | 'set' | 'zset' | 'stream' | 'unknown';

export interface RedisKeyDetail {
  key: string;
  type: RedisKeyType;
  ttlSeconds: number;
  sizeBytes: number;
  encoding: string;
  value: unknown;
  fieldCount: number | null;
  listLength: number | null;
}

export interface RedisHashEntry {
  field: string;
  value: string;
}

export interface RedisListItem {
  index: number;
  value: string;
}

export interface RedisSortedSetEntry {
  member: string;
  score: number;
}

export interface RedisServerStats {
  connectedClients: number;
  usedMemoryBytes: number;
  usedMemoryDisplay: string;
  totalKeysCount: number;
  opsPerSecond: number;
  hitRate: number;
  uptimeSeconds: number;
  redisVersion: string;
  databases: RedisDatabaseInfo[];
}

export interface RedisDatabaseInfo {
  dbIndex: number;
  keyCount: number;
  expiringKeyCount: number;
}

// ── Service ─────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class RedisService {
  private readonly http = inject(HttpClient);
  private readonly devTools = inject(DevToolsService);
  private readonly baseUrl = '/api/devtools/redis';

  // ── State signals ──────────────────────────────────────
  readonly keys = signal<RedisKeyInfo[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedKey = signal<RedisKeyDetail | null>(null);
  readonly keyLoading = signal(false);
  readonly serverStats = signal<RedisServerStats | null>(null);
  readonly searchPattern = signal('*');
  readonly deleteInProgress = signal(false);

  // ── Computed ───────────────────────────────────────────
  readonly totalKeys = computed(() => this.keys().length);
  readonly keysWithTtl = computed(
    () => this.keys().filter((k) => k.ttlSeconds > 0).length,
  );
  readonly persistentKeys = computed(
    () => this.keys().filter((k) => k.ttlSeconds === -1).length,
  );
  readonly totalSizeBytes = computed(
    () => this.keys().reduce((sum, k) => sum + k.sizeBytes, 0),
  );

  readonly keysByType = computed(() => {
    const map = new Map<string, number>();
    for (const k of this.keys()) {
      map.set(k.type, (map.get(k.type) ?? 0) + 1);
    }
    return Array.from(map.entries()).map(([type, count]) => ({ type, count }));
  });

  // ── Key search ─────────────────────────────────────────
  searchKeys(pattern: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.searchPattern.set(pattern);

    this.devTools.redisKeys(pattern).pipe(
      tap((data) => this.keys.set(data)),
      catchError((err) => {
        this.error.set('Failed to search Redis keys.');
        return throwError(() => err);
      }),
      finalize(() => this.loading.set(false)),
    ).subscribe();
  }

  // ── Key detail ─────────────────────────────────────────
  loadKeyDetail(key: string): void {
    this.keyLoading.set(true);
    this.selectedKey.set(null);

    this.http
      .get<RedisKeyDetail>(`${this.baseUrl}/key`, { params: { key } })
      .pipe(
        tap((data) => this.selectedKey.set(data)),
        catchError((err) => {
          this.error.set('Failed to load key details.');
          return throwError(() => err);
        }),
        finalize(() => this.keyLoading.set(false)),
      )
      .subscribe();
  }

  // ── Delete key ─────────────────────────────────────────
  deleteKey(key: string): Observable<void> {
    this.deleteInProgress.set(true);
    return this.http
      .delete<void>(`${this.baseUrl}/key`, { params: { key } })
      .pipe(
        tap(() => {
          this.keys.update((list) => list.filter((k) => k.key !== key));
          if (this.selectedKey()?.key === key) {
            this.selectedKey.set(null);
          }
        }),
        catchError((err) => {
          this.error.set('Failed to delete key.');
          return throwError(() => err);
        }),
        finalize(() => this.deleteInProgress.set(false)),
      );
  }

  // ── Server stats ───────────────────────────────────────
  loadServerStats(): void {
    this.http
      .get<RedisServerStats>(`${this.baseUrl}/stats`)
      .pipe(
        tap((data) => this.serverStats.set(data)),
        catchError((err) => {
          this.error.set('Failed to load Redis server stats.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  // ── Helpers ────────────────────────────────────────────
  clearSelection(): void {
    this.selectedKey.set(null);
  }

  clearError(): void {
    this.error.set(null);
  }
}
