import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { MatExpansionModule } from '@angular/material/expansion';

import {
  OrchestratorService,
  OrchestratorJob,
  JobDetail,
  JobStatus,
  OrchestratedService,
  Deployment,
  OrchestratorEvent,
  JobLogEntry,
  JobStep,
} from './orchestrator.service';

@Component({
  selector: 'app-orchestrator-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTabsModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatMenuModule,
    MatBadgeModule,
    MatDividerModule,
    MatExpansionModule,
  ],
  templateUrl: './orchestrator-admin.page.html',
  styleUrl: './orchestrator-admin.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrchestratorAdminPage implements OnInit, OnDestroy {
  protected readonly svc = inject(OrchestratorService);
  private readonly destroyRef = inject(DestroyRef);

  // ---- Local UI state ----
  readonly activeTab = signal<'jobs' | 'services' | 'deployments'>('jobs');
  readonly jobStatusFilter = signal<JobStatus | ''>('');
  readonly jobSearch = signal('');
  readonly currentPage = signal(1);
  readonly pageSize = signal(25);
  readonly liveEventLog = signal<OrchestratorEvent[]>([]);

  // ---- Filter options ----
  readonly jobStatuses: JobStatus[] = ['Queued', 'Running', 'Completed', 'Failed', 'Cancelled', 'Retrying'];

  // ---- Table columns ----
  readonly jobColumns: string[] = [
    'name',
    'type',
    'status',
    'progress',
    'priority',
    'createdAt',
    'duration',
    'actions',
  ];

  readonly serviceColumns: string[] = [
    'name',
    'version',
    'state',
    'instanceCount',
    'cpuPercent',
    'memoryMb',
    'uptimeSeconds',
    'actions',
  ];

  readonly deploymentColumns: string[] = [
    'serviceName',
    'version',
    'previousVersion',
    'status',
    'initiatedBy',
    'startedAt',
    'actions',
  ];

  // ---- Computed KPIs ----
  readonly kpiCards = computed(() => {
    const dash = this.svc.dashboard();
    return [
      {
        label: 'Queue Depth',
        value: dash?.queueDepth ?? this.svc.queuedJobs(),
        icon: 'queue',
        variant: 'neutral',
      },
      {
        label: 'Running Jobs',
        value: dash?.runningJobs ?? this.svc.runningJobs(),
        icon: 'play_circle',
        variant: 'info',
      },
      {
        label: 'Failed (24h)',
        value: dash?.failedLast24h ?? this.svc.failedJobs(),
        icon: 'error_outline',
        variant: 'danger',
      },
      {
        label: 'Healthy Services',
        value: `${this.svc.healthyServiceCount()}/${this.svc.services().length}`,
        icon: 'dns',
        variant: 'success',
      },
      {
        label: 'Pending Deploys',
        value: this.svc.pendingDeploymentCount(),
        icon: 'rocket_launch',
        variant: 'warning',
      },
    ];
  });

  // ---- Lifecycle ----
  ngOnInit(): void {
    this.svc.loadDashboard();
    this.loadJobs();
    this.svc.loadServices();
    this.svc.loadDeployments();
    this.svc.connectHub();

    this.svc.events$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => {
        this.liveEventLog.update((log) => [event, ...log].slice(0, 100));
      });
  }

  ngOnDestroy(): void {
    this.svc.disconnectHub();
  }

  // ---- Tab switching ----
  onTabChange(index: number): void {
    const tabs: Array<'jobs' | 'services' | 'deployments'> = ['jobs', 'services', 'deployments'];
    this.activeTab.set(tabs[index] ?? 'jobs');
  }

  // ---- Job actions ----
  onJobStatusFilter(status: JobStatus | ''): void {
    this.jobStatusFilter.set(status);
    this.currentPage.set(1);
    this.loadJobs();
  }

  onJobSearch(): void {
    this.currentPage.set(1);
    this.loadJobs();
  }

  onSelectJob(job: OrchestratorJob): void {
    this.svc.loadJobDetail(job.id);
  }

  onCloseJobDetail(): void {
    this.svc.clearSelection();
  }

  onCancelJob(job: OrchestratorJob): void {
    this.svc.cancelJob(job.id).subscribe();
  }

  onRetryJob(job: OrchestratorJob): void {
    this.svc.retryJob(job.id).subscribe();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadJobs();
  }

  // ---- Service actions ----
  onRestartService(service: OrchestratedService): void {
    this.svc.restartService(service.id).subscribe();
  }

  onScaleService(service: OrchestratedService, instances: number): void {
    this.svc.scaleService(service.id, instances).subscribe();
  }

  // ---- Deployment actions ----
  onRollbackDeployment(deployment: Deployment): void {
    this.svc.rollbackDeployment(deployment.id).subscribe();
  }

  // ---- Helpers ----
  jobStatusClass(status: JobStatus): string {
    switch (status) {
      case 'Queued':
        return 'job-queued';
      case 'Running':
        return 'job-running';
      case 'Completed':
        return 'job-completed';
      case 'Failed':
        return 'job-failed';
      case 'Cancelled':
        return 'job-cancelled';
      case 'Retrying':
        return 'job-retrying';
      default:
        return '';
    }
  }

  serviceStateClass(state: string): string {
    switch (state) {
      case 'Running':
        return 'svc-running';
      case 'Stopped':
        return 'svc-stopped';
      case 'Degraded':
        return 'svc-degraded';
      case 'Starting':
      case 'Stopping':
        return 'svc-transitioning';
      default:
        return 'svc-unknown';
    }
  }

  deploymentStatusClass(status: string): string {
    switch (status) {
      case 'Deployed':
        return 'deploy-success';
      case 'Failed':
        return 'deploy-failed';
      case 'RolledBack':
        return 'deploy-rollback';
      case 'InProgress':
        return 'deploy-progress';
      case 'Pending':
        return 'deploy-pending';
      default:
        return '';
    }
  }

  logLevelClass(level: JobLogEntry['level']): string {
    switch (level) {
      case 'Debug':
        return 'log-debug';
      case 'Info':
        return 'log-info';
      case 'Warning':
        return 'log-warning';
      case 'Error':
        return 'log-error';
      default:
        return '';
    }
  }

  stepStatusIcon(status: JobStatus): string {
    switch (status) {
      case 'Completed':
        return 'check_circle';
      case 'Running':
        return 'play_circle';
      case 'Failed':
        return 'cancel';
      case 'Queued':
        return 'schedule';
      default:
        return 'radio_button_unchecked';
    }
  }

  formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }

  formatDuration(seconds: number | null): string {
    if (seconds === null) return '--';
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  }

  trackByJobId(_: number, job: OrchestratorJob): string {
    return job.id;
  }

  trackByServiceId(_: number, service: OrchestratedService): string {
    return service.id;
  }

  trackByDeploymentId(_: number, deployment: Deployment): string {
    return deployment.id;
  }

  trackByLogIndex(index: number): number {
    return index;
  }

  trackByStepName(_: number, step: JobStep): string {
    return step.name;
  }

  // ---- Private ----
  private loadJobs(): void {
    const status = this.jobStatusFilter();
    this.svc.loadJobs(
      this.currentPage(),
      this.pageSize(),
      status || undefined,
      this.jobSearch() || undefined,
    );
  }
}
