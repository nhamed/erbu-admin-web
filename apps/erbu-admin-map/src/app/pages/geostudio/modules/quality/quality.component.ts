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
  QualityService,
  QualityTestResult,
  RegressionAlert,
  QueryCoverageMetric,
} from './quality.service';
import { QualityReportType, QualityReport } from '@erbu-admin-web/shared/models';

type EChartsInstance = {
  setOption(option: unknown, notMerge?: boolean): void;
  resize(): void;
  dispose(): void;
};

@Component({
  selector: 'app-quality',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quality.component.html',
  styleUrl: './quality.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QualityComponent implements OnInit, OnDestroy {
  private readonly svc = inject(QualityService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  // ---------- state ----------
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly lastUpdated = signal<string>('');

  // delegated from service
  readonly reports = this.svc.filteredReports;
  readonly testResults = this.svc.testResults;
  readonly regressionAlerts = this.svc.regressionAlerts;
  readonly coverageMetrics = this.svc.coverageMetrics;
  readonly overallScore = this.svc.overallScore;
  readonly failedTests = this.svc.failedTests;
  readonly unacknowledgedAlerts = this.svc.unacknowledgedAlerts;
  readonly criticalAlerts = this.svc.criticalAlerts;
  readonly testPassRate = this.svc.testPassRate;
  readonly avgRelevanceScore = this.svc.avgRelevanceScore;
  readonly selectedReportType = this.svc.selectedReportType;

  // ---------- computed ----------
  readonly kpiCards = computed(() => {
    return [
      {
        label: 'Overall Score',
        value: this.overallScore().toFixed(1),
        icon: 'verified',
        cssClass: 'kpi-score',
        suffix: '%',
      },
      {
        label: 'Test Pass Rate',
        value: this.testPassRate(),
        icon: 'check_circle',
        cssClass: 'kpi-pass',
        suffix: '%',
      },
      {
        label: 'Avg Relevance',
        value: this.avgRelevanceScore().toFixed(2),
        icon: 'trending_up',
        cssClass: 'kpi-relevance',
      },
      {
        label: 'Failed Tests',
        value: this.failedTests().length,
        icon: 'error',
        cssClass: 'kpi-failed',
      },
      {
        label: 'Regression Alerts',
        value: this.unacknowledgedAlerts().length,
        icon: 'notification_important',
        cssClass: 'kpi-alerts',
      },
      {
        label: 'Critical',
        value: this.criticalAlerts().length,
        icon: 'warning',
        cssClass: 'kpi-critical',
      },
    ];
  });

  readonly reportTypeOptions: QualityReportType[] = [
    QualityReportType.Relevance,
    QualityReportType.Freshness,
    QualityReportType.Completeness,
    QualityReportType.Consistency,
    QualityReportType.Coverage,
  ];

  // ---------- charts ----------
  private relevanceChart: EChartsInstance | null = null;
  private trendChart: EChartsInstance | null = null;
  private resizeHandler = () => {
    this.relevanceChart?.resize();
    this.trendChart?.resize();
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
          this.updateRelevanceChart();
          this.updateTrendChart();
        },
        error: (err) => {
          this.error.set(err?.message ?? 'Failed to load quality data');
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
    this.relevanceChart?.dispose();
    this.trendChart?.dispose();
    this.relevanceChart = null;
    this.trendChart = null;
  }

  // ---------- chart init ----------
  private async initCharts(): Promise<void> {
    try {
      const echarts = await import('echarts/core');
      const { BarChart, LineChart } = await import('echarts/charts');
      const {
        GridComponent,
        TooltipComponent,
        LegendComponent,
        DataZoomComponent,
      } = await import('echarts/components');
      const { CanvasRenderer } = await import('echarts/renderers');

      echarts.use([
        BarChart,
        LineChart,
        GridComponent,
        TooltipComponent,
        LegendComponent,
        DataZoomComponent,
        CanvasRenderer,
      ]);

      const relevanceEl = document.getElementById('quality-relevance-chart');
      if (relevanceEl) {
        this.relevanceChart = echarts.init(relevanceEl, 'dark') as unknown as EChartsInstance;
      }

      const trendEl = document.getElementById('quality-trend-chart');
      if (trendEl) {
        this.trendChart = echarts.init(trendEl, 'dark') as unknown as EChartsInstance;
      }

      this.updateRelevanceChart();
      this.updateTrendChart();
      window.addEventListener('resize', this.resizeHandler);
    } catch {
      // echarts unavailable -- degrade silently
    }
  }

  private updateRelevanceChart(): void {
    if (!this.relevanceChart) return;
    const metrics = this.coverageMetrics();
    if (metrics.length === 0) return;

    this.relevanceChart.setOption(
      {
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        legend: { data: ['Relevance Score', 'Coverage %'], textStyle: { color: '#b0b0b0' } },
        grid: { left: 60, right: 20, top: 40, bottom: 40 },
        xAxis: {
          type: 'category',
          data: metrics.map((m) => m.category),
          axisLabel: { color: '#b0b0b0', rotate: 30 },
        },
        yAxis: [
          {
            type: 'value',
            name: 'Score',
            nameTextStyle: { color: '#b0b0b0' },
            axisLabel: { color: '#b0b0b0' },
            splitLine: { lineStyle: { color: '#333' } },
          },
          {
            type: 'value',
            name: 'Coverage %',
            nameTextStyle: { color: '#b0b0b0' },
            axisLabel: { color: '#b0b0b0' },
            splitLine: { show: false },
            max: 100,
          },
        ],
        series: [
          {
            name: 'Relevance Score',
            type: 'bar',
            data: metrics.map((m) => m.avgRelevanceScore),
            itemStyle: { color: '#5b8ff9' },
            barWidth: '40%',
          },
          {
            name: 'Coverage %',
            type: 'bar',
            yAxisIndex: 1,
            data: metrics.map((m) => m.coveragePercent),
            itemStyle: { color: '#5ad8a6' },
            barWidth: '40%',
          },
        ],
      },
      true,
    );
  }

  private updateTrendChart(): void {
    if (!this.trendChart) return;
    const data = this.svc.trendData();
    if (data.length === 0) return;

    this.trendChart.setOption(
      {
        tooltip: { trigger: 'axis' },
        legend: {
          data: ['Relevance', 'Coverage', 'Freshness', 'Consistency'],
          textStyle: { color: '#b0b0b0' },
        },
        grid: { left: 60, right: 20, top: 40, bottom: 60 },
        xAxis: {
          type: 'category',
          data: data.map((d) => d.date),
          axisLabel: { color: '#b0b0b0', rotate: 30 },
        },
        yAxis: {
          type: 'value',
          name: 'Score',
          nameTextStyle: { color: '#b0b0b0' },
          axisLabel: { color: '#b0b0b0' },
          splitLine: { lineStyle: { color: '#333' } },
        },
        dataZoom: [{ type: 'inside', start: 0, end: 100 }],
        series: [
          {
            name: 'Relevance',
            type: 'line',
            data: data.map((d) => d.relevanceScore),
            smooth: true,
            lineStyle: { color: '#5b8ff9' },
            itemStyle: { color: '#5b8ff9' },
          },
          {
            name: 'Coverage',
            type: 'line',
            data: data.map((d) => d.coveragePercent),
            smooth: true,
            lineStyle: { color: '#5ad8a6' },
            itemStyle: { color: '#5ad8a6' },
          },
          {
            name: 'Freshness',
            type: 'line',
            data: data.map((d) => d.freshnessScore),
            smooth: true,
            lineStyle: { color: '#f6bd16' },
            itemStyle: { color: '#f6bd16' },
          },
          {
            name: 'Consistency',
            type: 'line',
            data: data.map((d) => d.consistencyScore),
            smooth: true,
            lineStyle: { color: '#e86452' },
            itemStyle: { color: '#e86452' },
          },
        ],
      },
      true,
    );
  }

  // ---------- template actions ----------
  onReportTypeChange(type: string): void {
    this.svc.setReportTypeFilter((type as QualityReportType) || null);
  }

  acknowledgeAlert(alertId: string): void {
    this.svc.acknowledgeAlert(alertId).subscribe();
  }

  // ---------- template helpers ----------
  testStatusClass(status: string): string {
    switch (status) {
      case 'Passed':
        return 'status-passed';
      case 'Failed':
        return 'status-failed';
      case 'Skipped':
        return 'status-skipped';
      case 'Error':
        return 'status-error';
      default:
        return '';
    }
  }

  alertSeverityClass(severity: string): string {
    switch (severity) {
      case 'Critical':
        return 'severity-critical';
      case 'High':
        return 'severity-high';
      case 'Medium':
        return 'severity-medium';
      case 'Low':
        return 'severity-low';
      default:
        return '';
    }
  }

  coverageTrendIcon(trend: string): string {
    switch (trend) {
      case 'Rising':
        return 'trending_up';
      case 'Falling':
        return 'trending_down';
      case 'Stable':
        return 'trending_flat';
      default:
        return 'remove';
    }
  }

  coverageTrendClass(trend: string): string {
    switch (trend) {
      case 'Rising':
        return 'trend-rising';
      case 'Falling':
        return 'trend-falling';
      case 'Stable':
        return 'trend-stable';
      default:
        return '';
    }
  }

  scoreClass(score: number): string {
    if (score >= 90) return 'score-excellent';
    if (score >= 70) return 'score-good';
    if (score >= 50) return 'score-fair';
    return 'score-poor';
  }

  trackByTestId(_: number, t: QualityTestResult): string {
    return t.id;
  }

  trackByAlertId(_: number, a: RegressionAlert): string {
    return a.id;
  }

  trackByReportId(_: number, r: QualityReport): string {
    return r.id;
  }

  trackByCoverageCategory(_: number, c: QueryCoverageMetric): string {
    return c.category;
  }
}
