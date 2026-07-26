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
  afterNextRender,
  effect,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  MonitorService,
  SlowQuery,
  IndexFreshness,
  MonitorAlert,
  AlertLevel,
  AlertState,
  AlertConfig,
  LiveAlertEvent,
} from './monitor.service';

type EChartsInstance = {
  setOption(option: unknown, notMerge?: boolean): void;
  resize(): void;
  dispose(): void;
};

@Component({
  selector: 'app-geostudio-monitor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './monitor.component.html',
  styleUrl: './monitor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MonitorComponent implements OnInit, OnDestroy {
  private readonly svc = inject(MonitorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  // ---------- state ----------
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly lastUpdated = signal<string>('');
  readonly showAlertConfig = signal(false);
  readonly alertConfigLoading = signal(false);
  readonly activeTab = signal<'latency' | 'errors' | 'slow' | 'freshness' | 'alerts'>('latency');

  // delegated
  readonly kpi = this.svc.kpi;
  readonly slowQueries = this.svc.slowQueries;
  readonly indexFreshness = this.svc.indexFreshness;
  readonly alerts = this.svc.alerts;
  readonly activeAlerts = this.svc.activeAlerts;
  readonly criticalAlerts = this.svc.criticalAlerts;
  readonly staleIndices = this.svc.staleIndices;
  readonly alertConfigs = this.svc.alertConfigs;
  readonly hubConnected = this.svc.hubConnected;
  readonly liveAlertEvents = this.svc.liveAlertEvents;

  // ---------- computed ----------
  readonly kpiCards = computed(() => {
    const k = this.kpi();
    return [
      { label: 'Query Rate', value: k.queryRatePerSec.toFixed(1), icon: 'query_stats', cssClass: 'kpi-rate', suffix: '/s' },
      { label: 'Avg Latency', value: k.avgLatencyMs.toFixed(0), icon: 'timer', cssClass: 'kpi-avg-latency', suffix: 'ms' },
      { label: 'P99 Latency', value: k.p99LatencyMs.toFixed(0), icon: 'trending_up', cssClass: 'kpi-p99', suffix: 'ms' },
      { label: 'Error Rate', value: k.errorRatePct.toFixed(2), icon: 'error_outline', cssClass: k.errorRatePct > 1 ? 'kpi-error-high' : 'kpi-error-low', suffix: '%' },
      { label: 'Active Alerts', value: k.activeAlerts, icon: 'notifications_active', cssClass: k.activeAlerts > 0 ? 'kpi-alerts-active' : 'kpi-alerts-none' },
      { label: 'Slow Queries (5m)', value: k.slowQueriesLast5m, icon: 'hourglass_bottom', cssClass: 'kpi-slow' },
      { label: 'Indices', value: k.indexCount, icon: 'inventory_2', cssClass: 'kpi-indices' },
      { label: 'Stale Indices', value: k.staleIndexCount, icon: 'schedule', cssClass: k.staleIndexCount > 0 ? 'kpi-stale-warn' : 'kpi-stale-ok' },
    ];
  });

  readonly tabs = [
    { key: 'latency' as const, label: 'Latency', icon: 'show_chart' },
    { key: 'errors' as const, label: 'Error Rate', icon: 'error_outline' },
    { key: 'slow' as const, label: 'Slow Queries', icon: 'hourglass_bottom' },
    { key: 'freshness' as const, label: 'Index Freshness', icon: 'schedule' },
    { key: 'alerts' as const, label: 'Alerts', icon: 'notifications' },
  ];

  // ---------- ECharts ----------
  private latencyChart: EChartsInstance | null = null;
  private errorRateChart: EChartsInstance | null = null;
  private resizeHandler = () => {
    this.latencyChart?.resize();
    this.errorRateChart?.resize();
  };

  // ---------- lifecycle ----------
  constructor() {
    // Reactive chart updates via effect
    effect(() => {
      const data = this.svc.latencyChartData();
      if (this.latencyChart && data.timestamps.length > 0) {
        this.updateLatencyChart(data);
      }
    });

    effect(() => {
      const data = this.svc.errorRateChartData();
      if (this.errorRateChart && data.timestamps.length > 0) {
        this.updateErrorRateChart(data);
      }
    });
  }

  ngOnInit(): void {
    this.svc.dashboard$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.lastUpdated.set(new Date().toLocaleTimeString());
          this.loading.set(false);
          this.error.set(null);
        },
        error: (err) => {
          this.error.set(err?.message ?? 'Failed to load monitor data');
          this.loading.set(false);
        },
      });

    // Connect SignalR
    this.svc.connectHub();

    // Init charts after render
    if (isPlatformBrowser(this.platformId)) {
      afterNextRender(() => {
        this.initCharts();
      }, { injector: undefined! });
    }
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    this.latencyChart?.dispose();
    this.errorRateChart?.dispose();
    this.latencyChart = null;
    this.errorRateChart = null;
    this.svc.disconnectHub();
  }

  // ---------- chart init ----------
  private async initCharts(): Promise<void> {
    try {
      const echarts = await import('echarts/core');
      const { LineChart, BarChart } = await import('echarts/charts');
      const { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent } =
        await import('echarts/components');
      const { CanvasRenderer } = await import('echarts/renderers');

      echarts.use([
        LineChart, BarChart, GridComponent, TooltipComponent,
        LegendComponent, DataZoomComponent, CanvasRenderer,
      ]);

      const latencyEl = document.getElementById('latency-chart');
      if (latencyEl) {
        this.latencyChart = echarts.init(latencyEl, 'dark') as unknown as EChartsInstance;
      }

      const errorEl = document.getElementById('error-rate-chart');
      if (errorEl) {
        this.errorRateChart = echarts.init(errorEl, 'dark') as unknown as EChartsInstance;
      }

      window.addEventListener('resize', this.resizeHandler);

      // Initial render
      const latencyData = this.svc.latencyChartData();
      if (latencyData.timestamps.length > 0) {
        this.updateLatencyChart(latencyData);
      }

      const errorData = this.svc.errorRateChartData();
      if (errorData.timestamps.length > 0) {
        this.updateErrorRateChart(errorData);
      }
    } catch {
      // ECharts unavailable -- degrade silently
    }
  }

  private updateLatencyChart(data: {
    timestamps: string[];
    p50: number[];
    p95: number[];
    p99: number[];
    avg: number[];
  }): void {
    this.latencyChart?.setOption(
      {
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#222632',
          borderColor: '#2e3347',
          textStyle: { color: '#e4e6ed', fontSize: 12 },
        },
        legend: {
          data: ['P50', 'P95', 'P99', 'Avg'],
          textStyle: { color: '#9ca3b4' },
          top: 8,
        },
        grid: { left: 50, right: 20, top: 48, bottom: 60 },
        dataZoom: [
          { type: 'inside', start: 70, end: 100 },
          { type: 'slider', start: 70, end: 100, height: 20, bottom: 8 },
        ],
        xAxis: {
          type: 'category',
          data: data.timestamps,
          axisLabel: { color: '#6b7280', fontSize: 10 },
          axisLine: { lineStyle: { color: '#2e3347' } },
        },
        yAxis: {
          type: 'value',
          name: 'ms',
          nameTextStyle: { color: '#6b7280' },
          axisLabel: { color: '#6b7280' },
          splitLine: { lineStyle: { color: '#1a1d27' } },
        },
        series: [
          { name: 'P50', type: 'line', data: data.p50, smooth: true, lineStyle: { width: 1.5 }, itemStyle: { color: '#22c55e' }, symbol: 'none' },
          { name: 'P95', type: 'line', data: data.p95, smooth: true, lineStyle: { width: 1.5 }, itemStyle: { color: '#eab308' }, symbol: 'none' },
          { name: 'P99', type: 'line', data: data.p99, smooth: true, lineStyle: { width: 2 }, itemStyle: { color: '#ef4444' }, symbol: 'none' },
          { name: 'Avg', type: 'line', data: data.avg, smooth: true, lineStyle: { width: 1.5, type: 'dashed' }, itemStyle: { color: '#3b82f6' }, symbol: 'none' },
        ],
      },
      true,
    );
  }

  private updateErrorRateChart(data: {
    timestamps: string[];
    errorRate: number[];
    totalQueries: number[];
  }): void {
    this.errorRateChart?.setOption(
      {
        tooltip: {
          trigger: 'axis',
          backgroundColor: '#222632',
          borderColor: '#2e3347',
          textStyle: { color: '#e4e6ed', fontSize: 12 },
        },
        legend: {
          data: ['Error Rate %', 'Total Queries'],
          textStyle: { color: '#9ca3b4' },
          top: 8,
        },
        grid: { left: 50, right: 50, top: 48, bottom: 60 },
        dataZoom: [
          { type: 'inside', start: 70, end: 100 },
          { type: 'slider', start: 70, end: 100, height: 20, bottom: 8 },
        ],
        xAxis: {
          type: 'category',
          data: data.timestamps,
          axisLabel: { color: '#6b7280', fontSize: 10 },
          axisLine: { lineStyle: { color: '#2e3347' } },
        },
        yAxis: [
          {
            type: 'value',
            name: '%',
            nameTextStyle: { color: '#6b7280' },
            axisLabel: { color: '#6b7280' },
            splitLine: { lineStyle: { color: '#1a1d27' } },
          },
          {
            type: 'value',
            name: 'Queries',
            nameTextStyle: { color: '#6b7280' },
            axisLabel: { color: '#6b7280' },
            splitLine: { show: false },
          },
        ],
        series: [
          {
            name: 'Error Rate %',
            type: 'line',
            data: data.errorRate,
            smooth: true,
            lineStyle: { width: 2 },
            itemStyle: { color: '#ef4444' },
            areaStyle: { color: 'rgba(239, 68, 68, 0.1)' },
            symbol: 'none',
          },
          {
            name: 'Total Queries',
            type: 'bar',
            yAxisIndex: 1,
            data: data.totalQueries,
            itemStyle: { color: 'rgba(59, 130, 246, 0.3)' },
            barWidth: '60%',
          },
        ],
      },
      true,
    );
  }

  // ---------- actions ----------
  setTab(tab: 'latency' | 'errors' | 'slow' | 'freshness' | 'alerts'): void {
    this.activeTab.set(tab);
    // Resize charts when switching back to chart tabs
    if (tab === 'latency') {
      setTimeout(() => this.latencyChart?.resize(), 50);
    } else if (tab === 'errors') {
      setTimeout(() => this.errorRateChart?.resize(), 50);
    }
  }

  acknowledgeAlert(alertId: string): void {
    this.svc.acknowledgeAlert(alertId).subscribe();
  }

  openAlertConfig(): void {
    this.showAlertConfig.set(true);
    this.alertConfigLoading.set(true);
    this.svc.fetchAlertConfigs().subscribe({
      next: () => this.alertConfigLoading.set(false),
      error: () => this.alertConfigLoading.set(false),
    });
  }

  closeAlertConfig(): void {
    this.showAlertConfig.set(false);
  }

  toggleAlertConfigEnabled(config: AlertConfig): void {
    const updated = { ...config, enabled: !config.enabled };
    this.svc.updateAlertConfig(updated).subscribe();
  }

  // ---------- template helpers ----------
  alertLevelClass(level: AlertLevel): string {
    switch (level) {
      case 'critical': return 'level-critical';
      case 'warning': return 'level-warning';
      case 'info': return 'level-info';
      default: return '';
    }
  }

  alertLevelIcon(level: AlertLevel): string {
    switch (level) {
      case 'critical': return 'error';
      case 'warning': return 'warning';
      case 'info': return 'info';
      default: return 'help';
    }
  }

  alertStateClass(state: AlertState): string {
    switch (state) {
      case 'active': return 'state-active';
      case 'acknowledged': return 'state-acknowledged';
      case 'resolved': return 'state-resolved';
      default: return '';
    }
  }

  freshnessHealthClass(health: 'green' | 'yellow' | 'red'): string {
    return `freshness-${health}`;
  }

  trackBySlowQueryId(_: number, q: SlowQuery): string {
    return q.id;
  }

  trackByIndexName(_: number, i: IndexFreshness): string {
    return i.indexName;
  }

  trackByAlertId(_: number, a: MonitorAlert): string {
    return a.id;
  }

  trackByAlertConfigId(_: number, c: AlertConfig): string {
    return c.id;
  }

  trackByLiveAlertId(_: number, e: LiveAlertEvent): string {
    return e.alertId + e.timestamp;
  }
}
