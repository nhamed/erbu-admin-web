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

import {
  HistoryService,
  QueryHistoryEntry,
  TopQueryEntry,
  QueryVolumePoint,
  HistorySortField,
} from './history.service';

type EChartsInstance = {
  setOption(option: unknown, notMerge?: boolean): void;
  resize(): void;
  dispose(): void;
};

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './history.component.html',
  styleUrl: './history.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistoryComponent implements OnInit, OnDestroy {
  private readonly svc = inject(HistoryService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  // ---------- delegated from service ----------
  readonly entries = this.svc.entries;
  readonly totalEntries = this.svc.totalEntries;
  readonly stats = this.svc.stats;
  readonly replayResult = this.svc.replayResult;
  readonly selectedEntry = this.svc.selectedEntry;
  readonly loading = this.svc.loading;
  readonly replayLoading = this.svc.replayLoading;
  readonly error = this.svc.error;
  readonly kpiCards = this.svc.kpiCards;
  readonly totalPages = this.svc.totalPages;
  readonly currentPage = this.svc.currentPage;
  readonly hasFilters = this.svc.hasFilters;
  readonly sortBy = this.svc.sortBy;
  readonly sortDirection = this.svc.sortDirection;
  readonly volumeData = this.svc.volumeData;
  readonly topQueries = this.svc.topQueries;
  readonly slowQueries = this.svc.slowQueries;

  // ---------- local UI state ----------
  readonly searchInput = signal('');
  readonly dateFromInput = signal('');
  readonly dateToInput = signal('');
  readonly userIdInput = signal('');
  readonly indexInput = signal('');
  readonly minLatencyInput = signal<string>('');
  readonly maxLatencyInput = signal<string>('');
  readonly activeTab = signal<'table' | 'charts' | 'top-queries' | 'slow-queries'>('table');
  readonly showFilters = signal(false);

  // ---------- chart ----------
  private volumeChart: EChartsInstance | null = null;
  private resizeHandler = () => this.volumeChart?.resize();

  // ---------- computed ----------
  readonly pageRange = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const range: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    return range;
  });

  readonly sortIndicator = computed(() => {
    return (field: HistorySortField) => {
      if (this.sortBy() !== field) return '';
      return this.sortDirection() === 'asc' ? 'arrow_upward' : 'arrow_downward';
    };
  });

  readonly selectedEntryFilters = computed(() => {
    const entry = this.selectedEntry();
    if (!entry) return [];
    return Object.entries(entry.filters).map(([key, value]) => ({ key, value }));
  });

  readonly replayDeltaClass = computed(() => {
    const result = this.replayResult();
    if (!result) return '';
    if (result.isConsistent) return 'replay-consistent';
    return 'replay-divergent';
  });

  // ---------- lifecycle ----------
  ngOnInit(): void {
    this.svc.loadDashboard();

    if (isPlatformBrowser(this.platformId)) {
      afterNextRender(() => this.initVolumeChart(), { injector: undefined! });
    }
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    this.volumeChart?.dispose();
    this.volumeChart = null;
    this.svc.clearError();
  }

  // ---------- chart init ----------
  private async initVolumeChart(): Promise<void> {
    const container = document.getElementById('history-volume-chart');
    if (!container) return;

    try {
      const echarts = await import('echarts/core');
      const { LineChart, BarChart } = await import('echarts/charts');
      const { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent } =
        await import('echarts/components');
      const { CanvasRenderer } = await import('echarts/renderers');

      echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, CanvasRenderer]);
      this.volumeChart = echarts.init(container, 'dark') as unknown as EChartsInstance;
      this.updateVolumeChart();
      window.addEventListener('resize', this.resizeHandler);
    } catch {
      // echarts unavailable -- degrade silently
    }
  }

  updateVolumeChart(): void {
    if (!this.volumeChart) return;
    const data = this.volumeData();
    if (data.length === 0) return;

    const timestamps = data.map((d) => d.timestamp);
    const counts = data.map((d) => d.count);
    const latencies = data.map((d) => d.avgLatencyMs);
    const errors = data.map((d) => d.errorCount);

    this.volumeChart.setOption(
      {
        tooltip: {
          trigger: 'axis',
          axisPointer: { type: 'cross' },
        },
        legend: {
          data: ['Query Volume', 'Avg Latency', 'Errors'],
          textStyle: { color: '#b0b0b0' },
        },
        dataZoom: [
          { type: 'inside', start: 0, end: 100 },
          { type: 'slider', start: 0, end: 100 },
        ],
        grid: { left: '3%', right: '4%', bottom: '15%', containLabel: true },
        xAxis: {
          type: 'category',
          data: timestamps,
          axisLabel: { color: '#b0b0b0', rotate: 30 },
          splitLine: { lineStyle: { color: '#333' } },
        },
        yAxis: [
          {
            type: 'value',
            name: 'Count',
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
            name: 'Query Volume',
            type: 'bar',
            data: counts,
            itemStyle: { color: '#1890ff' },
            barMaxWidth: 30,
          },
          {
            name: 'Avg Latency',
            type: 'line',
            yAxisIndex: 1,
            data: latencies,
            lineStyle: { color: '#faad14' },
            itemStyle: { color: '#faad14' },
            smooth: true,
          },
          {
            name: 'Errors',
            type: 'line',
            data: errors,
            lineStyle: { color: '#ff4d4f' },
            itemStyle: { color: '#ff4d4f' },
            areaStyle: { color: 'rgba(255, 77, 79, 0.1)' },
          },
        ],
      },
      true,
    );
  }

  // ---------- actions ----------
  onSearch(): void {
    this.svc.setSearchQuery(this.searchInput());
    this.applyFilters();
    this.svc.searchHistory();
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.onSearch();
    }
  }

  onToggleFilters(): void {
    this.showFilters.update((v) => !v);
  }

  onApplyFilters(): void {
    this.applyFilters();
    this.svc.searchHistory();
  }

  onClearFilters(): void {
    this.searchInput.set('');
    this.dateFromInput.set('');
    this.dateToInput.set('');
    this.userIdInput.set('');
    this.indexInput.set('');
    this.minLatencyInput.set('');
    this.maxLatencyInput.set('');
    this.svc.clearFilters();
    this.svc.searchHistory();
  }

  onSortColumn(field: HistorySortField): void {
    this.svc.setSortBy(field);
    this.svc.searchHistory();
  }

  onPageChange(page: number): void {
    this.svc.goToPage(page);
  }

  onSelectEntry(entry: QueryHistoryEntry): void {
    this.svc.selectEntry(entry);
  }

  onCloseDetail(): void {
    this.svc.selectEntry(null);
  }

  onReplayQuery(entryId: string): void {
    this.svc.replayQuery(entryId);
  }

  onSetTab(tab: 'table' | 'charts' | 'top-queries' | 'slow-queries'): void {
    this.activeTab.set(tab);
    if (tab === 'charts') {
      // give DOM a tick to render then update chart
      setTimeout(() => this.updateVolumeChart(), 50);
    }
  }

  onDismissError(): void {
    this.svc.clearError();
  }

  // ---------- template helpers ----------
  latencyClass(ms: number): string {
    if (ms < 100) return 'latency-fast';
    if (ms < 500) return 'latency-normal';
    if (ms < 1000) return 'latency-slow';
    return 'latency-very-slow';
  }

  statusCodeClass(code: number): string {
    if (code >= 200 && code < 300) return 'status-ok';
    if (code >= 400 && code < 500) return 'status-client-error';
    return 'status-server-error';
  }

  formatDuration(ms: number): string {
    if (ms < 1) return '<1ms';
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  trackByEntryId(_: number, entry: QueryHistoryEntry): string {
    return entry.id;
  }

  trackByTopQuery(_: number, entry: TopQueryEntry): string {
    return entry.queryText;
  }

  trackByFilterKey(_: number, entry: { key: string }): string {
    return entry.key;
  }

  // ---------- private ----------
  private applyFilters(): void {
    this.svc.setSearchQuery(this.searchInput());
    this.svc.setFilterUserId(this.userIdInput() || null);
    this.svc.setFilterIndex(this.indexInput() || null);
    this.svc.setDateRange(
      this.dateFromInput() || null,
      this.dateToInput() || null,
    );
    const minLat = this.minLatencyInput() ? parseFloat(this.minLatencyInput()) : null;
    const maxLat = this.maxLatencyInput() ? parseFloat(this.maxLatencyInput()) : null;
    this.svc.setLatencyRange(
      isNaN(minLat as number) ? null : minLat,
      isNaN(maxLat as number) ? null : maxLat,
    );
  }
}
