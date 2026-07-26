import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe, SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

// Angular Material
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

// ECharts
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// Models
import { PipelineRun, PipelineStatus, PipelineStage } from '@erbu-admin-web/shared/models';

// Service
import {
  PipelinesService,
  PipelineStatusFilter,
  PipelineHistoryPoint,
  PipelineLogEntry,
  PipelineName,
  PipelineSessionConfig,
  PipelineFrameworkConfig,
  OrchestratorState,
} from './pipelines-tab.service';

// Register ECharts modules
echarts.use([BarChart, LineChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, CanvasRenderer]);

// ---------------------------------------------------------------------------
// View-model types (client-side card state, not persisted)
// ---------------------------------------------------------------------------

interface StoryHistoryRow {
  id: string;
  title: string;
  status: string;
  statusColor: string;
  mtime: Date;
  tooltip: string;
}

interface PipelineCardState {
  pipeline: PipelineName;
  statusLabel: string;
  statusColor: string;
  borderColor: string;
  isActive: boolean;
  lockState: string;
  lockAgeMinutes: number;
  pendingCount: number;
  runningCount: number;
  doneCount: number;
  failedCount: number;
  deferredCount: number;
  statusMessage: string;

  // Current story progress
  hasCurrentStory: boolean;
  currentStoryId: string;
  currentStoryTitle: string;
  storyElapsedText: string;
  currentStepLabel: string;
  progressPercent: number;

  // Sparkline history
  recentStories: StoryHistoryRow[];

  // Inline panel toggles
  configOpen: boolean;
  logOpen: boolean;
  historyOpen: boolean;

  // Live log
  liveLog: string[];
  currentLogPath: string;

  // Per-pipeline config form values
  cfgAutoCommit: boolean;
  cfgAutoPush: boolean;
  cfgHibernateOnSuccess: boolean;
  cfgMaxAttempts: number;
  cfgDefaultBranch: string;
  cfgGatewayBaseUrl: string;
  cfgSimulatorMode: string;
  cfgSimulatorAuthMode: string;
  cfgIntervalMinutes: number;
  cfgSshHost: string;
  cfgFilePath: string;
  cfgStatus: string;
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  Running: '#4caf50',
  'Running (live)': '#4caf50',
  Succeeded: '#4caf50',
  READY: '#888',
  Queued: '#ff9800',
  PENDING: '#c3e88d',
  Failed: '#d32f2f',
  'FAILED runs': '#d32f2f',
  BLOCKED: '#d32f2f',
  Cancelled: '#ff9800',
  WaitingApproval: '#ff9800',
  Done: '#4caf50',
  Deferred: '#c3e88d',
};

function storyStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? '#888';
}

