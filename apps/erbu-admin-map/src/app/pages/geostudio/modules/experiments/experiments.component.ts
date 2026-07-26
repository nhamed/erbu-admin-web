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
  ExperimentsService,
  ExperimentMetric,
  ExperimentDailyPoint,
} from './experiments.service';
import {
  Experiment,
  ExperimentType,
  ExperimentStatus,
} from '@erbu-admin-web/shared/models';

type EChartsInstance = {
  setOption(option: unknown, notMerge?: boolean): void;
  resize(): void;
  dispose(): void;
};

@Component({
  selector: 'app-experiments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './experiments.component.html',
  styleUrl: './experiments.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExperimentsComponent implements OnInit, OnDestroy {
  private readonly svc = inject(ExperimentsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  // ---------- state ----------
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly lastUpdated = signal<string>('');
  readonly actionInProgress = signal<string | null>(null);
  readonly expandedExperimentId = signal<string | null>(null);

  // delegated from service
  readonly experiments = this.svc.filteredExperiments;
  readonly selectedExperiment = this.svc.selectedExperiment;
  readonly runningCount = this.svc.runningCount;
  readonly completedCount = this.svc.completedCount;
  readonly draftCount = this.svc.draftCount;
  readonly overallSignificanceRate = this.svc.overallSignificanceRate;
  readonly selectedStatus = this.svc.selectedStatus;
  readonly selectedType = this.svc.selectedType;
  readonly runningExperiments = this.svc.runningExperiments;
  readonly significantExperiments = this.svc.significantExperiments;
  readonly winnerExperiments = this.svc.winnerExperiments;

  // ---------- computed ----------
  readonly kpiCards = computed(() => {
    return [
      {
        label: 'Running',
        value: this.runningCount(),
        icon: 'play_circle',
        cssClass: 'kpi-running',
      },
      {
        label: 'Completed',
        value: this.completedCount(),
        icon: 'check_circle',
        cssClass: 'kpi-completed',
      },
      {
        label: 'Drafts',
        value: this.draftCount(),
        icon: 'edit_note',
        cssClass: 'kpi-drafts',
      },
      {
        label: 'Significance Rate',
        value: this.overallSignificanceRate().toFixed(1),
        icon: 'analytics',
        cssClass: 'kpi-significance',
        suffix: '%',
      },
      {
        label: 'Winners Found',
        value: this.winnerExperiments().length,
        icon: 'emoji_events',
        cssClass: 'kpi-winners',
      },
      {
        label: 'Total',
        value: this.svc.experiments().length,
        icon: 'science',
        cssClass: 'kpi-total',
      },
    ];
  });

  readonly statusOptions: ExperimentStatus[] = [
    ExperimentStatus.Draft,
    ExperimentStatus.Running,
    ExperimentStatus.Paused,
    ExperimentStatus.Completed,
    ExperimentStatus.Cancelled,
  ];

  readonly typeOptions: ExperimentType[] = [
    ExperimentType.ABTest,
    ExperimentType.MultiArmedBandit,
    ExperimentType.Interleaving,
  ];

  // ---------- charts ----------
  private resultsChart: EChartsInstance | null = null;
  private timelineChart: EChartsInstance | null = null;
  private resizeHandler = () => {
    this.resultsChart?.resize();
    this.timelineChart?.resize();
  };

  // ---------- lifecycle ----------
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
          this.error.set(err?.message ?? 'Failed to load experiments data');
          this.loading.set(false);
        },
      });

    if (isPlatformBrowser(this.platformId)) {
      afterNextRender(() => this.initCharts(), { injector: undefined! });
    }
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    this.resultsChart?.dispose();
    this.timelineChart?.dispose();
    this.resultsChart = null;
    this.timelineChart = null;
  }

  // ---------- charts ----------
  private async initCharts(): Promise<void> {
    try {
      const echarts = await import('echarts/core');
      const { BarChart, LineChart } = await import('echarts/charts');
      const {
        GridComponent,
        TooltipComponent,
        LegendComponent,
        DataZoomComponent,
        MarkLineComponent,
      } = await import('echarts/components');
      const { CanvasRenderer } = await import('echarts/renderers');

      echarts.use([
        BarChart,
        LineChart,
        GridComponent,
        TooltipComponent,
        LegendComponent,
        DataZoomComponent,
        MarkLineComponent,
        CanvasRenderer,
      ]);

      const resultsEl = document.getElementById('experiment-results-chart');
      if (resultsEl) {
        this.resultsChart = echarts.init(resultsEl, 'dark') as unknown as EChartsInstance;
      }

      const timelineEl = document.getElementById('experiment-timeline-chart');
      if (timelineEl) {
        this.timelineChart = echarts.init(timelineEl, 'dark') as unknown as EChartsInstance;
      }

      window.addEventListener('resize', this.resizeHandler);
    } catch {
      // echarts unavailable
    }
  }

  private updateResultsChart(metrics: ExperimentMetric[]): void {
    if (!this.resultsChart || metrics.length === 0) return;

    this.resultsChart.setOption(
      {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: {
          data: ['Control', 'Treatment'],
          textStyle: { color: '#b0b0b0' },
        },
        grid: { left: 60, right: 20, top: 40, bottom: 40 },
        xAxis: {
          type: 'category',
          data: metrics.map((m) => m.metricName),
          axisLabel: { color: '#b0b0b0', rotate: 30 },
        },
        yAxis: {
          type: 'value',
          name: 'Value',
          nameTextStyle: { color: '#b0b0b0' },
          axisLabel: { color: '#b0b0b0' },
          splitLine: { lineStyle: { color: '#333' } },
        },
        series: [
          {
            name: 'Control',
            type: 'bar',
            data: metrics.map((m) => m.controlValue),
            itemStyle: { color: '#5b8ff9' },
            barWidth: '30%',
          },
          {
            name: 'Treatment',
            type: 'bar',
            data: metrics.map((m) => m.treatmentValue),
            itemStyle: { color: '#5ad8a6' },
            barWidth: '30%',
          },
        ],
      },
      true,
    );
  }

  private updateTimelineChart(dailyData: ExperimentDailyPoint[]): void {
    if (!this.timelineChart || dailyData.length === 0) return;

    this.timelineChart.setOption(
      {
        tooltip: { trigger: 'axis' },
        legend: {
          data: ['Control', 'Treatment', 'Significance'],
          textStyle: { color: '#b0b0b0' },
        },
        grid: { left: 60, right: 60, top: 40, bottom: 60 },
        xAxis: {
          type: 'category',
          data: dailyData.map((d) => d.date),
          axisLabel: { color: '#b0b0b0', rotate: 30 },
        },
        yAxis: [
          {
            type: 'value',
            name: 'Metric Value',
            nameTextStyle: { color: '#b0b0b0' },
            axisLabel: { color: '#b0b0b0' },
            splitLine: { lineStyle: { color: '#333' } },
          },
          {
            type: 'value',
            name: 'Significance %',
            nameTextStyle: { color: '#b0b0b0' },
            axisLabel: { color: '#b0b0b0' },
            splitLine: { show: false },
            max: 100,
          },
        ],
        dataZoom: [{ type: 'inside', start: 0, end: 100 }],
        series: [
          {
            name: 'Control',
            type: 'line',
            data: dailyData.map((d) => d.controlMetricValue),
            smooth: true,
            lineStyle: { color: '#5b8ff9' },
            itemStyle: { color: '#5b8ff9' },
          },
          {
            name: 'Treatment',
            type: 'line',
            data: dailyData.map((d) => d.treatmentMetricValue),
            smooth: true,
            lineStyle: { color: '#5ad8a6' },
            itemStyle: { color: '#5ad8a6' },
          },
          {
            name: 'Significance',
            type: 'line',
            yAxisIndex: 1,
            data: dailyData.map((d) => d.cumulativeSignificance),
            smooth: true,
            lineStyle: { color: '#faad14', type: 'dashed' },
            itemStyle: { color: '#faad14' },
            markLine: {
              data: [{ yAxis: 95, name: '95% threshold' }],
              lineStyle: { color: '#ff4d4f', type: 'dashed' },
              label: { color: '#ff4d4f', fontSize: 10 },
            },
          },
        ],
      },
      true,
    );
  }

  // ---------- template actions ----------
  onStatusChange(status: string): void {
    this.svc.setStatusFilter((status as ExperimentStatus) || null);
  }

  onTypeChange(type: string): void {
    this.svc.setTypeFilter((type as ExperimentType) || null);
  }

  selectExperiment(experimentId: string): void {
    const current = this.expandedExperimentId();
    if (current === experimentId) {
      this.expandedExperimentId.set(null);
      return;
    }
    this.expandedExperimentId.set(experimentId);
    this.svc.fetchExperimentDetail(experimentId).subscribe({
      next: (detail) => {
        this.updateResultsChart(detail.metrics);
        this.updateTimelineChart(detail.dailyData);
      },
    });
  }

  startExperiment(experimentId: string): void {
    this.actionInProgress.set(experimentId);
    this.svc.startExperiment(experimentId).subscribe({
      next: () => this.actionInProgress.set(null),
      error: () => this.actionInProgress.set(null),
    });
  }

  pauseExperiment(experimentId: string): void {
    this.actionInProgress.set(experimentId);
    this.svc.pauseExperiment(experimentId).subscribe({
      next: () => this.actionInProgress.set(null),
      error: () => this.actionInProgress.set(null),
    });
  }

  cancelExperiment(experimentId: string): void {
    this.actionInProgress.set(experimentId);
    this.svc.cancelExperiment(experimentId).subscribe({
      next: () => this.actionInProgress.set(null),
      error: () => this.actionInProgress.set(null),
    });
  }

  // ---------- template helpers ----------
  statusClass(status: ExperimentStatus): string {
    switch (status) {
      case ExperimentStatus.Draft:
        return 'status-draft';
      case ExperimentStatus.Running:
        return 'status-running';
      case ExperimentStatus.Paused:
        return 'status-paused';
      case ExperimentStatus.Completed:
        return 'status-completed';
      case ExperimentStatus.Cancelled:
        return 'status-cancelled';
      default:
        return '';
    }
  }

  typeLabel(type: ExperimentType): string {
    switch (type) {
      case ExperimentType.ABTest:
        return 'A/B Test';
      case ExperimentType.MultiArmedBandit:
        return 'Multi-Armed Bandit';
      case ExperimentType.Interleaving:
        return 'Interleaving';
      default:
        return type;
    }
  }

  significanceClass(significance: number | null): string {
    if (significance === null) return 'sig-unknown';
    if (significance >= 99) return 'sig-very-high';
    if (significance >= 95) return 'sig-high';
    if (significance >= 90) return 'sig-moderate';
    return 'sig-low';
  }

  significanceLabel(significance: number | null): string {
    if (significance === null) return 'N/A';
    if (significance >= 99) return 'Very High';
    if (significance >= 95) return 'Significant';
    if (significance >= 90) return 'Moderate';
    return 'Not Significant';
  }

  canStart(experiment: Experiment): boolean {
    return experiment.status === ExperimentStatus.Draft
      || experiment.status === ExperimentStatus.Paused;
  }

  canPause(experiment: Experiment): boolean {
    return experiment.status === ExperimentStatus.Running;
  }

  canCancel(experiment: Experiment): boolean {
    return experiment.status === ExperimentStatus.Running
      || experiment.status === ExperimentStatus.Paused;
  }

  trackByExperimentId(_: number, e: Experiment): string {
    return e.id;
  }

  trackByMetricName(_: number, m: ExperimentMetric): string {
    return m.metricName;
  }
}
