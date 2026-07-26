import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
  PLATFORM_ID,
  afterNextRender,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  FeatureStoreService,
  Feature,
  FeatureStats,
  FreshnessStatus,
  FeatureImportance,
  FeatureGroup,
} from './feature-store.service';

type EChartsInstance = {
  setOption(option: unknown, notMerge?: boolean): void;
  resize(): void;
  dispose(): void;
};

@Component({
  selector: 'app-feature-store',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './feature-store.component.html',
  styleUrl: './feature-store.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeatureStoreComponent implements OnInit, OnDestroy {
  protected readonly svc = inject(FeatureStoreService);
  private readonly platformId = inject(PLATFORM_ID);

  // ---------- state from service ----------
  readonly loading = this.svc.loading;
  readonly error = this.svc.error;
  readonly features = this.svc.filteredFeatures;
  readonly selectedFeature = this.svc.selectedFeature;
  readonly featureStats = this.svc.featureStats;
  readonly summary = this.svc.summary;
  readonly totalItems = this.svc.totalItems;
  readonly currentPage = this.svc.currentPage;
  readonly pageSize = this.svc.pageSize;
  readonly totalPages = this.svc.totalPages;
  readonly groups = this.svc.groups;
  readonly freshnessBreakdown = this.svc.freshnessBreakdown;
  readonly filterGroup = this.svc.filterGroup;
  readonly filterFreshness = this.svc.filterFreshness;

  // local UI state
  readonly searchText = signal('');
  readonly activeTab = signal<'list' | 'importance'>('list');

  // charts
  private importanceChart: EChartsInstance | null = null;
  private histogramChart: EChartsInstance | null = null;
  private resizeHandler = () => {
    this.importanceChart?.resize();
    this.histogramChart?.resize();
  };

  // ---------- computed ----------
  readonly kpiCards = computed(() => {
    const s = this.summary();
    return [
      { label: 'Total Features', value: s.totalFeatures, icon: 'format_list_numbered', cssClass: 'kpi-features' },
      { label: 'Groups', value: s.totalGroups, icon: 'folder', cssClass: 'kpi-groups' },
      { label: 'Fresh', value: s.freshCount, icon: 'check_circle', cssClass: 'kpi-fresh' },
      { label: 'Stale', value: s.staleCount, icon: 'warning', cssClass: 'kpi-stale' },
      { label: 'Expired', value: s.expiredCount, icon: 'error', cssClass: 'kpi-expired' },
      { label: 'Total Rows', value: this.formatNumber(s.totalRows), icon: 'storage', cssClass: 'kpi-rows' },
    ];
  });

  readonly statsDisplay = computed(() => {
    const s = this.featureStats();
    if (!s) return [];
    return [
      { label: 'Mean', value: s.mean !== null ? s.mean.toFixed(4) : 'N/A' },
      { label: 'Median', value: s.median !== null ? s.median.toFixed(4) : 'N/A' },
      { label: 'Std Dev', value: s.stdDev !== null ? s.stdDev.toFixed(4) : 'N/A' },
      { label: 'Min', value: s.min !== null ? s.min.toFixed(4) : 'N/A' },
      { label: 'Max', value: s.max !== null ? s.max.toFixed(4) : 'N/A' },
      { label: 'P25', value: s.p25 !== null ? s.p25.toFixed(4) : 'N/A' },
      { label: 'P75', value: s.p75 !== null ? s.p75.toFixed(4) : 'N/A' },
      { label: 'P95', value: s.p95 !== null ? s.p95.toFixed(4) : 'N/A' },
      { label: 'P99', value: s.p99 !== null ? s.p99.toFixed(4) : 'N/A' },
      { label: 'Distinct', value: s.distinctCount.toLocaleString() },
      { label: 'Null Count', value: s.nullCount.toLocaleString() },
      { label: 'Total Count', value: s.totalCount.toLocaleString() },
    ];
  });

  readonly freshnessOptions: FreshnessStatus[] = ['Fresh', 'Stale', 'Expired', 'Unknown'];

  // ---------- lifecycle ----------
  ngOnInit(): void {
    this.svc.loadSummary();
    this.svc.loadFeatures();
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    this.importanceChart?.dispose();
    this.importanceChart = null;
    this.histogramChart?.dispose();
    this.histogramChart = null;
  }

  // ---------- chart init ----------
  private async initImportanceChart(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const container = document.getElementById('importance-chart');
    if (!container) return;

    try {
      const echarts = await import('echarts/core');
      const { BarChart } = await import('echarts/charts');
      const { GridComponent, TooltipComponent } = await import('echarts/components');
      const { CanvasRenderer } = await import('echarts/renderers');

      echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);
      this.importanceChart = echarts.init(container, 'dark') as unknown as EChartsInstance;
      this.updateImportanceChart();
      window.addEventListener('resize', this.resizeHandler);
    } catch {
      // echarts unavailable
    }
  }

  private updateImportanceChart(): void {
    if (!this.importanceChart) return;
    const ranking = this.summary().importanceRanking;
    if (ranking.length === 0) return;

    const sorted = [...ranking].sort((a, b) => a.importance - b.importance);
    const names = sorted.map((r) => r.featureName);
    const values = sorted.map((r) => r.importance);

    this.importanceChart.setOption(
      {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
          formatter: (params: Array<{ name: string; value: number }>) => {
            const p = params[0];
            return `${p.name}<br/>Importance: ${(p.value * 100).toFixed(1)}%`;
          },
        },
        grid: {
          left: '20%',
          right: '8%',
          top: '8%',
          bottom: '8%',
        },
        xAxis: {
          type: 'value',
          max: 1,
          axisLabel: {
            color: '#b0b0b0',
            formatter: (v: number) => `${(v * 100).toFixed(0)}%`,
          },
          splitLine: { lineStyle: { color: '#333' } },
        },
        yAxis: {
          type: 'category',
          data: names,
          axisLabel: { color: '#b0b0b0', fontSize: 11 },
        },
        series: [
          {
            type: 'bar',
            data: values,
            itemStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 1, y2: 0,
                colorStops: [
                  { offset: 0, color: '#1890ff' },
                  { offset: 1, color: '#52c41a' },
                ],
              },
              borderRadius: [0, 4, 4, 0],
            },
            barMaxWidth: 24,
          },
        ],
      },
      true,
    );
  }

  private async initHistogramChart(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const container = document.getElementById('histogram-chart');
    if (!container) return;

    try {
      const echarts = await import('echarts/core');
      const { BarChart } = await import('echarts/charts');
      const { GridComponent, TooltipComponent } = await import('echarts/components');
      const { CanvasRenderer } = await import('echarts/renderers');

      echarts.use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);
      this.histogramChart = echarts.init(container, 'dark') as unknown as EChartsInstance;
      this.updateHistogramChart();
    } catch {
      // echarts unavailable
    }
  }

  private updateHistogramChart(): void {
    if (!this.histogramChart) return;
    const stats = this.featureStats();
    if (!stats || stats.histogram.length === 0) return;

    const labels = stats.histogram.map(
      (b) => `${b.bucketStart.toFixed(2)}-${b.bucketEnd.toFixed(2)}`,
    );
    const values = stats.histogram.map((b) => b.count);

    this.histogramChart.setOption(
      {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'shadow' },
        },
        grid: {
          left: '12%',
          right: '4%',
          top: '8%',
          bottom: '20%',
        },
        xAxis: {
          type: 'category',
          data: labels,
          axisLabel: {
            color: '#b0b0b0',
            fontSize: 10,
            rotate: 45,
          },
        },
        yAxis: {
          type: 'value',
          axisLabel: { color: '#b0b0b0' },
          splitLine: { lineStyle: { color: '#333' } },
        },
        series: [
          {
            type: 'bar',
            data: values,
            itemStyle: {
              color: '#1890ff',
              borderRadius: [4, 4, 0, 0],
            },
            barMaxWidth: 30,
          },
        ],
      },
      true,
    );
  }

  // ---------- template actions ----------

  onSearch(): void {
    this.svc.setSearchQuery(this.searchText());
    this.svc.loadFeatures();
  }

  onSearchKeyup(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.onSearch();
    }
  }

  onSearchClear(): void {
    this.searchText.set('');
    this.svc.setSearchQuery('');
    this.svc.loadFeatures();
  }

  onGroupChange(group: string): void {
    this.svc.setGroupFilter(group || null);
    this.svc.loadFeatures();
  }

  onFreshnessChange(freshness: string): void {
    this.svc.setFreshnessFilter((freshness as FreshnessStatus) || null);
    this.svc.loadFeatures();
  }

  onSelectFeature(feature: Feature): void {
    this.svc.selectFeature(feature);
    // Init histogram chart after selection
    if (isPlatformBrowser(this.platformId)) {
      afterNextRender(() => this.initHistogramChart(), { injector: undefined! });
    }
  }

  onCloseDetail(): void {
    this.svc.selectFeature(null);
  }

  onTabChange(tab: 'list' | 'importance'): void {
    this.activeTab.set(tab);
    if (tab === 'importance' && isPlatformBrowser(this.platformId)) {
      afterNextRender(() => this.initImportanceChart(), { injector: undefined! });
    }
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.svc.loadFeatures(page, this.pageSize());
  }

  onRefresh(): void {
    this.svc.loadSummary();
    this.svc.loadFeatures(this.currentPage(), this.pageSize());
  }

  // ---------- helpers ----------

  freshnessClass(status: FreshnessStatus): string {
    switch (status) {
      case 'Fresh': return 'freshness-fresh';
      case 'Stale': return 'freshness-stale';
      case 'Expired': return 'freshness-expired';
      case 'Unknown': return 'freshness-unknown';
      default: return '';
    }
  }

  formatNumber(value: number): string {
    if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + 'M';
    if (value >= 1_000) return (value / 1_000).toFixed(1) + 'K';
    return value.toString();
  }

  trackByFeatureId(_: number, feature: Feature): string {
    return feature.id;
  }

  trackByGroup(_: number, group: FeatureGroup): string {
    return group.name;
  }

  trackByImportance(_: number, item: FeatureImportance): string {
    return item.featureId;
  }

  trackByStat(_: number, item: { label: string }): string {
    return item.label;
  }
}
