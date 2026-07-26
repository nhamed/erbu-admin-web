import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
  DestroyRef,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  timer,
  switchMap,
  shareReplay,
  catchError,
  of,
  tap,
} from 'rxjs';

// ---------- DTOs ----------

export type SystemHealthStatus = 'healthy' | 'degraded' | 'down';
export type IndexHealthStatus = 'green' | 'yellow' | 'red';

export interface HomeKpi {
  totalDocuments: number;
  queryRatePerSecond: number;
  avgLatencyMs: number;
  indexHealth: IndexHealthStatus;
  activePipelines: number;
  errorRatePct: number;
  uptimePct: number;
  nodesOnline: number;
}

export interface RecentActivity {
  id: string;
  type: 'ingestion' | 'query' | 'alert' | 'config' | 'deploy';
  message: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error';
  module: string;
}

export interface SystemStatusEntry {
  name: string;
  status: SystemHealthStatus;
  lastChecked: string;
  message: string;
}

export interface HomeDashboard {
  kpi: HomeKpi;
  recentActivity: RecentActivity[];
  systemStatus: SystemStatusEntry[];
  lastUpdatedAt: string;
}

// ---------- Quick Links ----------

interface QuickLink {
  label: string;
  icon: string;
  route: string;
  description: string;
}

// ---------- Constants ----------

const REFRESH_INTERVAL_MS = 15_000;
const API_BASE = '/api/admin/geo-search';

@Component({
  selector: 'app-geostudio-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  // ---------- state ----------
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly lastUpdated = signal<string>('');

  readonly kpi = signal<HomeKpi>({
    totalDocuments: 0,
    queryRatePerSecond: 0,
    avgLatencyMs: 0,
    indexHealth: 'green',
    activePipelines: 0,
    errorRatePct: 0,
    uptimePct: 0,
    nodesOnline: 0,
  });

  readonly recentActivity = signal<RecentActivity[]>([]);
  readonly systemStatus = signal<SystemStatusEntry[]>([]);

  // ---------- computed ----------
  readonly kpiCards = computed(() => {
    const k = this.kpi();
    return [
      {
        label: 'Total Documents',
        value: this.formatNumber(k.totalDocuments),
        icon: 'description',
        cssClass: 'kpi-documents',
      },
      {
        label: 'Query Rate',
        value: k.queryRatePerSecond.toFixed(1),
        icon: 'query_stats',
        cssClass: 'kpi-query-rate',
        suffix: '/s',
      },
      {
        label: 'Avg Latency',
        value: k.avgLatencyMs.toFixed(0),
        icon: 'timer',
        cssClass: 'kpi-latency',
        suffix: 'ms',
      },
      {
        label: 'Index Health',
        value: k.indexHealth.toUpperCase(),
        icon: 'health_and_safety',
        cssClass: `kpi-index-${k.indexHealth}`,
      },
      {
        label: 'Active Pipelines',
        value: k.activePipelines.toString(),
        icon: 'account_tree',
        cssClass: 'kpi-pipelines',
      },
      {
        label: 'Error Rate',
        value: k.errorRatePct.toFixed(2),
        icon: 'error_outline',
        cssClass: k.errorRatePct > 1 ? 'kpi-error-high' : 'kpi-error-low',
        suffix: '%',
      },
      {
        label: 'Uptime',
        value: k.uptimePct.toFixed(2),
        icon: 'uptime',
        cssClass: 'kpi-uptime',
        suffix: '%',
      },
      {
        label: 'Nodes Online',
        value: k.nodesOnline.toString(),
        icon: 'dns',
        cssClass: 'kpi-nodes',
      },
    ];
  });

  readonly quickLinks: QuickLink[] = [
    {
      label: 'Ingestion',
      icon: 'input',
      route: '../ingestion',
      description: 'Manage data pipelines',
    },
    {
      label: 'Infrastructure',
      icon: 'dns',
      route: '../infrastructure',
      description: 'Node health & resources',
    },
    {
      label: 'Monitor',
      icon: 'monitor_heart',
      route: '../monitor',
      description: 'Query latency & alerts',
    },
    {
      label: 'Search Explorer',
      icon: 'search',
      route: '../search-explorer',
      description: 'Test search queries',
    },
    {
      label: 'Knowledge Graph',
      icon: 'hub',
      route: '../knowledge-graph',
      description: 'Entity relationships',
    },
    {
      label: 'Config',
      icon: 'settings',
      route: '../config',
      description: 'Runtime configuration',
    },
  ];

  readonly healthySystems = computed(
    () => this.systemStatus().filter((s) => s.status === 'healthy').length,
  );

  readonly totalSystems = computed(() => this.systemStatus().length);

  readonly overallHealth = computed<SystemHealthStatus>(() => {
    const statuses = this.systemStatus();
    if (statuses.length === 0) return 'healthy';
    if (statuses.some((s) => s.status === 'down')) return 'down';
    if (statuses.some((s) => s.status === 'degraded')) return 'degraded';
    return 'healthy';
  });

  // ---------- polling ----------
  private readonly dashboard$ = timer(0, REFRESH_INTERVAL_MS).pipe(
    switchMap(() => this.http.get<HomeDashboard>(`${API_BASE}/home/dashboard`)),
    tap((d) => this.applyDashboard(d)),
    catchError((err) => {
      this.error.set(err?.message ?? 'Failed to load GeoStudio dashboard');
      this.loading.set(false);
      return of(null);
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  // ---------- lifecycle ----------
  ngOnInit(): void {
    this.dashboard$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => {
          if (d) {
            this.loading.set(false);
            this.error.set(null);
          }
        },
        error: (err) => {
          this.error.set(err?.message ?? 'Failed to load dashboard');
          this.loading.set(false);
        },
      });
  }

  ngOnDestroy(): void {
    // takeUntilDestroyed handles cleanup
  }

  // ---------- template helpers ----------
  activityIcon(type: RecentActivity['type']): string {
    switch (type) {
      case 'ingestion': return 'input';
      case 'query': return 'search';
      case 'alert': return 'warning';
      case 'config': return 'settings';
      case 'deploy': return 'rocket_launch';
      default: return 'info';
    }
  }

  activityClass(severity: RecentActivity['severity']): string {
    switch (severity) {
      case 'error': return 'activity-error';
      case 'warning': return 'activity-warning';
      case 'info': return 'activity-info';
      default: return '';
    }
  }

  statusClass(status: SystemHealthStatus): string {
    switch (status) {
      case 'healthy': return 'status-healthy';
      case 'degraded': return 'status-degraded';
      case 'down': return 'status-down';
      default: return '';
    }
  }

  statusIcon(status: SystemHealthStatus): string {
    switch (status) {
      case 'healthy': return 'check_circle';
      case 'degraded': return 'warning';
      case 'down': return 'cancel';
      default: return 'help';
    }
  }

  trackByActivityId(_: number, a: RecentActivity): string {
    return a.id;
  }

  trackBySystemName(_: number, s: SystemStatusEntry): string {
    return s.name;
  }

  // ---------- private ----------
  private applyDashboard(d: HomeDashboard): void {
    this.kpi.set(d.kpi);
    this.recentActivity.set(d.recentActivity);
    this.systemStatus.set(d.systemStatus);
    this.lastUpdated.set(d.lastUpdatedAt);
    this.error.set(null);
  }

  private formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  }
}
