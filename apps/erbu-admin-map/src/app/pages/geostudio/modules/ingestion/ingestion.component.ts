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
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  IngestionService,
  Pipeline,
  PipelineStatus,
  PipelineErrorLog,
  PipelineConfig,
} from './ingestion.service';

@Component({
  selector: 'app-geostudio-ingestion',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ingestion.component.html',
  styleUrl: './ingestion.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IngestionComponent implements OnInit, OnDestroy {
  private readonly svc = inject(IngestionService);
  private readonly destroyRef = inject(DestroyRef);

  // ---------- state ----------
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly lastUpdated = signal<string>('');
  readonly actionInProgress = signal<string | null>(null);
  readonly showErrorLog = signal(false);
  readonly selectedPipeline = signal<Pipeline | null>(null);
  readonly pipelineConfig = signal<PipelineConfig | null>(null);
  readonly configLoading = signal(false);

  // delegated from service
  readonly kpi = this.svc.kpi;
  readonly pipelines = this.svc.filteredPipelines;
  readonly recentErrors = this.svc.recentErrors;
  readonly selectedStatus = this.svc.selectedStatus;
  readonly searchTerm = this.svc.searchTerm;

  // ---------- computed ----------
  readonly kpiCards = computed(() => {
    const k = this.kpi();
    return [
      { label: 'Total Pipelines', value: k.totalPipelines, icon: 'account_tree', cssClass: 'kpi-total' },
      { label: 'Running', value: k.runningPipelines, icon: 'play_circle', cssClass: 'kpi-running' },
      { label: 'Paused', value: k.pausedPipelines, icon: 'pause_circle', cssClass: 'kpi-paused' },
      { label: 'Errors', value: k.errorPipelines, icon: 'error', cssClass: 'kpi-error' },
      { label: 'Documents Ingested', value: this.formatNumber(k.totalDocumentsIngested), icon: 'description', cssClass: 'kpi-docs' },
      { label: 'Total Errors', value: k.totalErrors, icon: 'bug_report', cssClass: 'kpi-total-errors' },
      { label: 'Throughput', value: k.avgThroughputDocsPerSec.toFixed(1), icon: 'speed', cssClass: 'kpi-throughput', suffix: 'docs/s' },
      { label: 'Avg Processing', value: k.avgProcessingMs.toFixed(0), icon: 'timer', cssClass: 'kpi-processing', suffix: 'ms' },
    ];
  });

  readonly statusOptions: PipelineStatus[] = ['running', 'paused', 'error', 'stopped', 'starting'];

  readonly selectedPipelineErrors = computed(() => {
    const selected = this.selectedPipeline();
    if (!selected) return this.recentErrors();
    return this.recentErrors().filter((e) => e.pipelineId === selected.id);
  });

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
          this.error.set(err?.message ?? 'Failed to load ingestion data');
          this.loading.set(false);
        },
      });
  }

  ngOnDestroy(): void {
    // takeUntilDestroyed handles cleanup
  }

  // ---------- actions ----------
  onStatusFilterChange(status: string): void {
    this.svc.setStatusFilter((status as PipelineStatus) || null);
  }

  onSearchChange(term: string): void {
    this.svc.setSearchTerm(term);
  }

  startPipeline(pipeline: Pipeline): void {
    if (this.actionInProgress()) return;
    this.actionInProgress.set(pipeline.id);
    this.svc.startPipeline(pipeline.id).subscribe({
      next: () => this.actionInProgress.set(null),
      error: () => this.actionInProgress.set(null),
    });
  }

  stopPipeline(pipeline: Pipeline): void {
    if (this.actionInProgress()) return;
    this.actionInProgress.set(pipeline.id);
    this.svc.stopPipeline(pipeline.id).subscribe({
      next: () => this.actionInProgress.set(null),
      error: () => this.actionInProgress.set(null),
    });
  }

  pausePipeline(pipeline: Pipeline): void {
    if (this.actionInProgress()) return;
    this.actionInProgress.set(pipeline.id);
    this.svc.pausePipeline(pipeline.id).subscribe({
      next: () => this.actionInProgress.set(null),
      error: () => this.actionInProgress.set(null),
    });
  }

  restartPipeline(pipeline: Pipeline): void {
    if (this.actionInProgress()) return;
    this.actionInProgress.set(pipeline.id);
    this.svc.restartPipeline(pipeline.id).subscribe({
      next: () => this.actionInProgress.set(null),
      error: () => this.actionInProgress.set(null),
    });
  }

  viewConfig(pipeline: Pipeline): void {
    this.selectedPipeline.set(pipeline);
    this.configLoading.set(true);
    this.svc.fetchPipelineConfig(pipeline.id).subscribe({
      next: (config) => {
        this.pipelineConfig.set(config);
        this.configLoading.set(false);
      },
      error: () => {
        this.pipelineConfig.set(null);
        this.configLoading.set(false);
      },
    });
  }

  closeConfig(): void {
    this.selectedPipeline.set(null);
    this.pipelineConfig.set(null);
  }

  toggleErrorLog(): void {
    this.showErrorLog.update((v) => !v);
  }

  viewPipelineErrors(pipeline: Pipeline): void {
    this.selectedPipeline.set(pipeline);
    this.showErrorLog.set(true);
  }

  // ---------- template helpers ----------
  statusClass(status: PipelineStatus): string {
    switch (status) {
      case 'running': return 'status-running';
      case 'paused': return 'status-paused';
      case 'error': return 'status-error';
      case 'stopped': return 'status-stopped';
      case 'starting': return 'status-starting';
      default: return '';
    }
  }

  statusIcon(status: PipelineStatus): string {
    switch (status) {
      case 'running': return 'play_circle';
      case 'paused': return 'pause_circle';
      case 'error': return 'error';
      case 'stopped': return 'stop_circle';
      case 'starting': return 'hourglass_top';
      default: return 'help';
    }
  }

  severityClass(severity: PipelineErrorLog['severity']): string {
    switch (severity) {
      case 'fatal': return 'severity-fatal';
      case 'error': return 'severity-error';
      case 'warning': return 'severity-warning';
      default: return '';
    }
  }

  canStart(pipeline: Pipeline): boolean {
    return pipeline.status === 'stopped' || pipeline.status === 'paused' || pipeline.status === 'error';
  }

  canPause(pipeline: Pipeline): boolean {
    return pipeline.status === 'running';
  }

  canStop(pipeline: Pipeline): boolean {
    return pipeline.status === 'running' || pipeline.status === 'paused';
  }

  isActionLoading(pipelineId: string): boolean {
    return this.actionInProgress() === pipelineId;
  }

  trackByPipelineId(_: number, p: Pipeline): string {
    return p.id;
  }

  trackByErrorId(_: number, e: PipelineErrorLog): string {
    return e.id;
  }

  private formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  }
}
