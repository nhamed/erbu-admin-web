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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import {
  PaymentEvent,
  PaymentStatus,
  GatewayHealthStatus,
} from '@erbu-admin-web/shared/models';
import {
  PaymentMonitorService,
  PaymentDashboard,
  PaymentKpi,
  PaymentVolumePoint,
} from './payment-monitor.service';
import { PaymentEventsComponent } from './tabs/payment-events.component';
import { PaymentAuditComponent } from './tabs/payment-audit.component';
import { DriverVirementsComponent } from './tabs/driver-virements.component';

// ---------- ECharts dynamic import type ----------
type EChartsInstance = {
  setOption(option: unknown, notMerge?: boolean): void;
  resize(): void;
  dispose(): void;
};

@Component({
  selector: 'app-payment-monitor',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    PaymentEventsComponent,
    PaymentAuditComponent,
    DriverVirementsComponent,
  ],
  templateUrl: './payment-monitor.page.html',
  styleUrl: './payment-monitor.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentMonitorPage implements OnInit, OnDestroy {
  private readonly svc = inject(PaymentMonitorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly dialog = inject(MatDialog);

  // ---------- signals ----------
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly lastUpdated = signal('');
  readonly activeTab = signal(0);

  readonly kpi = signal<PaymentKpi>({
    totalVolume: 0,
    totalVolumeChange: 0,
    pendingCount: 0,
    pendingCountChange: 0,
    failedCount: 0,
    failedCountChange: 0,
    successRate: 0,
    successRateChange: 0,
    currency: 'TND',
  });

  readonly volumeHistory = signal<PaymentVolumePoint[]>([]);
  readonly gatewayStatus = signal<GatewayHealthStatus>(
    GatewayHealthStatus.Unknown,
  );

  // ---------- selected payment for drill-down ----------
  readonly selectedEvent = signal<PaymentEvent | null>(null);

  // ---------- computed ----------
  readonly kpiCards = computed(() => {
    const k = this.kpi();
    return [
      {
        label: 'Total Volume',
        value: k.totalVolume,
        change: k.totalVolumeChange,
        icon: 'payments',
        format: 'currency' as const,
        currency: k.currency,
      },
      {
        label: 'Pending',
        value: k.pendingCount,
        change: k.pendingCountChange,
        icon: 'hourglass_empty',
        format: 'number' as const,
        currency: k.currency,
      },
      {
        label: 'Failed',
        value: k.failedCount,
        change: k.failedCountChange,
        icon: 'error_outline',
        format: 'number' as const,
        currency: k.currency,
      },
      {
        label: 'Success Rate',
        value: k.successRate,
        change: k.successRateChange,
        icon: 'check_circle',
        format: 'percent' as const,
        currency: k.currency,
      },
    ];
  });

  readonly gatewayStatusClass = computed(() => {
    switch (this.gatewayStatus()) {
      case GatewayHealthStatus.Healthy:
        return 'gw-healthy';
      case GatewayHealthStatus.Degraded:
        return 'gw-degraded';
      case GatewayHealthStatus.Down:
        return 'gw-down';
      default:
        return 'gw-unknown';
    }
  });

  // ---------- ECharts ----------
  private volumeChart: EChartsInstance | null = null;
  private failureChart: EChartsInstance | null = null;
  private resizeHandler = () => {
    this.volumeChart?.resize();
    this.failureChart?.resize();
  };

  // ---------- lifecycle ----------
  ngOnInit(): void {
    this.svc.dashboard$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => this.applyDashboard(d),
        error: (err) => {
          this.error.set(
            err?.message ?? 'Failed to load payment monitor data',
          );
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
    this.volumeChart?.dispose();
    this.volumeChart = null;
    this.failureChart?.dispose();
    this.failureChart = null;
  }

  // ---------- template helpers ----------
  formatValue(
    value: number,
    format: 'currency' | 'number' | 'percent',
    currency?: string,
  ): string {
    switch (format) {
      case 'currency':
        return value.toLocaleString('en', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }) + ' ' + (currency ?? '');
      case 'percent':
        return value.toFixed(1) + '%';
      default:
        return value.toLocaleString();
    }
  }

  trendClass(change: number): string {
    if (change > 0) return 'trend-up';
    if (change < 0) return 'trend-down';
    return 'trend-neutral';
  }

  trendIcon(change: number): string {
    if (change > 0) return 'arrow_upward';
    if (change < 0) return 'arrow_downward';
    return 'remove';
  }

  onTabChange(index: number): void {
    this.activeTab.set(index);
  }

  onEventSelected(event: PaymentEvent): void {
    this.selectedEvent.set(event);
  }

  closeDetail(): void {
    this.selectedEvent.set(null);
  }

  getDetailStatusClass(status: PaymentStatus): string {
    return 'detail-status-' + status.toLowerCase();
  }

  // ---------- private ----------
  private applyDashboard(d: PaymentDashboard): void {
    this.kpi.set(d.kpi);
    this.volumeHistory.set(d.volumeHistory);
    this.gatewayStatus.set(d.monitor.gatewayStatus);
    this.lastUpdated.set(d.monitor.lastCheckedAt);
    this.loading.set(false);
    this.error.set(null);

    if (this.volumeChart) {
      this.updateVolumeChart(d.volumeHistory);
    }
    if (this.failureChart) {
      this.updateFailureChart(d.volumeHistory);
    }
  }

  private async initCharts(): Promise<void> {
    try {
      const echarts = await import('echarts/core');
      const { LineChart, BarChart } = await import('echarts/charts');
      const { GridComponent, TooltipComponent, LegendComponent } =
        await import('echarts/components');
      const { CanvasRenderer } = await import('echarts/renderers');

      echarts.use([
        LineChart,
        BarChart,
        GridComponent,
        TooltipComponent,
        LegendComponent,
        CanvasRenderer,
      ]);

      // Volume chart
      const volumeContainer = document.getElementById(
        'payment-volume-chart',
      );
      if (volumeContainer) {
        this.volumeChart = echarts.init(
          volumeContainer,
          'dark',
        ) as unknown as EChartsInstance;
        this.updateVolumeChart(this.volumeHistory());
      }

      // Failure rate chart
      const failureContainer = document.getElementById(
        'payment-failure-chart',
      );
      if (failureContainer) {
        this.failureChart = echarts.init(
          failureContainer,
          'dark',
        ) as unknown as EChartsInstance;
        this.updateFailureChart(this.volumeHistory());
      }

      window.addEventListener('resize', this.resizeHandler);
    } catch {
      // echarts not available -- silently degrade
    }
  }

  private updateVolumeChart(data: PaymentVolumePoint[]): void {
    if (!this.volumeChart || data.length === 0) return;

    const timestamps = data.map((p) =>
      new Date(p.timestamp).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    );

    this.volumeChart.setOption(
      {
        tooltip: { trigger: 'axis' },
        legend: {
          data: ['Payment Volume', 'Transaction Count'],
          bottom: 0,
          textStyle: { color: '#b0b0b0' },
        },
        grid: {
          left: 56,
          right: 56,
          top: 16,
          bottom: 40,
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          data: timestamps,
          axisLine: { lineStyle: { color: '#555' } },
          axisLabel: { color: '#b0b0b0' },
        },
        yAxis: [
          {
            type: 'value',
            name: 'Volume',
            nameTextStyle: { color: '#b0b0b0' },
            axisLabel: { color: '#b0b0b0' },
            splitLine: { lineStyle: { color: '#333' } },
          },
          {
            type: 'value',
            name: 'Count',
            nameTextStyle: { color: '#b0b0b0' },
            axisLabel: { color: '#b0b0b0' },
            splitLine: { show: false },
          },
        ],
        series: [
          {
            name: 'Payment Volume',
            type: 'bar',
            data: data.map((p) => p.volume),
            itemStyle: { color: '#5b8ff9', borderRadius: [4, 4, 0, 0] },
            barMaxWidth: 24,
          },
          {
            name: 'Transaction Count',
            type: 'line',
            yAxisIndex: 1,
            data: data.map((p) => p.count),
            smooth: true,
            lineStyle: { width: 2, color: '#5ad8a6' },
            itemStyle: { color: '#5ad8a6' },
          },
        ],
      },
      true,
    );
  }

  private updateFailureChart(data: PaymentVolumePoint[]): void {
    if (!this.failureChart || data.length === 0) return;

    const timestamps = data.map((p) =>
      new Date(p.timestamp).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    );

    this.failureChart.setOption(
      {
        tooltip: {
          trigger: 'axis',
          formatter: (params: Array<{ name: string; value: number }>) => {
            const p = params[0];
            return `${p.name}<br/>Failure Rate: ${p.value}%`;
          },
        },
        grid: {
          left: 48,
          right: 24,
          top: 16,
          bottom: 24,
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          data: timestamps,
          axisLine: { lineStyle: { color: '#555' } },
          axisLabel: { color: '#b0b0b0' },
        },
        yAxis: {
          type: 'value',
          name: 'Failure %',
          nameTextStyle: { color: '#b0b0b0' },
          axisLabel: { color: '#b0b0b0', formatter: '{value}%' },
          splitLine: { lineStyle: { color: '#333' } },
          max: 100,
        },
        series: [
          {
            name: 'Failure Rate',
            type: 'line',
            data: data.map((p) => +(p.failureRate * 100).toFixed(2)),
            smooth: true,
            lineStyle: { width: 2, color: '#ff6b6b' },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(255,107,107,0.3)' },
                  { offset: 1, color: 'rgba(255,107,107,0.02)' },
                ],
              },
            },
            itemStyle: { color: '#ff6b6b' },
          },
        ],
      },
      true,
    );
  }
}
