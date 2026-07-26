import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  ElementRef,
  ViewChild,
  AfterViewInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';

import {
  E2ETestRun,
  E2EPlatform,
  DeviceInstance,
  SmokeStatus,
} from '@erbu-admin-web/shared/models';
import {
  E2EService,
  E2ELaunchRequest,
  E2ETestSuite,
  E2ELogEntry,
  E2EResultsSummary,
} from './e2e.service';
import { DeviceService } from './device.service';
import { E2ELaunchOptionsComponent } from './components/launch-options.component';
import { E2EAuditSectionComponent } from './components/audit-section.component';

const LOG_POLL_MS = 3_000;
const RESULTS_REFRESH_MS = 15_000;

// ── Trip graph node for SVG visualization ────────────────────
interface TripGraphNode {
  id: string;
  label: string;
  status: 'passed' | 'failed' | 'running' | 'pending';
  x: number;
  y: number;
  duration: number;
}

interface TripGraphEdge {
  from: string;
  to: string;
}

@Component({
  selector: 'app-e2e-tab',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatChipsModule,
    MatBadgeModule,
    MatTooltipModule,
    MatExpansionModule,
    MatDividerModule,
    E2ELaunchOptionsComponent,
    E2EAuditSectionComponent,
  ],
  templateUrl: './e2e-tab.page.html',
  styleUrl: './e2e-tab.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class E2ETabPage implements OnInit, OnDestroy, AfterViewInit {
  private readonly e2eService = inject(E2EService);
  private readonly deviceService = inject(DeviceService);

  private logPollTimer: ReturnType<typeof setInterval> | null = null;
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  @ViewChild('tripCanvas', { static: false })
  tripCanvasRef!: ElementRef<HTMLCanvasElement>;

  // ── State signals ──────────────────────────────────────────
  readonly suites = signal<E2ETestSuite[]>([]);
  readonly devices = signal<DeviceInstance[]>([]);
  readonly runs = signal<E2ETestRun[]>([]);
  readonly activeRun = signal<E2ETestRun | null>(null);
  readonly logs = signal<E2ELogEntry[]>([]);
  readonly summary = signal<E2EResultsSummary | null>(null);

  readonly loading = signal(false);
  readonly launching = signal(false);
  readonly loadingDevices = signal(false);
  readonly activeTabIndex = signal(0);
  readonly logOffset = signal(0);

  // Trip graph state
  readonly graphNodes = signal<TripGraphNode[]>([]);
  readonly graphEdges = signal<TripGraphEdge[]>([]);

  // ── Computed ───────────────────────────────────────────────
  readonly totalTests = computed(() => {
    const run = this.activeRun();
    return run ? run.totalTests : 0;
  });

  readonly passedCount = computed(() => {
    const run = this.activeRun();
    return run ? run.passed : 0;
  });

  readonly failedCount = computed(() => {
    const run = this.activeRun();
    return run ? run.failed : 0;
  });

  readonly skippedCount = computed(() => {
    const run = this.activeRun();
    return run ? run.skipped : 0;
  });

  readonly progressPercent = computed(() => {
    const run = this.activeRun();
    if (!run || run.totalTests === 0) return 0;
    return Math.round(
      ((run.passed + run.failed + run.skipped) / run.totalTests) * 100,
    );
  });

  readonly isRunning = computed(
    () => this.activeRun()?.status === SmokeStatus.Running,
  );

  readonly runDuration = computed(() => {
    const run = this.activeRun();
    if (!run) return '--';
    const secs = run.durationSeconds;
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  });

  readonly filteredLogs = computed(() => this.logs());

  readonly recentRuns = computed(() => this.runs().slice(0, 20));

  readonly resultsColumns: string[] = [
    'suiteName',
    'platform',
    'deviceName',
    'status',
    'passRate',
    'duration',
    'startedAt',
    'actions',
  ];

  // ── Lifecycle ──────────────────────────────────────────────
  constructor() {
    // Redraw trip graph whenever nodes change
    effect(() => {
      const nodes = this.graphNodes();
      const edges = this.graphEdges();
      if (nodes.length > 0) {
        this.drawTripGraph(nodes, edges);
      }
    });
  }

  ngOnInit(): void {
    this.loadSuites();
    this.loadDevices();
    this.loadResults();
    this.refreshTimer = setInterval(
      () => this.refreshActiveRun(),
      RESULTS_REFRESH_MS,
    );
  }

  ngAfterViewInit(): void {
    const nodes = this.graphNodes();
    const edges = this.graphEdges();
    if (nodes.length > 0) {
      this.drawTripGraph(nodes, edges);
    }
  }

  ngOnDestroy(): void {
    this.stopLogPolling();
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // ── Actions ────────────────────────────────────────────────
  onLaunch(request: E2ELaunchRequest): void {
    this.launching.set(true);
    this.e2eService.launchTests(request).subscribe({
      next: (run) => {
        this.activeRun.set(run);
        this.launching.set(false);
        this.activeTabIndex.set(1); // Switch to progress tab
        this.logs.set([]);
        this.logOffset.set(0);
        this.startLogPolling(run.id);
        this.loadResults();
      },
      error: () => {
        this.launching.set(false);
      },
    });
  }

  onRefreshDevices(): void {
    this.loadDevices();
  }

  onSelectRun(run: E2ETestRun): void {
    this.activeRun.set(run);
    this.logs.set([]);
    this.logOffset.set(0);

    if (run.status === SmokeStatus.Running) {
      this.startLogPolling(run.id);
    } else {
      this.stopLogPolling();
      this.loadRunLogs(run.id);
      this.loadRunSummary(run.id);
    }

    this.buildTripGraph(run);
    this.activeTabIndex.set(1);
  }

  onAbortRun(): void {
    const run = this.activeRun();
    if (!run) return;

    this.e2eService.abortRun(run.id).subscribe({
      next: () => {
        this.stopLogPolling();
        this.refreshActiveRun();
      },
    });
  }

  onViewScreenshot(url: string): void {
    window.open(url, '_blank');
  }

  onViewVideo(url: string): void {
    window.open(url, '_blank');
  }

  statusIcon(status: SmokeStatus): string {
    switch (status) {
      case SmokeStatus.Passed:
        return 'check_circle';
      case SmokeStatus.Failed:
        return 'cancel';
      case SmokeStatus.Running:
        return 'pending';
      case SmokeStatus.PartialPass:
        return 'warning';
      case SmokeStatus.Aborted:
        return 'stop_circle';
      default:
        return 'help';
    }
  }

  statusClass(status: SmokeStatus): string {
    switch (status) {
      case SmokeStatus.Passed:
        return 'status-passed';
      case SmokeStatus.Failed:
        return 'status-failed';
      case SmokeStatus.Running:
        return 'status-running';
      case SmokeStatus.PartialPass:
        return 'status-partial';
      case SmokeStatus.Aborted:
        return 'status-aborted';
      default:
        return '';
    }
  }

  logLevelClass(level: string): string {
    return `log-${level}`;
  }

  // ── Private ────────────────────────────────────────────────
  private loadSuites(): void {
    this.e2eService.listSuites().subscribe({
      next: (page) => this.suites.set(page.items),
    });
  }

  private loadDevices(): void {
    this.loadingDevices.set(true);
    this.deviceService.scanDevices().subscribe({
      next: (devices) => {
        this.devices.set(devices);
        this.loadingDevices.set(false);
      },
      error: () => this.loadingDevices.set(false),
    });
  }

  private loadResults(): void {
    this.loading.set(true);
    this.e2eService.getResults().subscribe({
      next: (data) => {
        this.runs.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private loadRunLogs(runId: string): void {
    this.e2eService.getLogs(runId).subscribe({
      next: (entries) => this.logs.set(entries),
    });
  }

  private loadRunSummary(runId: string): void {
    this.e2eService.getResultsSummary(runId).subscribe({
      next: (s) => this.summary.set(s),
    });
  }

  private startLogPolling(runId: string): void {
    this.stopLogPolling();
    this.logPollTimer = setInterval(() => {
      this.e2eService.getLogs(runId, this.logOffset()).subscribe({
        next: (entries) => {
          if (entries.length > 0) {
            this.logs.update((current) => [...current, ...entries]);
            this.logOffset.update((o) => o + entries.length);
          }
        },
      });
      // Also refresh the run status
      this.refreshActiveRun();
    }, LOG_POLL_MS);
  }

  private stopLogPolling(): void {
    if (this.logPollTimer) {
      clearInterval(this.logPollTimer);
      this.logPollTimer = null;
    }
  }

  private refreshActiveRun(): void {
    const run = this.activeRun();
    if (!run) return;

    this.e2eService.getRun(run.id).subscribe({
      next: (updated) => {
        this.activeRun.set(updated);

        if (updated.status !== SmokeStatus.Running) {
          this.stopLogPolling();
          this.loadRunSummary(updated.id);
          this.buildTripGraph(updated);
        }
      },
    });
  }

  // ── Trip graph builder ─────────────────────────────────────
  private buildTripGraph(run: E2ETestRun): void {
    const failed = run.failedTests ?? [];
    const nodeCount = Math.max(run.totalTests, 1);
    const cols = Math.ceil(Math.sqrt(nodeCount));
    const nodes: TripGraphNode[] = [];
    const edges: TripGraphEdge[] = [];

    const failedNames = new Set(failed.map((f) => f.testName));

    for (let i = 0; i < run.totalTests; i++) {
      const testName = `test_${i + 1}`;
      const isFailed = failedNames.has(testName) || i < failed.length && failedNames.size > 0 && i >= run.passed;
      let status: TripGraphNode['status'];
      if (run.status === SmokeStatus.Running && i >= run.passed + run.failed) {
        status = i === run.passed + run.failed ? 'running' : 'pending';
      } else {
        status = isFailed ? 'failed' : 'passed';
      }

      nodes.push({
        id: testName,
        label: `T${i + 1}`,
        status,
        x: (i % cols) * 60 + 30,
        y: Math.floor(i / cols) * 60 + 30,
        duration: run.durationSeconds / Math.max(run.totalTests, 1),
      });

      if (i > 0) {
        edges.push({ from: `test_${i}`, to: testName });
      }
    }

    this.graphNodes.set(nodes);
    this.graphEdges.set(edges);
  }

  private drawTripGraph(
    nodes: TripGraphNode[],
    edges: TripGraphEdge[],
  ): void {
    const canvas = this.tripCanvasRef?.nativeElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const cols = Math.ceil(Math.sqrt(nodes.length));
    const rows = Math.ceil(nodes.length / cols);
    canvas.width = cols * 60 + 40;
    canvas.height = rows * 60 + 40;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw edges
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1.5;
    for (const edge of edges) {
      const from = nodeMap.get(edge.from);
      const to = nodeMap.get(edge.to);
      if (from && to) {
        ctx.beginPath();
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      }
    }

    // Draw nodes
    const colorMap: Record<TripGraphNode['status'], string> = {
      passed: '#4caf50',
      failed: '#f44336',
      running: '#ff9800',
      pending: '#9e9e9e',
    };

    for (const node of nodes) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, 14, 0, Math.PI * 2);
      ctx.fillStyle = colorMap[node.status];
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.label, node.x, node.y);
    }
  }
}
