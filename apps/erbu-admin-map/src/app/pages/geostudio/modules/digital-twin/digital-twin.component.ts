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
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  DigitalTwinService,
  DigitalTwinConfig,
  TrafficComparison,
  DivergenceMetric,
  DivergenceDetail,
  ShadowQueryResult,
  ShadowPositionChange,
  TwinStatus,
  DivergenceLevel,
} from './digital-twin.service';

type EChartsInstance = {
  setOption(option: unknown, notMerge?: boolean): void;
  resize(): void;
  dispose(): void;
};

@Component({
  selector: 'app-digital-twin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './digital-twin.component.html',
  styleUrl: './digital-twin.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DigitalTwinComponent implements OnInit, OnDestroy {
  private readonly svc = inject(DigitalTwinService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  // ---------- delegated from service ----------
  readonly configs = this.svc.configs;
  readonly selectedConfig = this.svc.selectedConfig;
  readonly trafficComparisons = this.svc.trafficComparisons;
  readonly divergenceMetrics = this.svc.divergenceMetrics;
  readonly recentDivergences = this.svc.recentDivergences;
  readonly shadowQueries = this.svc.shadowQueries;
  readonly selectedDivergence = this.svc.selectedDivergence;
  readonly selectedShadowQuery = this.svc.selectedShadowQuery;
  readonly kpiCards = this.svc.kpiCards;
  readonly loading = this.svc.loading;
  readonly error = this.svc.error;
  readonly lastUpdatedAt = this.svc.lastUpdatedAt;
  readonly activeTab = this.svc.activeTab;
  readonly activeTwins = this.svc.activeTwins;
  readonly criticalDivergences = this.svc.criticalDivergences;

  // ---------- charts ----------
  private trafficChart: EChartsInstance | null = null;
  private divergenceChart: EChartsInstance | null = null;
  private resizeHandler = () => {
    this.trafficChart?.resize();
    this.divergenceChart?.resize();
  };

  // ---------- computed ----------
  readonly configCards = computed(() => {
    return this.configs().map((c) => ({
      ...c,
      matchRateFormatted: c.matchRate.toFixed(1) + '%',
      trafficFormatted: c.trafficPercentage + '%',
    }));
  });

  readonly selectedConfigSummary = computed(() => {
    const cfg = this.selectedConfig();
    if (!cfg) return null;
    return {
      name: cfg.name,
      source: cfg.sourceEnvironment,
      target: cfg.targetEnvironment,
      traffic: cfg.trafficPercentage + '%',
      matchRate: cfg.matchRate.toFixed(1) + '%',
      divergences: cfg.divergenceCount,
      status: cfg.status,
      lastSync: cfg.lastSyncAt ?? 'Never',
    };
  });

  readonly shadowQueryPositionChanges = computed(() => {
    const query = this.selectedShadowQuery();
    return query?.positionChanges ?? [];
  });

  readonly latestTrafficSnapshot = computed(() => {
    const comparisons = this.trafficComparisons();
    if (comparisons.length === 0) return null;
    return comparisons[comparisons.length - 1];
  });

  // ---------- lifecycle ----------
  ngOnInit(): void {
    this.svc.dashboard$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.updateTrafficChart();
          this.updateDivergenceChart();
        },
        error: () => {
          // error handled by service
        },
      });

    if (isPlatformBrowser(this.platformId)) {
      afterNextRender(() => {
        this.initTrafficChart();
        this.initDivergenceChart();
      }, { injector: undefined! });
    }
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    this.trafficChart?.dispose();
    this.divergenceChart?.dispose();
    this.trafficChart = null;
    this.divergenceChart = null;
    this.svc.clearError();
  }

  // ---------- chart init ----------
  private async initTrafficChart(): Promise<void> {
    const container = document.getElementById('twin-traffic-chart');
    if (!container) return;

    try {
      const echarts = await import('echarts/core');
      const { LineChart } = await import('echarts/charts');
      const { GridComponent, TooltipComponent, LegendComponent } =
        await import('echarts/components');
      const { CanvasRenderer } = await import('echarts/renderers');

      echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);
      this.trafficChart = echarts.init(container, 'dark') as unknown as EChartsInstance;
      this.updateTrafficChart();
      window.addEventListener('resize', this.resizeHandler);
    } catch {
      // degrade silently
    }
  }

  private async initDivergenceChart(): Promise<void> {
    const container = document.getElementById('twin-divergence-chart');
    if (!container) return;

    try {
      const echarts = await import('echarts/core');
      const { BarChart, LineChart } = await import('echarts/charts');
      const { GridComponent, TooltipComponent, LegendComponent } =
        await import('echarts/components');
      const { CanvasRenderer } = await import('echarts/renderers');

      echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);
      this.divergenceChart = echarts.init(container, 'dark') as unknown as EChartsInstance;
      this.updateDivergenceChart();
    } catch {
      // degrade silently
    }
  }

  updateTrafficChart(): void {
    if (!this.trafficChart) return;
    const data = this.trafficComparisons();
    if (data.length === 0) return;

    const timestamps = data.map((d) => d.timestamp);

    this.trafficChart.setOption(
      {
        tooltip: { trigger: 'axis' },
        legend: {
          data: ['Live Requests', 'Shadow Requests', 'Live Latency', 'Shadow Latency'],
          textStyle: { color: '#b0b0b0' },
        },
        grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
        xAxis: {
          type: 'category',
          data: timestamps,
          axisLabel: { color: '#b0b0b0', rotate: 30 },
          splitLine: { lineStyle: { color: '#333' } },
        },
        yAxis: [
          {
            type: 'value',
            name: 'Requests',
            nameTextStyle: { color: '#b0b0b0' },
            axisLabel: { color: '#b0b0b0' },
            splitLine: { lineStyle: { color: '#333' } },
          },
          {
            type: 'value',
            name: 'Latency (ms)',
            nameTextStyle: { color: '#b0b0b0' },
            axisLabel: { color: '#b0b0b0' },
            splitLine: { show: false },
          },
        ],
        series: [
          {
            name: 'Live Requests',
            type: 'line',
            data: data.map((d) => d.liveRequestCount),
            lineStyle: { color: '#52c41a' },
            itemStyle: { color: '#52c41a' },
          },
          {
            name: 'Shadow Requests',
            type: 'line',
            data: data.map((d) => d.shadowRequestCount),
            lineStyle: { color: '#1890ff', type: 'dashed' },
            itemStyle: { color: '#1890ff' },
          },
          {
            name: 'Live Latency',
            type: 'line',
            yAxisIndex: 1,
            data: data.map((d) => d.liveAvgLatencyMs),
            lineStyle: { color: '#faad14' },
            itemStyle: { color: '#faad14' },
            smooth: true,
          },
          {
            name: 'Shadow Latency',
            type: 'line',
            yAxisIndex: 1,
            data: data.map((d) => d.shadowAvgLatencyMs),
            lineStyle: { color: '#ff4d4f', type: 'dashed' },
            itemStyle: { color: '#ff4d4f' },
            smooth: true,
          },
        ],
      },
      true,
    );
  }

  updateDivergenceChart(): void {
    if (!this.divergenceChart) return;
    const data = this.divergenceMetrics();
    if (data.length === 0) return;

    const timestamps = [...new Set(data.map((d) => d.timestamp))].sort();
    const metricNames = [...new Set(data.map((d) => d.metricName))];

    const series = metricNames.map((name) => ({
      name,
      type: 'bar' as const,
      stack: 'divergence',
      data: timestamps.map((ts) => {
        const point = data.find((d) => d.timestamp === ts && d.metricName === name);
        return point ? Math.abs(point.deltaPercent) : 0;
      }),
    }));

    this.divergenceChart.setOption(
      {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: {
          data: metricNames,
          textStyle: { color: '#b0b0b0' },
        },
        grid: { left: '3%', right: '4%', bottom: '10%', containLabel: true },
        xAxis: {
          type: 'category',
          data: timestamps,
          axisLabel: { color: '#b0b0b0', rotate: 30 },
          splitLine: { lineStyle: { color: '#333' } },
        },
        yAxis: {
          type: 'value',
          name: 'Divergence %',
          nameTextStyle: { color: '#b0b0b0' },
          axisLabel: { color: '#b0b0b0' },
          splitLine: { lineStyle: { color: '#333' } },
        },
        series,
      },
      true,
    );
  }

  // ---------- actions ----------
  onSelectConfig(config: DigitalTwinConfig): void {
    this.svc.selectConfig(config);
  }

  onDeselectConfig(): void {
    this.svc.selectConfig(null);
  }

  onSetTab(tab: 'overview' | 'traffic' | 'divergence' | 'queries'): void {
    this.svc.setTab(tab);
    if (tab === 'traffic') {
      setTimeout(() => this.updateTrafficChart(), 50);
    } else if (tab === 'divergence') {
      setTimeout(() => this.updateDivergenceChart(), 50);
    }
  }

  onSelectDivergence(divergence: DivergenceDetail): void {
    this.svc.selectDivergence(divergence);
  }

  onCloseDivergenceDetail(): void {
    this.svc.selectDivergence(null);
  }

  onSelectShadowQuery(query: ShadowQueryResult): void {
    this.svc.selectShadowQuery(query);
  }

  onCloseShadowQueryDetail(): void {
    this.svc.selectShadowQuery(null);
  }

  onDismissError(): void {
    this.svc.clearError();
  }

  // ---------- template helpers ----------
  statusClass(status: TwinStatus): string {
    return this.svc.statusClass(status);
  }

  statusIcon(status: TwinStatus): string {
    switch (status) {
      case 'Active': return 'play_circle';
      case 'Paused': return 'pause_circle';
      case 'Disabled': return 'cancel';
      case 'Error': return 'error';
      default: return 'help';
    }
  }

  divergenceClass(level: DivergenceLevel): string {
    return this.svc.divergenceClass(level);
  }

  matchRateClass(rate: number): string {
    if (rate >= 95) return 'match-excellent';
    if (rate >= 85) return 'match-good';
    if (rate >= 70) return 'match-fair';
    return 'match-poor';
  }

  positionDeltaClass(delta: number): string {
    if (delta > 0) return 'pos-down';
    if (delta < 0) return 'pos-up';
    return 'pos-same';
  }

  positionDeltaIcon(delta: number): string {
    if (delta > 0) return 'arrow_downward';
    if (delta < 0) return 'arrow_upward';
    return 'remove';
  }

  formatPercent(value: number): string {
    return value.toFixed(1) + '%';
  }

  trackByConfigId(_: number, config: DigitalTwinConfig): string {
    return config.id;
  }

  trackByDivergenceId(_: number, d: DivergenceDetail): string {
    return d.id;
  }

  trackByShadowQueryId(_: number, q: ShadowQueryResult): string {
    return q.id;
  }

  trackByDocId(_: number, change: ShadowPositionChange): string {
    return change.documentId;
  }
}
