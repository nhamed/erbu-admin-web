import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timer, switchMap, shareReplay, map } from 'rxjs';

// ---------- DTOs ----------

export type ServiceHealthStatus = 'healthy' | 'degraded' | 'down';

export interface MicroserviceInfo {
  id: string;
  name: string;
  version: string;
  status: ServiceHealthStatus;
  cpuPercent: number;
  memoryMb: number;
  memoryLimitMb: number;
  uptimeSeconds: number;
  lastHealthCheck: string;
  endpoint: string;
  replicas: number;
  activeConnections: number;
  requestsPerSecond: number;
  errorRate: number;
  p99LatencyMs: number;
}

export interface ServiceControlAction {
  serviceId: string;
  action: 'restart' | 'drain' | 'scale-up' | 'scale-down';
}

export interface ServiceControlResult {
  serviceId: string;
  action: string;
  success: boolean;
  message: string;
  timestamp: string;
}

export interface PrometheusMetric {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: string;
}

export interface PrometheusSnapshot {
  totalRequests: number;
  totalErrors: number;
  avgLatencyMs: number;
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  diskUsagePercent: number;
  activeGoroutines: number;
  openFileDescriptors: number;
  metrics: PrometheusMetric[];
}

export interface ServicesDashboardData {
  services: MicroserviceInfo[];
  prometheus: PrometheusSnapshot;
  lastUpdatedAt: string;
}

export interface ServiceActionLog {
  id: string;
  serviceId: string;
  serviceName: string;
  action: string;
  performedBy: string;
  performedAt: string;
  success: boolean;
  message: string;
}

// ---------- Service ----------

const REFRESH_INTERVAL_MS = 10_000;
const API_BASE = '/api/admin/services';

@Injectable({ providedIn: 'root' })
export class ServicesDashboardService {
  private readonly http = inject(HttpClient);

  /** Polls the services dashboard every 10 seconds. */
  readonly dashboard$: Observable<ServicesDashboardData> = timer(
    0,
    REFRESH_INTERVAL_MS,
  ).pipe(
    switchMap(() => this.http.get<ServicesDashboardData>(`${API_BASE}/dashboard`)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** One-shot fetch of all services. */
  fetchServices(): Observable<MicroserviceInfo[]> {
    return this.http.get<MicroserviceInfo[]>(`${API_BASE}/list`);
  }

  /** Fetch Prometheus metrics snapshot. */
  fetchPrometheusMetrics(): Observable<PrometheusSnapshot> {
    return this.http.get<PrometheusSnapshot>(`${API_BASE}/prometheus`);
  }

  /** Execute a service control action (restart, drain, etc.). */
  executeAction(action: ServiceControlAction): Observable<ServiceControlResult> {
    return this.http.post<ServiceControlResult>(`${API_BASE}/control`, action);
  }

  /** Fetch recent action logs. */
  fetchActionLogs(limit = 50): Observable<ServiceActionLog[]> {
    return this.http.get<ServiceActionLog[]>(`${API_BASE}/action-logs`, {
      params: { limit: limit.toString() },
    });
  }

  /** Fetch health history for a single service. */
  fetchServiceHealthHistory(
    serviceId: string,
    from: string,
    to: string,
  ): Observable<PrometheusMetric[]> {
    return this.http.get<PrometheusMetric[]>(
      `${API_BASE}/${serviceId}/health-history`,
      { params: { from, to } },
    );
  }
}