function buildDefaultCard(name: PipelineName): PipelineCardState {
  return {
    pipeline: name,
    statusLabel: 'READY',
    statusColor: '#888',
    borderColor: '#444',
    isActive: false,
    lockState: 'unknown',
    lockAgeMinutes: 0,
    pendingCount: 0,
    runningCount: 0,
    doneCount: 0,
    failedCount: 0,
    deferredCount: 0,
    statusMessage: '',
    hasCurrentStory: false,
    currentStoryId: '',
    currentStoryTitle: '',
    storyElapsedText: '',
    currentStepLabel: '',
    progressPercent: 0,
    recentStories: [],
    configOpen: false,
    logOpen: false,
    historyOpen: false,
    liveLog: [],
    currentLogPath: '',
    cfgAutoCommit: true,
    cfgAutoPush: true,
    cfgHibernateOnSuccess: false,
    cfgMaxAttempts: 8,
    cfgDefaultBranch: 'develop',
    cfgGatewayBaseUrl: 'http://localhost:5100',
    cfgSimulatorMode: 'Gateway',
    cfgSimulatorAuthMode: 'Oidc',
    cfgIntervalMinutes: 10,
    cfgSshHost: 'root@85.10.199.206',
    cfgFilePath: '',
    cfgStatus: '',
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

@Component({
  selector: 'app-pipelines-tab',
  templateUrl: './pipelines-tab.page.html',
  styleUrl: './pipelines-tab.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatSortModule,
    MatExpansionModule,
    MatChipsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    NgxEchartsDirective,
  ],
  providers: [
    PipelinesService,
    provideEchartsCore({ echarts }),
  ],
})
export class PipelinesTabPage implements OnInit, OnDestroy {
  private readonly svc = inject(PipelinesService);
  private pollSub: Subscription | null = null;

  // ---- Table columns ----
  readonly displayedColumns = ['status', 'pipelineName', 'branch', 'commitSha', 'triggeredBy', 'duration', 'startedAt', 'actions'];
  readonly historyColumns = ['statusPip', 'id', 'status', 'mtime', 'title'];

  // ---- Signals ----
  readonly runs = signal<PipelineRun[]>([]);
  readonly activeFilter = signal<PipelineStatusFilter>('All');
  readonly selectedRun = signal<PipelineRun | null>(null);
  readonly selectedRunLogs = signal<PipelineLogEntry[]>([]);
  readonly actionInProgress = signal(false);
  readonly historyData = signal<PipelineHistoryPoint[]>([]);

  // Orchestrator state
  readonly orchestratorRunning = signal(false);
  readonly orchestratorPaused = signal(false);
  readonly orchestratorPauseReason = signal('');
  readonly orchestratorStatus = signal('Idle.');
  readonly orchestratorLog = signal<string[]>([]);
  readonly followingOrchestrator = signal(false);
  readonly sessionConfigOpen = signal(false);

  // Session config form (two-way bound via ngModel)
  sessionProfile: 'fast' | 'full' = 'fast';
  sessionHibernate = false;
  sessionCommitOnDone = true;
  sessionPushOnDone = true;
  sessionTestHandoff = false;
  sessionAgentProvider = 'claude';
  sessionAgentModel = '';
  readonly sessionStatus = signal('');

  // Pipeline cards
  readonly pipelineCards = signal<PipelineCardState[]>(
    this.svc.pipelineNames.map(name => buildDefaultCard(name)),
  );
  readonly selectedCard = signal<PipelineCardState | null>(null);

  // ---- Computed ----
  readonly filteredRuns = computed(() => {
    const filter = this.activeFilter();
    const all = this.runs();
    if (filter === 'All') return all;
    return all.filter(r => r.status === filter);
  });

  readonly chartOptions = computed(() => this.buildChartOptions(this.historyData()));

  // ====================================================================
  // Lifecycle
  // ====================================================================

  ngOnInit(): void {
    this.startPolling();
    this.loadHistory();
    this.refreshOrchestratorState();
  }

  ngOnDestroy(): void {
    this.svc.stopPolling();
    this.pollSub?.unsubscribe();
  }

  // ====================================================================
  // Polling
  // ====================================================================

  private startPolling(): void {
    this.pollSub = this.svc.startPolling(4000).subscribe({
      next: resp => {
        this.runs.set(resp.items);
        this.updateCardsFromRuns(resp.items);
      },
    });
  }

  private updateCardsFromRuns(runs: PipelineRun[]): void {
    const cards = this.pipelineCards();
    const updated = cards.map(card => {
      const matching = runs.filter(r => r.pipelineName === card.pipeline);
      if (matching.length === 0) return card;

      const running = matching.filter(r => r.status === PipelineStatus.Running);
      const failed = matching.filter(r => r.status === PipelineStatus.Failed);
      const succeeded = matching.filter(r => r.status === PipelineStatus.Succeeded);
      const queued = matching.filter(r => r.status === PipelineStatus.Queued);

      const latest = matching.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0];

      let statusLabel = 'READY';
      let statusColor = '#888';
      let borderColor = '#444';
      let isActive = false;

      if (running.length > 0) {
        statusLabel = 'RUNNING (live)';
        statusColor = '#4caf50';
        borderColor = '#4caf50';
        isActive = true;
      } else if (failed.length > 0) {
        statusLabel = 'FAILED runs';
        statusColor = '#d32f2f';
        borderColor = '#444';
      } else if (queued.length > 0) {
        statusLabel = 'PENDING';
        statusColor = '#c3e88d';
        borderColor = '#444';
      } else if (succeeded.length > 0) {
        statusLabel = 'READY';
        statusColor = '#888';
      }

      // Current story from the latest running pipeline
      let hasCurrentStory = false;
      let currentStoryId = '';
      let currentStoryTitle = '';
      let storyElapsedText = '';
      let currentStepLabel = '';
      let progressPercent = 0;

      if (running.length > 0) {
        const current = running[0];
        hasCurrentStory = true;
        currentStoryId = current.id;
        currentStoryTitle = current.commitMessage;
        const elapsed = Date.now() - new Date(current.startedAt).getTime();
        storyElapsedText = formatElapsed(elapsed);

        const completedStages = current.stages.filter(s => s.status === PipelineStatus.Succeeded).length;
        const totalStages = current.stages.length || 1;
        progressPercent = (completedStages / totalStages) * 100;

        const activeStage = current.stages.find(s => s.status === PipelineStatus.Running);
        currentStepLabel = activeStage
          ? `STEP ${completedStages + 1}/${totalStages} ${activeStage.name}`
          : `${completedStages}/${totalStages} stages`;
      }

      // Recent stories for sparkline
      const recentStories: StoryHistoryRow[] = matching
        .slice(0, 30)
        .map(r => ({
          id: r.id,
          title: r.commitMessage,
          status: r.status,
          statusColor: storyStatusColor(r.status),
          mtime: new Date(r.completedAt ?? r.startedAt),
          tooltip: `${r.id}\n${r.commitMessage}\n${r.status}`,
        }));

      return {
        ...card,
        statusLabel,
        statusColor,
        borderColor,
        isActive,
        runningCount: running.length,
        failedCount: failed.length,
        doneCount: succeeded.length,
        pendingCount: queued.length,
        hasCurrentStory,
        currentStoryId,
        currentStoryTitle,
        storyElapsedText,
        currentStepLabel,
        progressPercent,
        recentStories,
      };
    });
    this.pipelineCards.set(updated);
  }

  // ====================================================================
  // Orchestrator state
  // ====================================================================

  private refreshOrchestratorState(): void {
    this.svc.getOrchestratorState().subscribe(state => {
      this.orchestratorRunning.set(state.isRunning);
      this.orchestratorPaused.set(state.isPaused);
      this.orchestratorPauseReason.set(state.pauseReason ?? '');
      this.orchestratorStatus.set(state.status);
    });
  }

  // ====================================================================
  // History (ECharts)
  // ====================================================================

  private loadHistory(): void {
    this.svc.getHistory(undefined, 14).subscribe(data => {
      this.historyData.set(data);
    });
  }

  private buildChartOptions(data: PipelineHistoryPoint[]): Record<string, unknown> {
    const dates = data.map(d => d.date);
    const succeeded = data.map(d => d.succeeded);
    const failed = data.map(d => d.failed);
    const cancelled = data.map(d => d.cancelled);
    const avgDuration = data.map(d => d.avgDurationSeconds);

    return {
      tooltip: { trigger: 'axis' },
      legend: {
        data: ['Succeeded', 'Failed', 'Cancelled', 'Avg Duration (s)'],
        textStyle: { color: '#888' },
      },
      grid: { left: 60, right: 60, bottom: 40, top: 40 },
      xAxis: {
        type: 'category',
        data: dates,
        axisLabel: { color: '#888' },
      },
      yAxis: [
        {
          type: 'value',
          name: 'Runs',
          axisLabel: { color: '#888' },
          nameTextStyle: { color: '#888' },
        },
        {
          type: 'value',
          name: 'Duration (s)',
          axisLabel: { color: '#888' },
          nameTextStyle: { color: '#888' },
        },
      ],
      dataZoom: [{ type: 'inside' }],
      series: [
        {
          name: 'Succeeded',
          type: 'bar',
          stack: 'runs',
          data: succeeded,
          itemStyle: { color: '#4caf50' },
        },
        {
          name: 'Failed',
          type: 'bar',
          stack: 'runs',
          data: failed,
          itemStyle: { color: '#d32f2f' },
        },
        {
          name: 'Cancelled',
          type: 'bar',
          stack: 'runs',
          data: cancelled,
          itemStyle: { color: '#ff9800' },
        },
        {
          name: 'Avg Duration (s)',
          type: 'line',
          yAxisIndex: 1,
          data: avgDuration,
          itemStyle: { color: '#82aaff' },
          lineStyle: { width: 2 },
          smooth: true,
        },
      ],
    };
  }

  // ====================================================================
  // Filter
  // ====================================================================

  onFilterChange(value: PipelineStatusFilter): void {
    this.activeFilter.set(value);
  }

  onRefresh(): void {
    this.svc.list().subscribe(resp => {
      this.runs.set(resp.items);
      this.updateCardsFromRuns(resp.items);
    });
    this.refreshOrchestratorState();
    this.loadHistory();
  }

  // ====================================================================
  // Run selection + detail
  // ====================================================================

  onSelectRun(run: PipelineRun): void {
    this.selectedRun.set(run);
    this.svc.getLogs(run.id).subscribe(logs => {
      this.selectedRunLogs.set(logs);
    });
  }

  // ====================================================================
  // Run actions
  // ====================================================================

  onCancelRun(runId: string): void {
    this.actionInProgress.set(true);
    this.svc.cancel(runId).subscribe({
      next: ok => {
        if (ok) this.onRefresh();
      },
      complete: () => this.actionInProgress.set(false),
    });
  }

  onRetryRun(runId: string): void {
    this.actionInProgress.set(true);
    this.svc.retry(runId).subscribe({
      next: run => {
        if (run) {
          this.onRefresh();
          this.selectedRun.set(run);
        }
      },
      complete: () => this.actionInProgress.set(false),
    });
  }

  // ====================================================================
  // Pipeline card selection
  // ====================================================================

  onSelectCard(card: PipelineCardState): void {
    this.selectedCard.set(card);
  }

  // ====================================================================
  // Per-pipeline card actions
  // ====================================================================

  onPlay(card: PipelineCardState): void {
    this.actionInProgress.set(true);
    card.statusMessage = 'Running Play...';
    this.pipelineCards.update(cards => [...cards]);
    this.svc.play(card.pipeline).subscribe({
      next: ok => {
        card.statusMessage = ok ? 'Play OK' : 'Play FAILED';
        this.pipelineCards.update(cards => [...cards]);
      },
      complete: () => this.actionInProgress.set(false),
    });
  }

  onStop(card: PipelineCardState): void {
    this.actionInProgress.set(true);
    card.statusMessage = 'Sending stop signal...';
    this.pipelineCards.update(cards => [...cards]);
    this.svc.stop(card.pipeline).subscribe({
      next: ok => {
        card.statusMessage = ok ? 'Stop signal sent' : 'Stop failed';
        this.pipelineCards.update(cards => [...cards]);
      },
      complete: () => this.actionInProgress.set(false),
    });
  }

  onReboot(card: PipelineCardState): void {
    this.actionInProgress.set(true);
    card.statusMessage = 'Rebooting...';
    this.pipelineCards.update(cards => [...cards]);
    this.svc.reboot(card.pipeline).subscribe({
      next: ok => {
        card.statusMessage = ok ? 'Reboot triggered' : 'Reboot failed';
        this.pipelineCards.update(cards => [...cards]);
      },
      complete: () => this.actionInProgress.set(false),
    });
  }

  onInit(card: PipelineCardState): void {
    this.actionInProgress.set(true);
    card.statusMessage = 'Init folders...';
    this.pipelineCards.update(cards => [...cards]);
    this.svc.init(card.pipeline).subscribe({
      next: ok => {
        card.statusMessage = ok ? 'Init OK' : 'Init failed';
        this.pipelineCards.update(cards => [...cards]);
      },
      complete: () => this.actionInProgress.set(false),
    });
  }

  onResetLock(card: PipelineCardState): void {
    this.actionInProgress.set(true);
    this.svc.resetLock(card.pipeline).subscribe({
      next: resp => {
        card.statusMessage = resp.evicted > 0
          ? `Reset: lock -> READY, ${resp.evicted} story(ies) evicted from in-progress/ -> inbox/.`
          : 'Reset: lock -> READY (in-progress was already empty).';
        this.pipelineCards.update(cards => [...cards]);
      },
      complete: () => this.actionInProgress.set(false),
    });
  }

  onRequeueFailed(card: PipelineCardState): void {
    this.actionInProgress.set(true);
    this.svc.requeueFailed(card.pipeline).subscribe({
      next: resp => {
        card.statusMessage = resp.requeued > 0
          ? `Requeued ${resp.requeued} story(ies) from failed/ to inbox/.`
          : 'No failed stories to requeue.';
        this.pipelineCards.update(cards => [...cards]);
      },
      complete: () => this.actionInProgress.set(false),
    });
  }

  onRequeueDeferred(card: PipelineCardState): void {
    this.actionInProgress.set(true);
    this.svc.requeueDeferred(card.pipeline).subscribe({
      next: resp => {
        card.statusMessage = resp.requeued > 0
          ? `Requeued ${resp.requeued} story(ies) from deferred/ to inbox/.`
          : 'No deferred stories to requeue.';
        this.pipelineCards.update(cards => [...cards]);
      },
      complete: () => this.actionInProgress.set(false),
    });
  }

  // ====================================================================
  // Per-pipeline config
  // ====================================================================

  onSaveConfig(card: PipelineCardState): void {
    const config: PipelineFrameworkConfig = {
      autoCommit: card.cfgAutoCommit,
      autoPush: card.cfgAutoPush,
      hibernateOnSuccess: card.cfgHibernateOnSuccess,
      maxAttemptsPerTask: card.cfgMaxAttempts,
      defaultBranch: card.cfgDefaultBranch,
      gatewayBaseUrl: card.cfgGatewayBaseUrl,
      simulatorMode: card.cfgSimulatorMode,
      simulatorAuthMode: card.cfgSimulatorAuthMode,
      intervalMinutes: card.cfgIntervalMinutes,
      heavyChecksEveryNthCycle: 3,
      sshHost: card.cfgSshHost,
    };
    this.svc.saveFrameworkConfig(card.pipeline, config).subscribe(ok => {
      card.cfgStatus = ok
        ? `Saved at ${new Date().toLocaleTimeString()}`
        : 'Save failed (read-only or corrupted JSON).';
      this.pipelineCards.update(cards => [...cards]);
    });
  }

  onResetConfigDefaults(card: PipelineCardState): void {
    card.cfgAutoCommit = true;
    card.cfgAutoPush = true;
    card.cfgHibernateOnSuccess = false;
    card.cfgMaxAttempts = 8;
    card.cfgDefaultBranch = 'develop';
    card.cfgGatewayBaseUrl = 'http://localhost:5100';
    card.cfgSimulatorMode = 'Gateway';
    card.cfgSimulatorAuthMode = 'Oidc';
    card.cfgIntervalMinutes = 10;
    card.cfgSshHost = 'root@85.10.199.206';
    card.cfgStatus = 'Defaults loaded. Click Save to persist.';
    this.pipelineCards.update(cards => [...cards]);
  }

  // ====================================================================
  // Orchestrator actions
  // ====================================================================

  onRunOrchestrator(): void {
    this.actionInProgress.set(true);
    this.orchestratorStatus.set('Launching auto-pipeline.ps1...');
    this.svc.runOrchestrator().subscribe({
      next: ok => {
        this.orchestratorRunning.set(ok);
        this.orchestratorStatus.set(ok ? 'Orchestrator launched.' : 'Launch failed.');
        this.refreshOrchestratorState();
      },
      complete: () => this.actionInProgress.set(false),
    });
  }

  onStopOrchestrator(): void {
    this.actionInProgress.set(true);
    this.svc.stopOrchestrator().subscribe({
      next: ok => {
        if (ok) this.orchestratorRunning.set(false);
        this.orchestratorStatus.set(ok ? 'Orchestrator killed.' : 'No orchestrator process to kill.');
        this.refreshOrchestratorState();
      },
      complete: () => this.actionInProgress.set(false),
    });
  }

  onClearPause(): void {
    this.actionInProgress.set(true);
    this.svc.clearPause().subscribe({
      next: ok => {
        this.orchestratorStatus.set(ok
          ? 'Pause flag cleared (.pipeline-paused removed). Click Run orchestrator to resume.'
          : 'Failed to clear pause flag -- check filesystem permissions.');
        this.refreshOrchestratorState();
      },
      complete: () => this.actionInProgress.set(false),
    });
  }

  onKillSprawl(): void {
    this.actionInProgress.set(true);
    this.svc.killSprawl().subscribe({
      next: resp => {
        this.orchestratorStatus.set(resp.killed >= 0
          ? `Killed ${resp.killed} orphan PowerShell process(es). Active pipelines untouched.`
          : 'KillSprawl failed -- see cockpit log.');
        this.refreshOrchestratorState();
      },
      complete: () => this.actionInProgress.set(false),
    });
  }

  onToggleFollowLog(): void {
    this.followingOrchestrator.update(v => !v);
    if (this.followingOrchestrator()) {
      this.selectedCard.set(null);
    }
  }

  onToggleSessionConfig(): void {
    if (!this.sessionConfigOpen()) {
      this.svc.getSessionConfig().subscribe(config => {
        this.sessionProfile = config.profile;
        this.sessionHibernate = config.hibernate;
        this.sessionCommitOnDone = config.commitOnDone;
        this.sessionPushOnDone = config.pushOnDone;
        this.sessionTestHandoff = config.testHandoff;
        this.sessionAgentProvider = config.agentProvider || 'claude';
        this.sessionAgentModel = config.agentModel || '';
      });
    }
    this.sessionConfigOpen.update(v => !v);
  }

  onSaveSessionConfig(): void {
    const config: PipelineSessionConfig = {
      profile: this.sessionProfile,
      hibernate: this.sessionHibernate,
      commitOnDone: this.sessionCommitOnDone,
      pushOnDone: this.sessionPushOnDone,
      testHandoff: this.sessionTestHandoff,
      agentProvider: this.sessionAgentProvider || 'claude',
      agentModel: this.sessionAgentModel?.trim() ?? '',
      target: '',
    };
    this.svc.saveSessionConfig(config).subscribe(ok => {
      this.sessionStatus.set(ok
        ? `.pipeline-session.json saved at ${new Date().toLocaleTimeString()} (agent=${this.sessionAgentProvider})`
        : 'Save failed.');
    });
  }

  onResetSessionDefaults(): void {
    this.sessionProfile = 'fast';
    this.sessionHibernate = false;
    this.sessionCommitOnDone = true;
    this.sessionPushOnDone = true;
    this.sessionTestHandoff = false;
    this.sessionAgentProvider = 'claude';
    this.sessionAgentModel = '';
    this.sessionStatus.set('Defaults loaded. Click Save to persist.');
  }

  onPurgeLogs(): void {
    this.actionInProgress.set(true);
    this.svc.purgeLogs(24).subscribe({
      next: resp => {
        this.orchestratorStatus.set(
          resp.deleted > 0
            ? `Deleted ${resp.deleted} file(s), freed ${resp.freedMb.toFixed(1)} MB.`
            : 'No logs older than 24h.',
        );
      },
      complete: () => this.actionInProgress.set(false),
    });
  }

  // ====================================================================
  // Helpers (template-callable)
  // ====================================================================

  statusColor(status: PipelineStatus | string): string {
    return STATUS_COLORS[status] ?? '#888';
  }

  formatDuration(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  }

  stageStatusIcon(stage: PipelineStage): string {
    switch (stage.status) {
      case PipelineStatus.Succeeded: return 'check_circle';
      case PipelineStatus.Failed: return 'error';
      case PipelineStatus.Running: return 'hourglass_top';
      case PipelineStatus.Cancelled: return 'cancel';
      case PipelineStatus.WaitingApproval: return 'pending';
      default: return 'radio_button_unchecked';
    }
  }

  stageStatusClass(stage: PipelineStage): string {
    switch (stage.status) {
      case PipelineStatus.Succeeded: return 'succeeded';
      case PipelineStatus.Failed: return 'failed';
      case PipelineStatus.Running: return 'running';
      case PipelineStatus.Cancelled: return 'cancelled';
      default: return 'queued';
    }
  }
}

// ---------------------------------------------------------------------------
// Standalone helper
// ---------------------------------------------------------------------------

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${String(mins).padStart(2, '0')}m`;
}
