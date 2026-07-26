import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  ServicesDashboardService,
  ServicesDashboardData,
  MicroserviceInfo,
  ServiceHealthStatus,
  PrometheusSnapshot,
  ServiceActionLog,
  ServiceControlAction,
} from './services-dashboard.service';

@Component({
  selector: 'app-services-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './services-dashboard.page.html',
  styleUrl: './services-dashboard.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicesDashboardPage implements OnInit, OnDestroy {
  private readonly svc = inject(ServicesDashboardService);
  private readonly destroyRef = inject(DestroyRef);

  // ---------- signals ----------
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly lastUpdated = signal<string>('');
  readonly actionInProgress = signal<string | null>(null);
  readonly actionMessage = signal<{ text: string; success: boolean } | null>(null);
  readonly confirmAction = signal<{ service: MicroserviceInfo; action: 'restart' | 'drain' } | null>(null);

  readonly services = signal<MicroserviceInfo[]>([]);
  readonly prometheus = signal<PrometheusSnapshot>({
    totalRequests: 0,
    totalErrors: 0,
    avgLatencyMs: 0,
    cpuUsagePercent: 0,
    memoryUsagePercent: 0,
    diskUsagePercent: 0,
    activeGoroutines: 0,
    openFileDescriptors: 0,
    metrics: [],
  });
  readonly actionLogs = signal<ServiceActionLog[]>([]);
  readonly selectedService = signal<MicroserviceInfo | null>(null);
  readonly filterStatus = signal<ServiceHealthStatus | 'all'>('all');
  readonly searchQuery = signal('');
  readonly showLogs = signal(false);

  // ---------- computed ----------
  readonly healthyCount = computed(
    () => this.services().filter((s) => s.status === 'healthy').length,
  );
  readonly degradedCount = computed(
    () => this.services().filter((s) => s.status === 'degraded').length,
  );
  readonly downCount = computed(
    () => this.services().filter((s) => s.status === 'down').length,
  );
  readonly totalCount = computed(() => this.services().length);

  readonly filteredServices = computed(() => {
    let list = this.services();
    const status = this.filterStatus();
    const query = this.searchQuery().toLowerCase().trim();

    if (status !== 'all') {
      list = list.filter((s) => s.status === status);
    }
    if (query) {
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          s.endpoint.toLowerCase().includes(query),
      );
    }
    return list;
  });

  readonly kpiCards = computed(() => {
    const p = this.prometheus();
    return [
      {
        label: 'Total Requests',
        value: p.totalRequests.toLocaleString(),
        icon: 'swap_vert',
        color: 'blue',
      },
      {
        label: 'Error Rate',
        value:
          p.totalRequests > 0
            ? ((p.totalErrors / p.totalRequests) * 100).toFixed(2) + '%'
            : '0%',
        icon: 'error_outline',
        color: p.totalErrors > 0 ? 'red' : 'green',
      },
      {
        label: 'Avg Latency',
        value: p.avgLatencyMs.toFixed(1) + ' ms',
        icon: 'speed',
        color: p.avgLatencyMs > 500 ? 'orange' : 'green',
      },
      {
        label: 'CPU Usage',
        value: p.cpuUsagePercent.toFixed(1) + '%',
        icon: 'memory',
        color: p.cpuUsagePercent > 80 ? 'red' : p.cpuUsagePercent > 60 ? 'orange' : 'green',
      },
      {
        label: 'Memory Usage',
        value: p.memoryUsagePercent.toFixed(1) + '%',
        icon: 'data_usage',
        color:
          p.memoryUsagePercent > 85 ? 'red' : p.memoryUsagePercent > 70 ? 'orange' : 'green',
      },
      {
        label: 'Disk Usage',
        value: p.diskUsagePercent.toFixed(1) + '%',
        icon: 'storage',
        color: p.diskUsagePercent > 90 ? 'red' : p.diskUsagePercent > 75 ? 'orange' : 'green',
      },
    ];
  });

  // ---------- refresh timer ----------
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  // ---------- lifecycle ----------
  ngOnInit(): void {
    this.svc.dashboard$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => this.applyDashboard(d),
        error: (err) => {
          this.error.set(err?.message ?? 'Failed to load services dashboard');
          this.loading.set(false);
        },
      });
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // ---------- data ----------
  private applyDashboard(d: ServicesDashboardData): void {
    this.services.set(d.services);
    this.prometheus.set(d.prometheus);
    this.lastUpdated.set(d.lastUpdatedAt);
    this.loading.set(false);
    this.error.set(null);
  }

  // ---------- actions ----------
  requestAction(service: MicroserviceInfo, action: 'restart' | 'drain'): void {
    this.confirmAction.set({ service, action });
  }

  cancelConfirm(): void {
    this.confirmAction.set(null);
  }

  executeConfirmedAction(): void {
    const pending = this.confirmAction();
    if (!pending) return;

    this.confirmAction.set(null);
    this.actionInProgress.set(pending.service.id);
    this.actionMessage.set(null);

    const payload: ServiceControlAction = {
      serviceId: pending.service.id,
      action: pending.action,
    };

    this.svc
      .executeAction(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.actionInProgress.set(null);
          this.actionMessage.set({
            text: result.message,
            success: result.success,
          });
          this.clearActionMessageAfterDelay();
        },
        error: (err) => {
          this.actionInProgress.set(null);
          this.actionMessage.set({
            text: err?.message ?? 'Action failed',
            success: false,
          });
          this.clearActionMessageAfterDelay();
        },
      });
  }

  toggleLogs(): void {
    const show = !this.showLogs();
    this.showLogs.set(show);
    if (show && this.actionLogs().length === 0) {
      this.loadActionLogs();
    }
  }

  selectService(service: MicroserviceInfo): void {
    this.selectedService.set(
      this.selectedService()?.id === service.id ? null : service,
    );
  }

  setFilterStatus(status: ServiceHealthStatus | 'all'): void {
    this.filterStatus.set(status);
  }

  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  // ---------- helpers ----------
  private loadActionLogs(): void {
    this.svc
      .fetchActionLogs()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (logs) => this.actionLogs.set(logs),
        error: () => {},
      });
  }

  private clearActionMessageAfterDelay(): void {
    setTimeout(() => this.actionMessage.set(null), 5000);
  }

  formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  statusClass(status: ServiceHealthStatus): string {
    switch (status) {
      case 'healthy':
        return 'status-healthy';
      case 'degraded':
        return 'status-degraded';
      case 'down':
        return 'status-down';
      default:
        return '';
    }
  }

  memoryPercent(service: MicroserviceInfo): number {
    return service.memoryLimitMb > 0
      ? (service.memoryMb / service.memoryLimitMb) * 100
      : 0;
  }

  trackByServiceId(_: number, svc: MicroserviceInfo): string {
    return svc.id;
  }

  trackByLogId(_: number, log: ServiceActionLog): string {
    return log.id;
  }
}
