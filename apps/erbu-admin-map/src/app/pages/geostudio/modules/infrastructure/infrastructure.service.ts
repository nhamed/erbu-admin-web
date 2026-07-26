import { Injectable, inject, signal, computed, OnDestroy, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
  Subject,
} from 'rxjs';

// ---------- DTOs ----------

export type NodeHealthStatus = 'online' | 'degraded' | 'offline' | 'maintenance';
export type CacheHealth = 'healthy' | 'degraded' | 'down';

export interface InfraNode {
  id: string;
  hostname: string;
  ipAddress: string;
  role: string;
  status: NodeHealthStatus;
  cpuUsagePct: number;
  memoryUsagePct: number;
  memoryTotalGb: number;
  memoryUsedGb: number;
  diskUsagePct: number;
  diskTotalGb: number;
  diskUsedGb: number;
  networkInMbps: number;
  networkOutMbps: number;
  uptimeSeconds: number;
  lastSeen: string;
  shardCount: number;
  replicaCount: number;
}

export interface CacheStats {
  totalKeys: number;
  hitRate: number;
  missRate: number;
  memoryUsedMb: number;
  memoryMaxMb: number;
  evictions: number;
  connectedClients: number;
  health: CacheHealth;
}

export interface IndexStats {
  totalIndices: number;
  totalDocuments: number;
  totalSizeGb: number;
  avgQueryLatencyMs: number;
  activeShards: number;
  relocatingShards: number;
  initializingShards: number;
  unassignedShards: number;
}

export type ClusterHealth = 'green' | 'yellow' | 'red';

export interface ClusterStatus {
  clusterName: string;
  health: ClusterHealth;
  numberOfNodes: number;
  activeShards: number;
  relocatingShards: number;
  pendingTasks: number;
  upSince: string;
}

export interface InfraKpi {
  totalNodes: number;
  nodesOnline: number;
  nodesDegraded: number;
  nodesOffline: number;
  avgCpuPct: number;
  avgMemoryPct: number;
  avgDiskPct: number;
  totalNetworkInMbps: number;
  totalNetworkOutMbps: number;
}

export interface InfrastructureDashboard {
  kpi: InfraKpi;
  nodes: InfraNode[];
  cache: CacheStats;
  index: IndexStats;
  cluster: ClusterStatus;
  lastUpdatedAt: string;
}

// ---------- SignalR Live Events ----------

export interface LiveMetricUpdate {
  nodeId: string;
  cpuUsagePct: number;
  memoryUsagePct: number;
  diskUsagePct: number;
  networkInMbps: number;
  networkOutMbps: number;
  timestamp: string;
}

export interface LiveNodeStatusChange {
  nodeId: string;
  previousStatus: NodeHealthStatus;
  newStatus: NodeHealthStatus;
  reason: string;
  timestamp: string;
}

export interface LiveIngestionProgress {
  pipelineId: string;
  pipelineName: string;
  documentsProcessed: number;
  documentsTotal: number;
  bytesProcessed: number;
  progressPct: number;
  estimatedCompletionAt: string | null;
  timestamp: string;
}

// ---------- Service ----------

const REFRESH_INTERVAL_MS = 15_000;
const API_BASE = '/api/admin/geo-search/infrastructure';
const HUB_URL = '/hubs/ingestion';

