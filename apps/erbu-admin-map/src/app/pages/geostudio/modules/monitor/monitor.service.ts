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

export type AlertLevel = 'info' | 'warning' | 'critical';
export type AlertState = 'active' | 'acknowledged' | 'resolved';

export interface LatencyDataPoint {
  timestamp: string;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  avgMs: number;
}

export interface SlowQuery {
  id: string;
  query: string;
  durationMs: number;
  index: string;
  timestamp: string;
  resultCount: number;
  userId: string | null;
}

export interface IndexFreshness {
  indexName: string;
  documentCount: number;
  lastDocumentAt: string;
  staleSinceMinutes: number;
  sizeGb: number;
  health: 'green' | 'yellow' | 'red';
}

export interface MonitorAlert {
  id: string;
  level: AlertLevel;
  state: AlertState;
  title: string;
  message: string;
  source: string;
  metric: string;
  threshold: number;
  currentValue: number;
  triggeredAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

export interface ErrorRateBucket {
  timestamp: string;
  totalQueries: number;
  errorCount: number;
  errorRatePct: number;
}

export interface MonitorKpi {
  queryRatePerSec: number;
  avgLatencyMs: number;
  p99LatencyMs: number;
  errorRatePct: number;
  activeAlerts: number;
  slowQueriesLast5m: number;
  indexCount: number;
  staleIndexCount: number;
}

export interface MonitorDashboard {
  kpi: MonitorKpi;
  latencyHistory: LatencyDataPoint[];
  errorRateHistory: ErrorRateBucket[];
  slowQueries: SlowQuery[];
  indexFreshness: IndexFreshness[];
  alerts: MonitorAlert[];
  lastUpdatedAt: string;
}

export interface AlertConfig {
  id: string;
  name: string;
  metric: string;
  operator: 'gt' | 'lt' | 'eq';
  threshold: number;
  windowMinutes: number;
  level: AlertLevel;
  enabled: boolean;
}

// ---------- SignalR Live Events ----------

export interface LiveQueryMetric {
  timestamp: string;
  queryRatePerSec: number;
  avgLatencyMs: number;
  p99LatencyMs: number;
  errorRatePct: number;
}

export interface LiveAlertEvent {
  alertId: string;
  level: AlertLevel;
  title: string;
  message: string;
  timestamp: string;
}

// ---------- Service ----------

const REFRESH_INTERVAL_MS = 10_000;
const API_BASE = '/api/admin/geo-search/monitor';
const HUB_URL = '/hubs/search-ops';

@Injectable({ providedIn: 'root' })
export class MonitorService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private hubConnection: import('@microsoft/signalr').HubConnection | null = null;
  private readonly destroy$ = new Subject<void>();

