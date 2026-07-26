import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ObservabilityService,
  LogRetentionPolicy,
  TraceStorageQuota,
  CleanupSchedule,
} from './observability.service';
import { DevToolsService } from '@erbu-admin-web/shared/data-access';

const AUTO_REFRESH_MS = 30_000;

@Component({
  selector: 'app-observability-storage',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './observability-storage.page.html',
  styleUrl: './observability-storage.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ObservabilityStoragePage implements OnInit, OnDestroy {
  private readonly obsService = inject(ObservabilityService);
  readonly devTools = inject(DevToolsService);
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  // ── State ──────────────────────────────────────────────
  readonly overview = this.obsService.overview;
  readonly logPolicies = this.obsService.logPolicies;
  readonly metricsStats = this.obsService.metricsStats;
  readonly traceQuotas = this.obsService.traceQuotas;
  readonly cleanupSchedules = this.obsService.cleanupSchedules;
  readonly loading = this.obsService.loading;
  readonly error = this.obsService.error;

  readonly activeTab = signal<'logs' | 'metrics' | 'traces' | 'cleanup'>('logs');
  readonly lastRefreshed = signal<Date | null>(null);
  readonly triggeringCleanup = signal<string | null>(null);

  // ── Computed KPIs ──────────────────────────────────────
  readonly diskUtilization = this.obsService.diskUtilization;
  readonly diskUtilizationClass = this.obsService.diskUtilizationClass;
  readonly totalStorageDisplay = this.obsService.totalStorageDisplay;
  readonly logStorageDisplay = this.obsService.logStorageDisplay;
  readonly metricsStorageDisplay = this.obsService.metricsStorageDisplay;
  readonly traceStorageDisplay = this.obsService.traceStorageDisplay;
  readonly daysUntilFull = this.obsService.daysUntilFull;
  readonly overQuotaServices = this.obsService.overQuotaServices;
  readonly activeCleanups = this.obsService.activeCleanups;

  readonly daysUntilFullDisplay = computed(() => {
    const days = this.daysUntilFull();
    if (days === null) return 'N/A';
    if (days <= 7) return `${days}d`;
    return `${Math.floor(days / 7)}w ${days % 7}d`;
  });

  readonly daysUntilFullClass = computed(() => {
    const days = this.daysUntilFull();
    if (days === null) return '';
    if (days <= 7) return 'days-critical';
    if (days <= 30) return 'days-warning';
    return 'days-ok';
  });

  readonly ingestionRate = computed(
    () => this.overview()?.ingestionRateMbPerMin ?? 0,
  );

  // ── Storage breakdown for bar chart ────────────────────
  readonly storageBreakdown = computed(() => {
    const ov = this.overview();
    if (!ov || ov.totalStorageSizeBytes === 0) return [];
    const total = ov.totalStorageSizeBytes;
    return [
      {
        label: 'Logs',
        percent: (ov.logStorageSizeBytes / total) * 100,
        color: '#5b8ff9',
        display: ov.logStorageSizeDisplay,
      },
      {
        label: 'Metrics',
        percent: (ov.metricsStorageSizeBytes / total) * 100,
        color: '#4caf50',
        display: ov.metricsStorageSizeDisplay,
      },
      {
        label: 'Traces',
        percent: (ov.traceStorageSizeBytes / total) * 100,
        color: '#ff9800',
        display: ov.traceStorageSizeDisplay,
      },
    ];
  });

  // ── Lifecycle ──────────────────────────────────────────
  ngOnInit(): void {
    this.loadAll();
    this.refreshTimer = setInterval(() => this.loadAll(), AUTO_REFRESH_MS);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // ── Actions ────────────────────────────────────────────
  onTabChange(tab: 'logs' | 'metrics' | 'traces' | 'cleanup'): void {
    this.activeTab.set(tab);
  }

  onToggleLogPolicy(policy: LogRetentionPolicy): void {
    this.obsService
      .updateLogPolicy(policy.id, { isEnabled: !policy.isEnabled })
      .subscribe();
  }

  onToggleCleanupSchedule(schedule: CleanupSchedule): void {
    this.obsService
      .toggleCleanupSchedule(schedule.id, !schedule.isEnabled)
      .subscribe();
  }

  onTriggerCleanup(schedule: CleanupSchedule): void {
    this.triggeringCleanup.set(schedule.id);
    this.obsService.triggerCleanup(schedule.id).subscribe({
      next: () => this.triggeringCleanup.set(null),
      error: () => this.triggeringCleanup.set(null),
    });
  }

  onRefresh(): void {
    this.loadAll();
  }

  onDismissError(): void {
    this.obsService.clearError();
  }

  // ── Template helpers ───────────────────────────────────
  trackByPolicy(_: number, policy: LogRetentionPolicy): string {
    return policy.id;
  }

  trackByQuota(_: number, quota: TraceStorageQuota): string {
    return quota.id;
  }

  trackBySchedule(_: number, schedule: CleanupSchedule): string {
    return schedule.id;
  }

  utilizationClass(pct: number): string {
    if (pct >= 90) return 'util-critical';
    if (pct >= 75) return 'util-warning';
    return 'util-healthy';
  }

  statusIcon(status: string): string {
    switch (status) {
      case 'Success': return 'check_circle';
      case 'Failed': return 'error';
      case 'Running': return 'sync';
      case 'Never': return 'schedule';
      default: return 'help_outline';
    }
  }

  statusClass(status: string): string {
    switch (status) {
      case 'Success': return 'status-success';
      case 'Failed': return 'status-failed';
      case 'Running': return 'status-running';
      default: return 'status-unknown';
    }
  }

  targetTypeIcon(type: string): string {
    switch (type) {
      case 'logs': return 'article';
      case 'metrics': return 'analytics';
      case 'traces': return 'timeline';
      default: return 'storage';
    }
  }

  // ── Private ────────────────────────────────────────────
  private loadAll(): void {
    this.obsService.loadOverview();
    this.obsService.loadLogPolicies();
    this.obsService.loadMetricsStats();
    this.obsService.loadTraceQuotas();
    this.obsService.loadCleanupSchedules();
    this.lastRefreshed.set(new Date());
  }
}