@Injectable({ providedIn: 'root' })
export class GeoInfrastructureService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private hubConnection: import('@microsoft/signalr').HubConnection | null = null;
  private readonly destroy$ = new Subject<void>();

  // ---------- state signals ----------
  readonly nodes = signal<InfraNode[]>([]);
  readonly cache = signal<CacheStats>({
    totalKeys: 0, hitRate: 0, missRate: 0,
    memoryUsedMb: 0, memoryMaxMb: 0, evictions: 0,
    connectedClients: 0, health: 'healthy',
  });
  readonly index = signal<IndexStats>({
    totalIndices: 0, totalDocuments: 0, totalSizeGb: 0,
    avgQueryLatencyMs: 0, activeShards: 0, relocatingShards: 0,
    initializingShards: 0, unassignedShards: 0,
  });
  readonly cluster = signal<ClusterStatus>({
    clusterName: '', health: 'green', numberOfNodes: 0,
    activeShards: 0, relocatingShards: 0, pendingTasks: 0, upSince: '',
  });
  readonly kpi = signal<InfraKpi>({
    totalNodes: 0, nodesOnline: 0, nodesDegraded: 0, nodesOffline: 0,
    avgCpuPct: 0, avgMemoryPct: 0, avgDiskPct: 0,
    totalNetworkInMbps: 0, totalNetworkOutMbps: 0,
  });
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly hubConnected = signal(false);

  // Live update signals
  readonly liveMetrics = signal<LiveMetricUpdate[]>([]);
  readonly liveStatusChanges = signal<LiveNodeStatusChange[]>([]);
  readonly liveIngestionProgress = signal<LiveIngestionProgress[]>([]);

  // ---------- computed ----------
  readonly onlineNodes = computed(
    () => this.nodes().filter((n) => n.status === 'online'),
  );

  readonly degradedNodes = computed(
    () => this.nodes().filter((n) => n.status === 'degraded'),
  );

  readonly offlineNodes = computed(
    () => this.nodes().filter((n) => n.status === 'offline'),
  );

  readonly clusterHealthClass = computed(() => {
    switch (this.cluster().health) {
      case 'green': return 'health-green';
      case 'yellow': return 'health-yellow';
      case 'red': return 'health-red';
      default: return '';
    }
  });

  readonly cacheUtilizationPct = computed(() => {
    const c = this.cache();
    return c.memoryMaxMb > 0
      ? Math.round((c.memoryUsedMb / c.memoryMaxMb) * 100)
      : 0;
  });

  // ---------- polling ----------
  readonly dashboard$: Observable<InfrastructureDashboard> = timer(
    0,
    REFRESH_INTERVAL_MS,
  ).pipe(
    switchMap(() => this.http.get<InfrastructureDashboard>(`${API_BASE}/dashboard`)),
    tap((d) => this.applyDashboard(d)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  // ---------- SignalR ----------
  async connectHub(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    if (this.hubConnection) return;

    try {
      const signalR = await import('@microsoft/signalr');

      this.hubConnection = new signalR.HubConnectionBuilder()
        .withUrl(HUB_URL, {
          accessTokenFactory: () => this.getAccessToken(),
        })
        .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
        .configureLogging(signalR.LogLevel.Warning)
        .build();

      // Register handlers
      this.hubConnection.on('MetricUpdate', (update: LiveMetricUpdate) => {
        this.liveMetrics.update((list) => {
          const filtered = list.filter((m) => m.nodeId !== update.nodeId);
          return [...filtered, update].slice(-50);
        });
        // Also update node in-place
        this.nodes.update((nodes) =>
          nodes.map((n) =>
            n.id === update.nodeId
              ? {
                  ...n,
                  cpuUsagePct: update.cpuUsagePct,
                  memoryUsagePct: update.memoryUsagePct,
                  diskUsagePct: update.diskUsagePct,
                  networkInMbps: update.networkInMbps,
                  networkOutMbps: update.networkOutMbps,
                }
              : n,
          ),
        );
      });

      this.hubConnection.on('NodeStatusChanged', (change: LiveNodeStatusChange) => {
        this.liveStatusChanges.update((list) => [change, ...list].slice(0, 100));
        this.nodes.update((nodes) =>
          nodes.map((n) =>
            n.id === change.nodeId ? { ...n, status: change.newStatus } : n,
          ),
        );
      });

      this.hubConnection.on('IngestionProgress', (progress: LiveIngestionProgress) => {
        this.liveIngestionProgress.update((list) => {
          const filtered = list.filter((p) => p.pipelineId !== progress.pipelineId);
          return [progress, ...filtered].slice(0, 20);
        });
      });

      this.hubConnection.onreconnecting(() => this.hubConnected.set(false));
      this.hubConnection.onreconnected(() => this.hubConnected.set(true));
      this.hubConnection.onclose(() => this.hubConnected.set(false));

      await this.hubConnection.start();
      this.hubConnected.set(true);
    } catch {
      this.hubConnected.set(false);
      // SignalR unavailable -- degrade to polling only
    }
  }

  async disconnectHub(): Promise<void> {
    if (this.hubConnection) {
      await this.hubConnection.stop();
      this.hubConnection = null;
      this.hubConnected.set(false);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.disconnectHub();
  }

  // ---------- commands ----------
  loadDashboard(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http
      .get<InfrastructureDashboard>(`${API_BASE}/dashboard`)
      .pipe(
        tap((d) => this.applyDashboard(d)),
        catchError((err) => {
          this.error.set('Failed to load infrastructure dashboard.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  deleteCache(key?: string): Observable<{ success: boolean; message: string }> {
    const url = key
      ? `${API_BASE}/cache/${encodeURIComponent(key)}`
      : `${API_BASE}/cache`;
    return this.http.delete<{ success: boolean; message: string }>(url);
  }

  runQualityCheck(): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${API_BASE}/quality/run`,
      {},
    );
  }

  runCleanup(): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${API_BASE}/cleanup`,
      {},
    );
  }

  fetchNodes(): Observable<InfraNode[]> {
    return this.http.get<InfraNode[]>(`${API_BASE}/nodes`);
  }

  clearError(): void {
    this.error.set(null);
  }

  // ---------- private ----------
  private applyDashboard(d: InfrastructureDashboard): void {
    this.kpi.set(d.kpi);
    this.nodes.set(d.nodes);
    this.cache.set(d.cache);
    this.index.set(d.index);
    this.cluster.set(d.cluster);
    this.error.set(null);
  }

  private getAccessToken(): string {
    // OIDC token retrieval -- placeholder for integration
    // In production, inject OAuthService or AuthService
    return '';
  }

}
