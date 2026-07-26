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
  DriverMonitorService,
  DriverPosition,
  DriverAlert,
  DriverStatus,
  GpsQuality,
  AlertSeverity,
} from './driver-monitor.service';

type EChartsInstance = {
  setOption(option: unknown, notMerge?: boolean): void;
  resize(): void;
  dispose(): void;
};

@Component({
  selector: 'app-driver-monitor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './driver-monitor.page.html',
  styleUrl: './driver-monitor.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriverMonitorPage implements OnInit, OnDestroy {
  private readonly svc = inject(DriverMonitorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  // ---------- state ----------
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly lastUpdated = signal<string>('');

  // delegated from service
  readonly kpi = this.svc.kpi;
  readonly drivers = this.svc.filteredDrivers;
  readonly alerts = this.svc.alerts;
  readonly zones = this.svc.zones;
  readonly selectedZone = this.svc.selectedZone;
  readonly selectedStatus = this.svc.selectedStatus;
  readonly criticalAlerts = this.svc.criticalAlerts;

  // ---------- computed ----------
  readonly kpiCards = computed(() => {
    const k = this.kpi();
    return [
      { label: 'Online', value: k.totalOnline, icon: 'wifi', cssClass: 'kpi-online' },
      { label: 'On Trip', value: k.totalOnTrip, icon: 'directions_car', cssClass: 'kpi-trip' },
      { label: 'Idle', value: k.totalIdle, icon: 'pause_circle', cssClass: 'kpi-idle' },
      { label: 'Offline', value: k.totalOffline, icon: 'wifi_off', cssClass: 'kpi-offline' },
      { label: 'Avg GPS Accuracy', value: k.avgGpsAccuracy, icon: 'gps_fixed', cssClass: 'kpi-gps', suffix: 'm' },
      { label: 'Avg Speed', value: k.avgSpeedKmh, icon: 'speed', cssClass: 'kpi-speed', suffix: 'km/h' },
    ];
  });

  readonly unacknowledgedAlertCount = computed(
    () => this.alerts().filter((a) => !a.acknowledged).length,
  );

  readonly statusOptions: DriverStatus[] = ['Online', 'Offline', 'OnTrip', 'Idle', 'Suspended'];

  // ---------- map ----------
  private mapChart: EChartsInstance | null = null;
  private resizeHandler = () => this.mapChart?.resize();

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
          this.error.set(err?.message ?? 'Failed to load driver monitor data');
          this.loading.set(false);
        },
      });

    if (isPlatformBrowser(this.platformId)) {
      afterNextRender(() => this.initMap(), { injector: undefined! });
    }
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    this.mapChart?.dispose();
    this.mapChart = null;
  }

  // ---------- map init ----------
  private async initMap(): Promise<void> {
    const container = document.getElementById('driver-map-chart');
    if (!container) return;

    try {
      const echarts = await import('echarts/core');
      const { ScatterChart } = await import('echarts/charts');
      const { GridComponent, TooltipComponent, LegendComponent } =
        await import('echarts/components');
      const { CanvasRenderer } = await import('echarts/renderers');

      echarts.use([ScatterChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);
      this.mapChart = echarts.init(container, 'dark') as unknown as EChartsInstance;
      this.updateMapData();
      window.addEventListener('resize', this.resizeHandler);
    } catch {
      // echarts unavailable -- degrade silently
    }
  }

  private updateMapData(): void {
    if (!this.mapChart) return;
    const list = this.drivers();
    if (list.length === 0) return;

    const colorMap: Record<DriverStatus, string> = {
      Online: '#52c41a',
      OnTrip: '#1890ff',
      Idle: '#faad14',
      Offline: '#8c8c8c',
      Suspended: '#ff4d4f',
    };

    const seriesData = list.map((d) => ({
      value: [d.longitude, d.latitude],
      name: d.driverName,
      itemStyle: { color: colorMap[d.status] ?? '#8c8c8c' },
    }));

    this.mapChart.setOption(
      {
        tooltip: {
          trigger: 'item',
          formatter: (params: { name: string; value: number[] }) =>
            `${params.name}<br/>Lng: ${params.value[0].toFixed(5)}, Lat: ${params.value[1].toFixed(5)}`,
        },
        xAxis: {
          type: 'value',
          name: 'Longitude',
          nameTextStyle: { color: '#b0b0b0' },
          axisLabel: { color: '#b0b0b0' },
          splitLine: { lineStyle: { color: '#333' } },
        },
        yAxis: {
          type: 'value',
          name: 'Latitude',
          nameTextStyle: { color: '#b0b0b0' },
          axisLabel: { color: '#b0b0b0' },
          splitLine: { lineStyle: { color: '#333' } },
        },
        series: [
          {
            type: 'scatter',
            data: seriesData,
            symbolSize: 10,
          },
        ],
      },
      true,
    );
  }

  // ---------- template actions ----------
  onZoneChange(zone: string): void {
    this.svc.setZoneFilter(zone || null);
    this.updateMapData();
  }

  onStatusChange(status: string): void {
    this.svc.setStatusFilter((status as DriverStatus) || null);
    this.updateMapData();
  }

  acknowledgeAlert(alertId: string): void {
    this.svc.acknowledgeAlert(alertId).subscribe();
  }

  // ---------- template helpers ----------
  statusClass(status: DriverStatus): string {
    switch (status) {
      case 'Online':
        return 'status-online';
      case 'OnTrip':
        return 'status-ontrip';
      case 'Idle':
        return 'status-idle';
      case 'Offline':
        return 'status-offline';
      case 'Suspended':
        return 'status-suspended';
      default:
        return '';
    }
  }

  gpsClass(quality: GpsQuality): string {
    switch (quality) {
      case 'Excellent':
        return 'gps-excellent';
      case 'Good':
        return 'gps-good';
      case 'Poor':
        return 'gps-poor';
      case 'NoSignal':
        return 'gps-nosignal';
      default:
        return '';
    }
  }

  severityClass(severity: AlertSeverity): string {
    switch (severity) {
      case 'Critical':
        return 'alert-critical';
      case 'Warning':
        return 'alert-warning';
      case 'Info':
        return 'alert-info';
      default:
        return '';
    }
  }

  trackByDriverId(_: number, d: DriverPosition): string {
    return d.driverId;
  }

  trackByAlertId(_: number, a: DriverAlert): string {
    return a.id;
  }
}