  // ---------- state signals ----------
  readonly kpi = signal<MonitorKpi>({
    queryRatePerSec: 0, avgLatencyMs: 0, p99LatencyMs: 0,
    errorRatePct: 0, activeAlerts: 0, slowQueriesLast5m: 0,
    indexCount: 0, staleIndexCount: 0,
  });
  readonly latencyHistory = signal<LatencyDataPoint[]>([]);
  readonly errorRateHistory = signal<ErrorRateBucket[]>([]);
  readonly slowQueries = signal<SlowQuery[]>([]);
  readonly indexFreshness = signal<IndexFreshness[]>([]);
  readonly alerts = signal<MonitorAlert[]>([]);
  readonly alertConfigs = signal<AlertConfig[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly hubConnected = signal(false);

  // Live signals
  readonly liveQueryMetrics = signal<LiveQueryMetric[]>([]);
  readonly liveAlertEvents = signal<LiveAlertEvent[]>([]);

  // ---------- computed ----------
  readonly activeAlerts = computed(
    () => this.alerts().filter((a) => a.state === 'active'),
  );

  readonly criticalAlerts = computed(
    () => this.alerts().filter((a) => a.level === 'critical' && a.state === 'active'),
  );

  readonly staleIndices = computed(
    () => this.indexFreshness().filter((i) => i.staleSinceMinutes > 30),
  );

  readonly latencyChartData = computed(() => {
    const history = this.latencyHistory();
    return {
      timestamps: history.map((d) => d.timestamp),
      p50: history.map((d) => d.p50Ms),
      p95: history.map((d) => d.p95Ms),
      p99: history.map((d) => d.p99Ms),
      avg: history.map((d) => d.avgMs),
    };
  });

  readonly errorRateChartData = computed(() => {
    const history = this.errorRateHistory();
    return {
      timestamps: history.map((d) => d.timestamp),
      errorRate: history.map((d) => d.errorRatePct),
      totalQueries: history.map((d) => d.totalQueries),
    };
  });

  // ---------- polling ----------
  readonly dashboard$: Observable<MonitorDashboard> = timer(
    0,
    REFRESH_INTERVAL_MS,
  ).pipe(
    switchMap(() => this.http.get<MonitorDashboard>(`${API_BASE}/dashboard`)),
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

      // Live query metrics
      this.hubConnection.on('QueryMetricUpdate', (metric: LiveQueryMetric) => {
        this.liveQueryMetrics.update((list) => [...list, metric].slice(-300));

        // Also append to latency history for chart
        this.latencyHistory.update((list) => [
          ...list,
          {
            timestamp: metric.timestamp,
            p50Ms: metric.avgLatencyMs * 0.7,
            p95Ms: metric.avgLatencyMs * 1.5,
            p99Ms: metric.p99LatencyMs,
            avgMs: metric.avgLatencyMs,
          },
        ].slice(-200));

        // Update KPI in real-time
        this.kpi.update((k) => ({
          ...k,
          queryRatePerSec: metric.queryRatePerSec,
          avgLatencyMs: metric.avgLatencyMs,
          p99LatencyMs: metric.p99LatencyMs,
          errorRatePct: metric.errorRatePct,
        }));
      });

      // Live alert events
      this.hubConnection.on('AlertTriggered', (event: LiveAlertEvent) => {
        this.liveAlertEvents.update((list) => [event, ...list].slice(0, 50));
      });

      this.hubConnection.onreconnecting(() => this.hubConnected.set(false));
      this.hubConnection.onreconnected(() => this.hubConnected.set(true));
      this.hubConnection.onclose(() => this.hubConnected.set(false));

      await this.hubConnection.start();
      this.hubConnected.set(true);
    } catch {
      this.hubConnected.set(false);
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

  // ---------- REST commands ----------
  loadDashboard(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http
      .get<MonitorDashboard>(`${API_BASE}/dashboard`)
      .pipe(
        tap((d) => this.applyDashboard(d)),
        catchError((err) => {
          this.error.set('Failed to load monitor dashboard.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  acknowledgeAlert(alertId: string): Observable<void> {
    return this.http
      .post<void>(`${API_BASE}/alerts/${alertId}/acknowledge`, {})
      .pipe(
        tap(() => {
          this.alerts.update((list) =>
            list.map((a) =>
              a.id === alertId
                ? { ...a, state: 'acknowledged' as AlertState, acknowledgedAt: new Date().toISOString() }
                : a,
            ),
          );
        }),
        catchError((err) => {
          this.error.set('Failed to acknowledge alert.');
          return throwError(() => err);
        }),
      );
  }

  fetchAlertConfigs(): Observable<AlertConfig[]> {
    return this.http.get<AlertConfig[]>(`${API_BASE}/alert-configs`).pipe(
      tap((configs) => this.alertConfigs.set(configs)),
    );
  }

  updateAlertConfig(config: AlertConfig): Observable<AlertConfig> {
    return this.http.put<AlertConfig>(
      `${API_BASE}/alert-configs/${config.id}`,
      config,
    ).pipe(
      tap((updated) => {
        this.alertConfigs.update((list) =>
          list.map((c) => (c.id === updated.id ? updated : c)),
        );
      }),
    );
  }

  fetchSlowQueries(limit = 50): Observable<SlowQuery[]> {
    return this.http.get<SlowQuery[]>(`${API_BASE}/slow-queries`, {
      params: { limit: limit.toString() },
    });
  }

  clearError(): void {
    this.error.set(null);
  }

  // ---------- private ----------
  private applyDashboard(d: MonitorDashboard): void {
    this.kpi.set(d.kpi);
    this.latencyHistory.set(d.latencyHistory);
    this.errorRateHistory.set(d.errorRateHistory);
    this.slowQueries.set(d.slowQueries);
    this.indexFreshness.set(d.indexFreshness);
    this.alerts.set(d.alerts);
    this.error.set(null);
  }

  private getAccessToken(): string {
    return '';
  }

}
