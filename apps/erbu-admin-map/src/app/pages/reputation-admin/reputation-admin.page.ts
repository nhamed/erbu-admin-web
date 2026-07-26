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
  ReputationService,
  ReputationScore,
  FraudAlert,
  UserType,
  FraudAlertStatus,
  FraudAlertSeverity,
  ScoreAdjustment,
} from './reputation.service';

type EChartsInstance = {
  setOption(option: unknown, notMerge?: boolean): void;
  resize(): void;
  dispose(): void;
};

@Component({
  selector: 'app-reputation-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reputation-admin.page.html',
  styleUrl: './reputation-admin.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReputationAdminPage implements OnInit, OnDestroy {
  private readonly svc = inject(ReputationService);
  private readonly platformId = inject(PLATFORM_ID);

  // ---------- state ----------
  readonly loading = this.svc.loading;
  readonly error = this.svc.error;
  readonly summary = this.svc.summary;
  readonly scores = this.svc.filteredScores;
  readonly fraudAlerts = this.svc.fraudAlerts;
  readonly selectedUser = this.svc.selectedUser;
  readonly scoreHistory = this.svc.scoreHistory;
  readonly scoreChange = this.svc.scoreChange;
  readonly openAlertCount = this.svc.openAlertCount;
  readonly filterUserType = this.svc.filterUserType;
  readonly filterFlagged = this.svc.filterFlagged;

  // adjustment form
  readonly adjustmentAmount = signal(0);
  readonly adjustmentReason = signal('');
  readonly adjustmentSubmitting = signal(false);

  // active section
  readonly activeSection = signal<'scores' | 'fraud'>('scores');

  // ---------- computed ----------
  readonly kpiCards = computed(() => {
    const s = this.summary();
    return [
      { label: 'Drivers', value: s.totalDrivers, icon: 'directions_car', cssClass: 'kpi-drivers' },
      { label: 'Riders', value: s.totalRiders, icon: 'person', cssClass: 'kpi-riders' },
      { label: 'Avg Driver Score', value: s.avgDriverScore.toFixed(1), icon: 'star', cssClass: 'kpi-driver-score' },
      { label: 'Avg Rider Score', value: s.avgRiderScore.toFixed(1), icon: 'star_half', cssClass: 'kpi-rider-score' },
      { label: 'Flagged', value: s.flaggedCount, icon: 'flag', cssClass: 'kpi-flagged' },
      { label: 'Open Fraud Alerts', value: s.openFraudAlerts, icon: 'security', cssClass: 'kpi-fraud' },
    ];
  });

  readonly userTypeOptions: UserType[] = ['Driver', 'Rider'];
  readonly fraudStatusOptions: FraudAlertStatus[] = ['Open', 'Investigating', 'Resolved', 'Dismissed'];

  // ---------- chart ----------
  private historyChart: EChartsInstance | null = null;
  private resizeHandler = () => this.historyChart?.resize();

  // ---------- lifecycle ----------
  ngOnInit(): void {
    this.svc.loadSummary();
    this.svc.loadScores();
    this.svc.loadFraudAlerts();
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    this.historyChart?.dispose();
    this.historyChart = null;
  }

  // ---------- chart ----------
  private async initHistoryChart(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const container = document.getElementById('score-history-chart');
    if (!container) return;

    try {
      const echarts = await import('echarts/core');
      const { LineChart } = await import('echarts/charts');
      const { GridComponent, TooltipComponent } = await import('echarts/components');
      const { CanvasRenderer } = await import('echarts/renderers');

      echarts.use([LineChart, GridComponent, TooltipComponent, CanvasRenderer]);
      this.historyChart = echarts.init(container, 'dark') as unknown as EChartsInstance;
      this.updateHistoryChart();
      window.addEventListener('resize', this.resizeHandler);
    } catch {
      // echarts unavailable
    }
  }

  private updateHistoryChart(): void {
    if (!this.historyChart) return;
    const data = this.scoreHistory();
    if (data.length === 0) return;

    this.historyChart.setOption(
      {
        tooltip: { trigger: 'axis' },
        grid: { left: 48, right: 24, top: 16, bottom: 32, containLabel: true },
        xAxis: {
          type: 'category',
          data: data.map((p) => new Date(p.timestamp).toLocaleDateString()),
          axisLabel: { color: '#b0b0b0' },
          axisLine: { lineStyle: { color: '#555' } },
        },
        yAxis: {
          type: 'value',
          name: 'Score',
          nameTextStyle: { color: '#b0b0b0' },
          axisLabel: { color: '#b0b0b0' },
          splitLine: { lineStyle: { color: '#333' } },
        },
        series: [
          {
            type: 'line',
            data: data.map((p) => p.score),
            smooth: true,
            lineStyle: { width: 2, color: '#1890ff' },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(24,144,255,0.3)' },
                  { offset: 1, color: 'rgba(24,144,255,0.02)' },
                ],
              },
            },
            itemStyle: { color: '#1890ff' },
          },
        ],
      },
      true,
    );
  }

  // ---------- template actions ----------
  onUserTypeChange(type: string): void {
    this.svc.setUserTypeFilter((type as UserType) || null);
  }

  onFlaggedChange(flagged: boolean): void {
    this.svc.setFlaggedFilter(flagged);
  }

  selectUser(user: ReputationScore): void {
    this.svc.selectUser(user);
    this.adjustmentAmount.set(0);
    this.adjustmentReason.set('');

    // defer chart init so container is rendered
    setTimeout(() => this.initHistoryChart(), 50);
  }

  closeUserDetail(): void {
    this.svc.selectUser(null);
    this.historyChart?.dispose();
    this.historyChart = null;
  }

  submitAdjustment(): void {
    const user = this.selectedUser();
    if (!user) return;

    const amount = this.adjustmentAmount();
    const reason = this.adjustmentReason().trim();
    if (amount === 0 || !reason) return;

    this.adjustmentSubmitting.set(true);

    const data: ScoreAdjustment = {
      userId: user.userId,
      adjustment: amount,
      reason,
    };

    this.svc.adjustScore(data).subscribe({
      next: () => {
        this.adjustmentAmount.set(0);
        this.adjustmentReason.set('');
        this.adjustmentSubmitting.set(false);
        // refresh history
        this.svc.loadScoreHistory(user.userId);
        setTimeout(() => this.updateHistoryChart(), 200);
      },
      error: () => {
        this.adjustmentSubmitting.set(false);
      },
    });
  }

  updateAlertStatus(alertId: string, status: FraudAlertStatus): void {
    this.svc.updateFraudAlertStatus(alertId, status).subscribe();
  }

  switchSection(section: 'scores' | 'fraud'): void {
    this.activeSection.set(section);
  }

  // ---------- template helpers ----------
  scoreColorClass(score: number): string {
    if (score >= 80) return 'score-good';
    if (score >= 50) return 'score-warn';
    return 'score-bad';
  }

  changeIcon(change: number): string {
    if (change > 0) return 'arrow_upward';
    if (change < 0) return 'arrow_downward';
    return 'remove';
  }

  changeClass(change: number): string {
    if (change > 0) return 'trend-up';
    if (change < 0) return 'trend-down';
    return 'trend-neutral';
  }

  severityClass(severity: FraudAlertSeverity): string {
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

  alertStatusClass(status: FraudAlertStatus): string {
    switch (status) {
      case 'Open':
        return 'alert-status-open';
      case 'Investigating':
        return 'alert-status-investigating';
      case 'Resolved':
        return 'alert-status-resolved';
      case 'Dismissed':
        return 'alert-status-dismissed';
      default:
        return '';
    }
  }

  userTypeClass(type: UserType): string {
    return type === 'Driver' ? 'type-driver' : 'type-rider';
  }

  trackByUserId(_: number, s: ReputationScore): string {
    return s.userId;
  }

  trackByAlertId(_: number, a: FraudAlert): string {
    return a.id;
  }
}
