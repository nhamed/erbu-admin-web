import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timer, switchMap, shareReplay } from 'rxjs';

// ---------- DTOs ----------

export type NodeStatus = 'online' | 'degraded' | 'offline' | 'maintenance';

export interface ServerNode {
  id: string;
  hostname: string;
  ipAddress: string;
  location: string;
  provider: string;
  status: NodeStatus;
  cpuCores: number;
  cpuUsagePercent: number;
  memoryTotalGb: number;
  memoryUsedGb: number;
  diskTotalGb: number;
  diskUsedGb: number;
  networkInMbps: number;
  networkOutMbps: number;
  uptimeSeconds: number;
  os: string;
  lastSeen: string;
  tags: string[];
  runningContainers: number;
}

export interface SshCommandRequest {
  nodeId: string;
  command: string;
}

export interface SshCommandResult {
  nodeId: string;
  command: string;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  executedAt: string;
}

export interface NetworkLink {
  sourceNodeId: string;
  targetNodeId: string;
  latencyMs: number;
  bandwidthMbps: number;
  packetLossPercent: number;
  status: 'active' | 'degraded' | 'down';
}

export interface NetworkTopology {
  nodes: ServerNode[];
  links: NetworkLink[];
}

export interface DeploymentInfo {
  id: string;
  serviceName: string;
  version: string;
  nodeId: string;
  status: 'running' | 'deploying' | 'failed' | 'stopped' | 'rolling-update';
  startedAt: string;
  image: string;
  port: number;
  healthEndpoint: string;
  cpuRequest: string;
  memoryRequest: string;
  replicas: number;
  readyReplicas: number;
}

export interface ResourceAlert {
  id: string;
  nodeId: string;
  hostname: string;
  severity: 'info' | 'warning' | 'critical';
  resource: string;
  message: string;
  currentValue: number;
  threshold: number;
  triggeredAt: string;
  acknowledged: boolean;
}

export interface InfrastructureDashboard {
  nodes: ServerNode[];
  deployments: DeploymentInfo[];
  alerts: ResourceAlert[];
  topology: NetworkTopology;
  lastUpdatedAt: string;
}

// ---------- Service ----------

const REFRESH_INTERVAL_MS = 15_000;
const API_BASE = '/api/admin/infrastructure';

@Injectable({ providedIn: 'root' })
export class InfrastructureService {
  private readonly http = inject(HttpClient);

  /** Polls the infrastructure dashboard every 15 seconds. */
  readonly dashboard$: Observable<InfrastructureDashboard> = timer(
    0,
    REFRESH_INTERVAL_MS,
  ).pipe(
    switchMap(() => this.http.get<InfrastructureDashboard>(`${API_BASE}/dashboard`)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** Fetch all server nodes. */
  fetchNodes(): Observable<ServerNode[]> {
    return this.http.get<ServerNode[]>(`${API_BASE}/nodes`);
  }

  /** Execute an SSH command on a server node via the DevTools API proxy. */
  executeSshCommand(request: SshCommandRequest): Observable<SshCommandResult> {
    return this.http.post<SshCommandResult>(`${API_BASE}/ssh/execute`, request);
  }

  /** Fetch network topology. */
  fetchTopology(): Observable<NetworkTopology> {
    return this.http.get<NetworkTopology>(`${API_BASE}/topology`);
  }

  /** Fetch all deployments. */
  fetchDeployments(): Observable<DeploymentInfo[]> {
    return this.http.get<DeploymentInfo[]>(`${API_BASE}/deployments`);
  }

  /** Trigger a deployment action. */
  triggerDeployment(
    deploymentId: string,
    action: 'restart' | 'stop' | 'rollback',
  ): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${API_BASE}/deployments/${deploymentId}/${action}`,
      {},
    );
  }

  /** Acknowledge an alert. */
  acknowledgeAlert(alertId: string): Observable<void> {
    return this.http.patch<void>(`${API_BASE}/alerts/${alertId}/acknowledge`, {});
  }

  /** Fetch resource alerts. */
  fetchAlerts(severity?: string): Observable<ResourceAlert[]> {
    const params: Record<string, string> = {};
    if (severity) {
      params['severity'] = severity;
    }
    return this.http.get<ResourceAlert[]>(`${API_BASE}/alerts`, { params });
  }
}
