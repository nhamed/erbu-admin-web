import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, of, tap } from 'rxjs';
import { Environment } from './environment';

export interface SshExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface SimConfig {
  scenarioId: string;
  driverCount: number;
  riderCount: number;
  durationMinutes: number;
  region: string;
  surgeEnabled: boolean;
  parameters: Record<string, string>;
}

export interface SimLaunchResult {
  instanceId: string;
  status: string;
  startedAt: string;
  dashboardUrl: string;
}

export interface DeviceInfo {
  id: string;
  name: string;
  type: string;
  ipAddress: string;
  status: string;
  lastSeenAt: string;
  metadata: Record<string, string>;
}

export interface RedisKeyInfo {
  key: string;
  type: string;
  ttlSeconds: number;
  sizeBytes: number;
  value: string | null;
}

export interface MinioObject {
  name: string;
  size: number;
  lastModified: string;
  contentType: string;
  etag: string;
}

export interface PgQueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  durationMs: number;
}

@Injectable({ providedIn: 'root' })
export class DevToolsService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly environment = inject<Environment>('ENVIRONMENT' as never);

  private readonly _isAvailable = signal<boolean>(false);
  readonly isAvailable = this._isAvailable.asReadonly();

  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.checkHealth();
    this.healthCheckInterval = setInterval(() => this.checkHealth(), 30_000);
  }

  sshExec(cmd: string): Observable<SshExecResult> {
    return this.http.post<SshExecResult>(`${this.baseUrl}/ssh/exec`, { command: cmd });
  }

  launchSim(config: SimConfig): Observable<SimLaunchResult> {
    return this.http.post<SimLaunchResult>(`${this.baseUrl}/sim/launch`, config);
  }

  scanDevices(): Observable<DeviceInfo[]> {
    return this.http.get<DeviceInfo[]>(`${this.baseUrl}/devices`);
  }

  redisKeys(pattern: string): Observable<RedisKeyInfo[]> {
    return this.http.get<RedisKeyInfo[]>(`${this.baseUrl}/redis/keys`, {
      params: { pattern },
    });
  }

  minioList(bucket: string): Observable<MinioObject[]> {
    return this.http.get<MinioObject[]>(`${this.baseUrl}/minio/list`, {
      params: { bucket },
    });
  }

  pgQuery(sql: string): Observable<PgQueryResult> {
    return this.http.post<PgQueryResult>(`${this.baseUrl}/pg/query`, { sql });
  }

  private get baseUrl(): string {
    return this.environment.devToolsApiUrl;
  }

  private checkHealth(): void {
    this.http
      .get<{ status: string }>(`${this.baseUrl}/health`, { responseType: 'json' })
      .pipe(
        tap(() => this._isAvailable.set(true)),
        catchError(() => {
          this._isAvailable.set(false);
          return of(null);
        }),
      )
      .subscribe();
  }

  ngOnDestroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}
