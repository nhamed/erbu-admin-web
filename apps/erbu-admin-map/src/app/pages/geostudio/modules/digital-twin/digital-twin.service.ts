import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  Observable,
  timer,
  switchMap,
  shareReplay,
  catchError,
  throwError,
  tap,
  finalize,
} from 'rxjs';

// ---------- DTOs ----------

export type TwinStatus = 'Active' | 'Paused' | 'Disabled' | 'Error';
export type DivergenceLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export interface DigitalTwinConfig {
  id: string;
  name: string;
  sourceEnvironment: string;
  targetEnvironment: string;
  isShadowMode: boolean;
  trafficPercentage: number;
  comparisonMetrics: string[];
  divergenceThreshold: number;
  isActive: boolean;
  status: TwinStatus;
  createdAt: string;
  updatedAt: string;
  lastSyncAt: string | null;
  divergenceCount: number;
  matchRate: number;
  totalComparisons: number;
}

export interface TrafficComparison {
  timestamp: string;
  liveRequestCount: number;
  shadowRequestCount: number;
  liveAvgLatencyMs: number;
  shadowAvgLatencyMs: number;
  liveErrorRate: number;
  shadowErrorRate: number;
  matchRate: number;
  divergenceCount: number;
}

export interface DivergenceMetric {
  timestamp: string;
  metricName: string;
  liveValue: number;
  shadowValue: number;
  delta: number;
  deltaPercent: number;
  level: DivergenceLevel;
}

export interface DivergenceDetail {
  id: string;
  queryText: string;
  executedAt: string;
  liveResultCount: number;
  shadowResultCount: number;
  resultCountDelta: number;
  liveLatencyMs: number;
  shadowLatencyMs: number;
  latencyDelta: number;
  topLiveDocs: string[];
  topShadowDocs: string[];
  overlapPercent: number;
  divergenceLevel: DivergenceLevel;
}

export interface ShadowQueryResult {
  id: string;
  queryText: string;
  executedAt: string;
  liveResults: ShadowResultEntry[];
  shadowResults: ShadowResultEntry[];
  liveLatencyMs: number;
  shadowLatencyMs: number;
  overlapPercent: number;
  positionChanges: ShadowPositionChange[];
}

export interface ShadowResultEntry {
  documentId: string;
  title: string;
  score: number;
  position: number;
}

export interface ShadowPositionChange {
  documentId: string;
  title: string;
  livePosition: number;
  shadowPosition: number;
  delta: number;
}

export interface TwinDashboard {
  configs: DigitalTwinConfig[];
  trafficComparisons: TrafficComparison[];
  divergenceMetrics: DivergenceMetric[];
  recentDivergences: DivergenceDetail[];
  lastUpdatedAt: string;
}

export interface TwinKpi {
  activeTwins: number;
  totalComparisons: number;
  avgMatchRate: number;
  avgLatencyDelta: number;
  criticalDivergences: number;
  shadowTrafficPercent: number;
}

// ---------- Service ----------

const API_BASE = '/api/geo/digital-twin';
const REFRESH_INTERVAL_MS = 15_000;

@Injectable({ providedIn: 'root' })
export class DigitalTwinService {
  private readonly http = inject(HttpClient);

  // ---------- state signals ----------
  readonly configs = signal<DigitalTwinConfig[]>([]);
  readonly selectedConfig = signal<DigitalTwinConfig | null>(null);
  readonly trafficComparisons = signal<TrafficComparison[]>([]);
  readonly divergenceMetrics = signal<DivergenceMetric[]>([]);
  readonly recentDivergences = signal<DivergenceDetail[]>([]);
  readonly shadowQueries = signal<ShadowQueryResult[]>([]);
  readonly selectedDivergence = signal<DivergenceDetail | null>(null);
  readonly selectedShadowQuery = signal<ShadowQueryResult | null>(null);
  readonly kpi = signal<TwinKpi>({
    activeTwins: 0,
    totalComparisons: 0,
    avgMatchRate: 0,
    avgLatencyDelta: 0,
    criticalDivergences: 0,
    shadowTrafficPercent: 0,
  });
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly lastUpdatedAt = signal('');

  // view state
  readonly activeTab = signal<'overview' | 'traffic' | 'divergence' | 'queries'>('overview');

  // ---------- computed ----------
  readonly activeTwins = computed(
    () => this.configs().filter((c) => c.isActive),
  );

  readonly pausedTwins = computed(
    () => this.configs().filter((c) => c.status === 'Paused'),
  );

  readonly errorTwins = computed(
    () => this.configs().filter((c) => c.status === 'Error'),
  );

  readonly criticalDivergences = computed(
    () => this.recentDivergences().filter((d) => d.divergenceLevel === 'Critical'),
  );

  readonly avgMatchRate = computed(() => {
    const configs = this.configs();
    if (configs.length === 0) return 0;
    return configs.reduce((sum, c) => sum + c.matchRate, 0) / configs.length;
  });

  readonly kpiCards = computed(() => {
    const k = this.kpi();
    return [
      { label: 'Active Twins', value: k.activeTwins.toString(), icon: 'content_copy', cssClass: 'kpi-active' },
      { label: 'Comparisons', value: this.formatNumber(k.totalComparisons), icon: 'compare_arrows', cssClass: 'kpi-comparisons' },
      { label: 'Match Rate', value: k.avgMatchRate.toFixed(1), icon: 'check_circle', cssClass: k.avgMatchRate > 90 ? 'kpi-match-good' : 'kpi-match-warn', suffix: '%' },
      { label: 'Avg Latency Delta', value: k.avgLatencyDelta.toFixed(1), icon: 'timer', cssClass: 'kpi-latency', suffix: 'ms' },
      { label: 'Critical Divergences', value: k.criticalDivergences.toString(), icon: 'warning', cssClass: k.criticalDivergences > 0 ? 'kpi-critical' : 'kpi-ok' },
      { label: 'Shadow Traffic', value: k.shadowTrafficPercent.toFixed(0), icon: 'traffic', cssClass: 'kpi-traffic', suffix: '%' },
    ];
  });

