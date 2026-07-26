import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

// ---------- Types ----------

export type PipelineStageStatus = 'pending' | 'running' | 'success' | 'failed' | 'skipped' | 'warning';

export interface PipelineStage {
  id: string;
  label: string;
  status: PipelineStageStatus;
  durationMs: number | null;
  startedAt: string | null;
  completedAt: string | null;
  message: string | null;
}

const STATUS_CONFIG: Record<PipelineStageStatus, { icon: string; cssClass: string; label: string }> = {
  pending: { icon: 'schedule', cssClass: 'stage-pending', label: 'Pending' },
  running: { icon: 'sync', cssClass: 'stage-running', label: 'Running' },
  success: { icon: 'check_circle', cssClass: 'stage-success', label: 'Success' },
  failed: { icon: 'error', cssClass: 'stage-failed', label: 'Failed' },
  skipped: { icon: 'block', cssClass: 'stage-skipped', label: 'Skipped' },
  warning: { icon: 'warning', cssClass: 'stage-warning', label: 'Warning' },
};

@Component({
  selector: 'geo-pipeline-ribbon',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  templateUrl: './pipeline-ribbon.component.html',
  styleUrl: './pipeline-ribbon.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PipelineRibbonComponent {
  readonly stages = input.required<PipelineStage[]>();
  readonly pipelineName = input<string>('Pipeline');
  readonly compact = input<boolean>(false);

  readonly progress = computed(() => {
    const list = this.stages();
    if (list.length === 0) return 0;
    const completed = list.filter((s) => s.status === 'success' || s.status === 'skipped').length;
    return Math.round((completed / list.length) * 100);
  });

  readonly hasFailed = computed(() =>
    this.stages().some((s) => s.status === 'failed'),
  );

  readonly isComplete = computed(() =>
    this.stages().every((s) => s.status === 'success' || s.status === 'skipped'),
  );

  stageConfig(status: PipelineStageStatus) {
    return STATUS_CONFIG[status];
  }

  formatDuration(ms: number | null): string {
    if (ms === null) return '--';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  }

  trackByStageId(_: number, stage: PipelineStage): string {
    return stage.id;
  }
}
