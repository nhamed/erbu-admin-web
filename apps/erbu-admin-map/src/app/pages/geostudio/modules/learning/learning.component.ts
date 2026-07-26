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
  LearningService,
  TrainingHistoryEntry,
} from './learning.service';
import { LearningModel, LearningModelStatus } from '@erbu-admin-web/shared/models';

type EChartsInstance = {
  setOption(option: unknown, notMerge?: boolean): void;
  resize(): void;
  dispose(): void;
};

@Component({
  selector: 'app-learning',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './learning.component.html',
  styleUrl: './learning.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LearningComponent implements OnInit, OnDestroy {
  private readonly svc = inject(LearningService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  // ---------- state ----------
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly lastUpdated = signal<string>('');
  readonly actionInProgress = signal<string | null>(null);

  // delegated from service
  readonly models = this.svc.filteredModels;
  readonly trainingHistory = this.svc.recentHistory;
  readonly activeModel = this.svc.activeModel;
  readonly modelsByStatus = this.svc.modelsByStatus;
  readonly comparison = this.svc.comparison;
  readonly selectedStatus = this.svc.selectedStatus;

  // ---------- computed ----------
  readonly kpiCards = computed(() => {
    const counts = this.modelsByStatus();
    const active = this.activeModel();
    return [
      {
        label: 'Total Models',
        value: this.svc.models().length,
        icon: 'model_training',
        cssClass: 'kpi-total',
      },
      {
        label: 'Active',
        value: counts[LearningModelStatus.Active] ?? 0,
        icon: 'play_circle',
        cssClass: 'kpi-active',
      },
      {
        label: 'Trained',
        value: counts[LearningModelStatus.Trained] ?? 0,
        icon: 'school',
        cssClass: 'kpi-trained',
      },
      {
        label: 'Evaluated',
        value: counts[LearningModelStatus.Evaluated] ?? 0,
        icon: 'assessment',
        cssClass: 'kpi-evaluated',
      },
      {
        label: 'Approved',
        value: counts[LearningModelStatus.Approved] ?? 0,
        icon: 'verified',
        cssClass: 'kpi-approved',
      },
      {
        label: 'Active Model',
        value: active?.name ?? 'None',
        icon: 'star',
        cssClass: 'kpi-active-model',
      },
    ];
  });

  readonly statusOptions: LearningModelStatus[] = [
    LearningModelStatus.Draft,
    LearningModelStatus.Training,
    LearningModelStatus.Trained,
    LearningModelStatus.Evaluated,
    LearningModelStatus.Approved,
    LearningModelStatus.Active,
    LearningModelStatus.Deprecated,
    LearningModelStatus.Archived,
  ];

  /** Status chain: trained -> evaluated -> approved -> active */
  readonly lifecycleStages = [
    { status: LearningModelStatus.Trained, label: 'Trained' },
    { status: LearningModelStatus.Evaluated, label: 'Evaluated' },
    { status: LearningModelStatus.Approved, label: 'Approved' },
    { status: LearningModelStatus.Active, label: 'Active' },
  ];

  // ---------- charts ----------
  private trainingChart: EChartsInstance | null = null;
  private resizeHandler = () => this.trainingChart?.resize();

  // ---------- lifecycle ----------
  ngOnInit(): void {
    this.svc.dashboard$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.lastUpdated.set(new Date().toLocaleTimeString());
          this.loading.set(false);
          this.error.set(null);
          this.updateTrainingChart();
        },
        error: (err) => {
          this.error.set(err?.message ?? 'Failed to load learning data');
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
    this.trainingChart?.dispose();
    this.trainingChart = null;
  }

  // ---------- chart ----------
  private async initChart(): Promise<void> {
    const container = document.getElementById('training-history-chart');
    if (!container) return;

    try {
      const echarts = await import('echarts/core');
      const { LineChart, ScatterChart } = await import('echarts/charts');
      const {
        GridComponent,
        TooltipComponent,
        LegendComponent,
        DataZoomComponent,
      } = await import('echarts/components');
      const { CanvasRenderer } = await import('echarts/renderers');

      echarts.use([
        LineChart,
        ScatterChart,
        GridComponent,
        TooltipComponent,
        LegendComponent,
        DataZoomComponent,
        CanvasRenderer,
      ]);

      this.trainingChart = echarts.init(container, 'dark') as unknown as EChartsInstance;
      this.updateTrainingChart();
      window.addEventListener('resize', this.resizeHandler);
    } catch {
      // echarts unavailable
    }
  }

  private updateTrainingChart(): void {
    if (!this.trainingChart) return;
    const data = this.svc.trainingChartData();
    if (data.length === 0) return;

    // Group by model name
    const modelNames = [...new Set(data.map((d) => d.modelName))];
    const seriesAccuracy = modelNames.map((name) => ({
      name: `${name} (accuracy)`,
      type: 'line' as const,
      data: data
        .filter((d) => d.modelName === name)
        .map((d) => [d.epoch, d.accuracy]),
      smooth: true,
    }));

    const seriesLoss = modelNames.map((name) => ({
      name: `${name} (loss)`,
      type: 'line' as const,
      data: data
        .filter((d) => d.modelName === name)
        .map((d) => [d.epoch, d.loss]),
      smooth: true,
      lineStyle: { type: 'dashed' as const },
    }));

    this.trainingChart.setOption(
      {
        tooltip: { trigger: 'axis' },
        legend: {
          data: [...seriesAccuracy.map((s) => s.name), ...seriesLoss.map((s) => s.name)],
          textStyle: { color: '#b0b0b0', fontSize: 10 },
          type: 'scroll',
        },
        grid: { left: 60, right: 20, top: 50, bottom: 60 },
        xAxis: {
          type: 'value',
          name: 'Epoch',
          nameTextStyle: { color: '#b0b0b0' },
          axisLabel: { color: '#b0b0b0' },
          splitLine: { lineStyle: { color: '#333' } },
        },
        yAxis: {
          type: 'value',
          name: 'Value',
          nameTextStyle: { color: '#b0b0b0' },
          axisLabel: { color: '#b0b0b0' },
          splitLine: { lineStyle: { color: '#333' } },
        },
        dataZoom: [{ type: 'inside', start: 0, end: 100 }],
        series: [...seriesAccuracy, ...seriesLoss],
      },
      true,
    );
  }

  // ---------- template actions ----------
  onStatusChange(status: string): void {
    this.svc.setStatusFilter((status as LearningModelStatus) || null);
  }

  trainModel(modelId: string): void {
    this.actionInProgress.set(modelId);
    this.svc.trainModel(modelId).subscribe({
      next: () => this.actionInProgress.set(null),
      error: () => this.actionInProgress.set(null),
    });
  }

  approveModel(modelId: string): void {
    this.actionInProgress.set(modelId);
    this.svc.approveModel(modelId).subscribe({
      next: () => this.actionInProgress.set(null),
      error: () => this.actionInProgress.set(null),
    });
  }

  promoteModel(modelId: string): void {
    this.actionInProgress.set(modelId);
    this.svc.promoteModel(modelId).subscribe({
      next: () => this.actionInProgress.set(null),
      error: () => this.actionInProgress.set(null),
    });
  }

  rollbackModel(modelId: string): void {
    this.actionInProgress.set(modelId);
    this.svc.rollbackModel(modelId).subscribe({
      next: () => this.actionInProgress.set(null),
      error: () => this.actionInProgress.set(null),
    });
  }

  // ---------- template helpers ----------
  statusClass(status: LearningModelStatus): string {
    switch (status) {
      case LearningModelStatus.Draft:
        return 'status-draft';
      case LearningModelStatus.Training:
        return 'status-training';
      case LearningModelStatus.Trained:
        return 'status-trained';
      case LearningModelStatus.Evaluated:
        return 'status-evaluated';
      case LearningModelStatus.Approved:
        return 'status-approved';
      case LearningModelStatus.Active:
        return 'status-active';
      case LearningModelStatus.Deprecated:
        return 'status-deprecated';
      case LearningModelStatus.Archived:
        return 'status-archived';
      default:
        return '';
    }
  }

  historyActionClass(action: string): string {
    switch (action) {
      case 'Train':
        return 'action-train';
      case 'Evaluate':
        return 'action-evaluate';
      case 'Approve':
        return 'action-approve';
      case 'Promote':
        return 'action-promote';
      case 'Rollback':
        return 'action-rollback';
      default:
        return '';
    }
  }

  historyStatusClass(status: string): string {
    switch (status) {
      case 'Success':
        return 'history-success';
      case 'Failed':
        return 'history-failed';
      case 'InProgress':
        return 'history-progress';
      default:
        return '';
    }
  }

  /** Lifecycle stage index for the pipeline indicator */
  lifecycleStageIndex(status: LearningModelStatus): number {
    const idx = this.lifecycleStages.findIndex((s) => s.status === status);
    return idx >= 0 ? idx : -1;
  }

  canTrain(model: LearningModel): boolean {
    return model.status === LearningModelStatus.Draft
      || model.status === LearningModelStatus.Deprecated;
  }

  canApprove(model: LearningModel): boolean {
    return model.status === LearningModelStatus.Evaluated;
  }

  canPromote(model: LearningModel): boolean {
    return model.status === LearningModelStatus.Approved;
  }

  canRollback(model: LearningModel): boolean {
    return model.status === LearningModelStatus.Active;
  }

  trackByModelId(_: number, m: LearningModel): string {
    return m.id;
  }

  trackByHistoryId(_: number, h: TrainingHistoryEntry): string {
    return h.id;
  }
}