  // ---------- polling ----------
  readonly dashboard$: Observable<TwinDashboard> = timer(0, REFRESH_INTERVAL_MS).pipe(
    switchMap(() => this.http.get<TwinDashboard>(`${API_BASE}/dashboard`)),
    tap((d) => this.applyDashboard(d)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  // ---------- commands ----------

  /** Load the full dashboard. */
  loadDashboard(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http
      .get<TwinDashboard>(`${API_BASE}/dashboard`)
      .pipe(
        tap((d) => this.applyDashboard(d)),
        catchError((err) => {
          this.error.set('Failed to load digital twin dashboard.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  /** Load traffic comparison data for a config. */
  loadTrafficComparisons(configId: string, from: string, to: string): void {
    const params = new HttpParams()
      .set('from', from)
      .set('to', to);

    this.http
      .get<TrafficComparison[]>(`${API_BASE}/configs/${configId}/traffic`, { params })
      .pipe(
        tap((data) => this.trafficComparisons.set(data)),
        catchError((err) => {
          this.error.set('Failed to load traffic comparisons.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  /** Load divergence metrics for a config. */
  loadDivergenceMetrics(configId: string, from: string, to: string): void {
    const params = new HttpParams()
      .set('from', from)
      .set('to', to);

    this.http
      .get<DivergenceMetric[]>(`${API_BASE}/configs/${configId}/divergence`, { params })
      .pipe(
        tap((data) => this.divergenceMetrics.set(data)),
        catchError((err) => {
          this.error.set('Failed to load divergence metrics.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  /** Load shadow query results for inspection. */
  loadShadowQueries(configId: string, limit = 20): void {
    const params = new HttpParams().set('limit', limit.toString());

    this.http
      .get<ShadowQueryResult[]>(`${API_BASE}/configs/${configId}/shadow-queries`, { params })
      .pipe(
        tap((data) => this.shadowQueries.set(data)),
        catchError((err) => {
          this.error.set('Failed to load shadow queries.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  /** Load a single twin config. */
  loadConfig(configId: string): Observable<DigitalTwinConfig> {
    return this.http.get<DigitalTwinConfig>(`${API_BASE}/configs/${configId}`).pipe(
      tap((cfg) => this.selectedConfig.set(cfg)),
      catchError((err) => {
        this.error.set('Failed to load twin configuration.');
        return throwError(() => err);
      }),
    );
  }

  // ---------- selection ----------

  selectConfig(config: DigitalTwinConfig | null): void {
    this.selectedConfig.set(config);
    if (config) {
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      this.loadTrafficComparisons(config.id, dayAgo.toISOString(), now.toISOString());
      this.loadDivergenceMetrics(config.id, dayAgo.toISOString(), now.toISOString());
      this.loadShadowQueries(config.id);
    }
  }

  selectDivergence(divergence: DivergenceDetail | null): void {
    this.selectedDivergence.set(divergence);
  }

  selectShadowQuery(query: ShadowQueryResult | null): void {
    this.selectedShadowQuery.set(query);
  }

  setTab(tab: 'overview' | 'traffic' | 'divergence' | 'queries'): void {
    this.activeTab.set(tab);
  }

  clearError(): void {
    this.error.set(null);
  }

  // ---------- helpers ----------

  statusClass(status: TwinStatus): string {
    switch (status) {
      case 'Active': return 'status-active';
      case 'Paused': return 'status-paused';
      case 'Disabled': return 'status-disabled';
      case 'Error': return 'status-error';
      default: return '';
    }
  }

  divergenceClass(level: DivergenceLevel): string {
    switch (level) {
      case 'Low': return 'divergence-low';
      case 'Medium': return 'divergence-medium';
      case 'High': return 'divergence-high';
      case 'Critical': return 'divergence-critical';
      default: return '';
    }
  }

  // ---------- private ----------
  private applyDashboard(d: TwinDashboard): void {
    this.configs.set(d.configs);
    this.trafficComparisons.set(d.trafficComparisons);
    this.divergenceMetrics.set(d.divergenceMetrics);
    this.recentDivergences.set(d.recentDivergences);
    this.lastUpdatedAt.set(d.lastUpdatedAt);
    this.computeKpi(d);
    this.error.set(null);
  }

  private computeKpi(d: TwinDashboard): void {
    const active = d.configs.filter((c) => c.isActive);
    const totalComparisons = d.configs.reduce((s, c) => s + c.totalComparisons, 0);
    const avgMatch = active.length > 0
      ? active.reduce((s, c) => s + c.matchRate, 0) / active.length
      : 0;
    const avgLatDelta = d.trafficComparisons.length > 0
      ? d.trafficComparisons.reduce((s, t) => s + Math.abs(t.shadowAvgLatencyMs - t.liveAvgLatencyMs), 0) / d.trafficComparisons.length
      : 0;
    const critDiv = d.recentDivergences.filter((dv) => dv.divergenceLevel === 'Critical').length;
    const avgTraffic = active.length > 0
      ? active.reduce((s, c) => s + c.trafficPercentage, 0) / active.length
      : 0;

    this.kpi.set({
      activeTwins: active.length,
      totalComparisons,
      avgMatchRate: avgMatch,
      avgLatencyDelta: avgLatDelta,
      criticalDivergences: critDiv,
      shadowTrafficPercent: avgTraffic,
    });
  }

  private formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  }
}
