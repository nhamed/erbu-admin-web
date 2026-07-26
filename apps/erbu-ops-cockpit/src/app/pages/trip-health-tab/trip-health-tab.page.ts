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
import { TripHealth, TripStatus } from '@erbu-admin-web/shared/models';

import {
  TripHealthService,
  TripHealthDashboard,
  TripHealthKpi,
  TripHealthRow,
  ServiceStatus,
  TripVolumePoint,
} from './trip-health.service';

// ---------- ECharts dynamic import type ----------
type EChartsInstance = {
  setOption(option: unknown, notMerge?: boolean): void;
  resize(): void;
  dispose(): void;
};

@Component({
  selector: 'app-trip-health-tab',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './trip-health-tab.page.html',
  styleUrl: './trip-health-tab.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripHealthTabPage implements OnInit, OnDestroy {
  private readonly svc = inject(TripHealthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  // ---------- signals ----------
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly lastUpdated = signal<string>('');

  readonly kpi = signal<TripHealthKpi>({
    activeTrips: 0,
    activeTripsChange: 0,
    failedTrips: 0,
    failedTripsChange: 0,
    avgDurationMinutes: 0,
    avgDurationChange: 0,
    slaCompliancePercent: 0,
    slaComplianceChange: 0,
  });

  readonly trips = signal<TripHealthRow[]>([]);
  readonly services = signal<ServiceStatus[]>([]);
  readonly volumeHistory = signal<TripVolumePoint[]>([]);
  readonly health = signal<TripHealth | null>(null);

  // ---------- computed ----------
  readonly healthyServices = computed(
    () => this.services().filter((s) => s.status === 'Healthy').length,
  );
  readonly totalServices = computed(() => this.services().length);

  readonly kpiCards = computed(() => {
    const k = this.kpi();
    return [
      {
        label: 'Active Trips',
        value: k.activeTrips,
        change: k.activeTripsChange,
        icon: 'directions_car',
        format: 'number',
      },
      {
        label: 'Failed Trips',
        value: k.failedTrips,
        change: k.failedTripsChange,
        icon: 'error_outline',
        format: 'number',
      },
      {
        label: 'Avg Duration',
        value: k.avgDurationMinutes,
        change: k.avgDurationChange,
        icon: 'schedule',
        format: 'duration',
      },
      {
        label: 'SLA Compliance',
        value: k.slaCompliancePercent,
        change: k.slaComplianceChange,
        icon: 'verified',
        format: 'percent',
      },
    ];
  });

  // ---------- ECharts ----------
  private chart: EChartsInstance | null = null;
  private resizeHandler = () => this.chart?.resize();

  // ---------- lifecycle ----------
  ngOnInit(): void {
    this.svc.dashboard$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => this.applyDashboard(d),
        error: (err) => {
          this.error.set(err?.message ?? 'Failed to load trip health data');
          this.loading.set(false);
        },
      });

    if (isPlatformBrowser(this.platformId)) {
      afterNextRender(() => this.initChart(), { injector: undefined! });
    }
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    this.chart?.dispose();
    this.chart = null;
  }

  // ---------- helpers ----------
  private applyDashboard(d: TripHealthDashboard): void {
    this.kpi.set(d.kpi);
    this.trips.set(d.trips);
    this.services.set(d.services);
    this.volumeHistory.set(d.volumeHistory);
    this.health.set(d.health);
    this.lastUpdated.set(d.health.lastUpdatedAt);
    this.loading.set(false);
    this.error.set(null);

    if (this.chart) {
      this.updateChartData(d.volumeHistory);
    }
  }

  private async initChart(): Promise<void> {
    const container = document.getElementById('trip-volume-chart');
    if (!container) return;

    try {
      const echarts = await import('echarts/core');
      const { LineChart } = await import('echarts/charts');
      const { GridComponent, TooltipComponent, LegendComponent } =
        await import('echarts/components');
      const { CanvasRenderer } = await import('echarts/renderers');

      echarts.use([
        LineChart,
        GridComponent,
        TooltipComponent,
        LegendComponent,
        CanvasRenderer,
      ]);

      this.chart = echarts.init(container, 'dark') as unknown as EChartsInstance;
      this.updateChartData(this.volumeHistory());

      window.addEventListener('resize', this.resizeHandler);
    } catch {
      // echarts not installed -- silently degrade
    }
  }

  private updateChartData(data: TripVolumePoint[]): void {
    if (!this.chart || data.length === 0) return;

    const timestamps = data.map((p) =>
      new Date(p.timestamp).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    );

    this.chart.setOption(
      {
        tooltip: {
          trigger: 'axis',
        },
        legend: {
          data: ['Trip Volume', 'Failure Rate %'],
          bottom: 0,
          textStyle: { color: '#b0b0b0' },
        },
        grid: {
          left: 48,
          right: 48,
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
            name: 'Trips',
            nameTextStyle: { color: '#b0b0b0' },
            axisLabel: { color: '#b0b0b0' },
            splitLine: { lineStyle: { color: '#333' } },
          },
          {
            type: 'value',
            name: 'Failure %',
            nameTextStyle: { color: '#b0b0b0' },
            axisLabel: { color: '#b0b0b0', formatter: '{value}%' },
            splitLine: { show: false },
            max: 100,
          },
        ],
        series: [
          {
            name: 'Trip Volume',
            type: 'line',
            data: data.map((p) => p.tripCount),
            smooth: true,
            lineStyle: { width: 2, color: '#5b8ff9' },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(91,143,249,0.3)' },
                  { offset: 1, color: 'rgba(91,143,249,0.02)' },
                ],
              },
            },
            itemStyle: { color: '#5b8ff9' },
          },
          {
            name: 'Failure Rate %',
            type: 'line',
            yAxisIndex: 1,
            data: data.map((p) => +(p.failureRate * 100).toFixed(2)),
            smooth: true,
            lineStyle: { width: 2, color: '#ff6b6b', type: 'dashed' },
            itemStyle: { color: '#ff6b6b' },
          },
        ],
      },
      true,
    );
  }

  // ---------- template helpers ----------
  formatValue(value: number, format: string): string {
    switch (format) {
      case 'percent':
        return value.toFixed(1) + '%';
      case 'duration':
        return value.toFixed(1) + ' min';
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

  statusClass(status: TripStatus | string): string {
    switch (status) {
      case TripStatus.Completed:
        return 'status-completed';
      case TripStatus.InProgress:
      case TripStatus.DriverEnRoute:
      case TripStatus.DriverArrived:
        return 'status-active';
      case TripStatus.Requested:
      case TripStatus.Searching:
      case TripStatus.DriverAssigned:
        return 'status-pending';
      case TripStatus.CancelledByRider:
      case TripStatus.CancelledByDriver:
      case TripStatus.CancelledBySystem:
        return 'status-cancelled';
      case TripStatus.Disputed:
      case TripStatus.NoDriverFound:
        return 'status-failed';
      default:
        return 'status-unknown';
    }
  }

  serviceStatusClass(status: string): string {
    switch (status) {
      case 'Healthy':
        return 'svc-healthy';
      case 'Degraded':
        return 'svc-degraded';
      case 'Down':
        return 'svc-down';
      default:
        return '';
    }
  }

  trackByTripId(_: number, row: TripHealthRow): string {
    return row.id;
  }

  trackByServiceName(_: number, svc: ServiceStatus): string {
    return svc.name;
  }
}
