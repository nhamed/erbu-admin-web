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
  InfrastructureService,
  InfrastructureDashboard,
  ServerNode,
  NodeStatus,
  DeploymentInfo,
  ResourceAlert,
  NetworkTopology,
  SshCommandResult,
} from './infrastructure.service';

type ActiveTab = 'nodes' | 'deployments' | 'alerts' | 'topology' | 'ssh';

@Component({
  selector: 'app-infrastructure-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './infrastructure-admin.page.html',
  styleUrl: './infrastructure-admin.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfrastructureAdminPage implements OnInit, OnDestroy {
  private readonly svc = inject(InfrastructureService);
  private readonly destroyRef = inject(DestroyRef);

  // ---------- signals ----------
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly lastUpdated = signal<string>('');
  readonly activeTab = signal<ActiveTab>('nodes');

  readonly nodes = signal<ServerNode[]>([]);
  readonly deployments = signal<DeploymentInfo[]>([]);
  readonly alerts = signal<ResourceAlert[]>([]);
  readonly topology = signal<NetworkTopology>({ nodes: [], links: [] });

  readonly selectedNode = signal<ServerNode | null>(null);
  readonly filterNodeStatus = signal<NodeStatus | 'all'>('all');
  readonly searchQuery = signal('');

  // SSH terminal state
  readonly sshTargetNode = signal<ServerNode | null>(null);
  readonly sshCommand = signal('');
  readonly sshHistory = signal<SshCommandResult[]>([]);
  readonly sshExecuting = signal(false);

  // Deployment action state
  readonly deployActionInProgress = signal<string | null>(null);
  readonly deployActionMessage = signal<{ text: string; success: boolean } | null>(null);

  // ---------- computed ----------
  readonly onlineNodes = computed(
    () => this.nodes().filter((n) => n.status === 'online').length,
  );
  readonly degradedNodes = computed(
    () => this.nodes().filter((n) => n.status === 'degraded').length,
  );
  readonly offlineNodes = computed(
    () => this.nodes().filter((n) => n.status === 'offline').length,
  );
  readonly maintenanceNodes = computed(
    () => this.nodes().filter((n) => n.status === 'maintenance').length,
  );
  readonly totalNodes = computed(() => this.nodes().length);

  readonly filteredNodes = computed(() => {
    let list = this.nodes();
    const status = this.filterNodeStatus();
    const query = this.searchQuery().toLowerCase().trim();

    if (status !== 'all') {
      list = list.filter((n) => n.status === status);
    }
    if (query) {
      list = list.filter(
        (n) =>
          n.hostname.toLowerCase().includes(query) ||
          n.ipAddress.includes(query) ||
          n.location.toLowerCase().includes(query),
      );
    }
    return list;
  });

  readonly criticalAlerts = computed(
    () => this.alerts().filter((a) => a.severity === 'critical' && !a.acknowledged).length,
  );
  readonly warningAlerts = computed(
    () => this.alerts().filter((a) => a.severity === 'warning' && !a.acknowledged).length,
  );

  readonly runningDeployments = computed(
    () => this.deployments().filter((d) => d.status === 'running').length,
  );
  readonly failedDeployments = computed(
    () => this.deployments().filter((d) => d.status === 'failed').length,
  );

  readonly kpiCards = computed(() => [
    {
      label: 'Nodes Online',
      value: `${this.onlineNodes()}/${this.totalNodes()}`,
      icon: 'dns',
      color: this.offlineNodes() > 0 ? 'red' : 'green',
    },
    {
      label: 'Deployments',
      value: `${this.runningDeployments()}/${this.deployments().length}`,
      icon: 'rocket_launch',
      color: this.failedDeployments() > 0 ? 'red' : 'green',
    },
    {
      label: 'Critical Alerts',
      value: this.criticalAlerts().toString(),
      icon: 'warning',
      color: this.criticalAlerts() > 0 ? 'red' : 'green',
    },
    {
      label: 'Warnings',
      value: this.warningAlerts().toString(),
      icon: 'info',
      color: this.warningAlerts() > 0 ? 'orange' : 'green',
    },
  ]);

  // ---------- lifecycle ----------
  ngOnInit(): void {
    this.svc.dashboard$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (d) => this.applyDashboard(d),
        error: (err) => {
          this.error.set(err?.message ?? 'Failed to load infrastructure data');
          this.loading.set(false);
        },
      });
  }

  ngOnDestroy(): void {
    // cleanup handled by takeUntilDestroyed
  }

  // ---------- data ----------
  private applyDashboard(d: InfrastructureDashboard): void {
    this.nodes.set(d.nodes);
    this.deployments.set(d.deployments);
    this.alerts.set(d.alerts);
    this.topology.set(d.topology);
    this.lastUpdated.set(d.lastUpdatedAt);
    this.loading.set(false);
    this.error.set(null);
  }

  // ---------- tab navigation ----------
  switchTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
  }

  // ---------- node selection ----------
  selectNode(node: ServerNode): void {
    this.selectedNode.set(
      this.selectedNode()?.id === node.id ? null : node,
    );
  }

  setFilterStatus(status: NodeStatus | 'all'): void {
    this.filterNodeStatus.set(status);
  }

  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  // ---------- SSH operations ----------
  openSshTerminal(node: ServerNode): void {
    this.sshTargetNode.set(node);
    this.sshHistory.set([]);
    this.activeTab.set('ssh');
  }

  onSshCommandChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.sshCommand.set(input.value);
  }

  executeSshCommand(): void {
    const node = this.sshTargetNode();
    const command = this.sshCommand().trim();
    if (!node || !command) return;

    this.sshExecuting.set(true);
    this.svc
      .executeSshCommand({ nodeId: node.id, command })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.sshHistory.update((h) => [...h, result]);
          this.sshCommand.set('');
          this.sshExecuting.set(false);
        },
        error: (err) => {
          const errorResult: SshCommandResult = {
            nodeId: node.id,
            command,
            stdout: '',
            stderr: err?.message ?? 'SSH command failed',
            exitCode: -1,
            durationMs: 0,
            executedAt: new Date().toISOString(),
          };
          this.sshHistory.update((h) => [...h, errorResult]);
          this.sshExecuting.set(false);
        },
      });
  }

  // ---------- deployment actions ----------
  triggerDeployAction(
    deployment: DeploymentInfo,
    action: 'restart' | 'stop' | 'rollback',
  ): void {
    this.deployActionInProgress.set(deployment.id);
    this.deployActionMessage.set(null);

    this.svc
      .triggerDeployment(deployment.id, action)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.deployActionInProgress.set(null);
          this.deployActionMessage.set({
            text: result.message,
            success: result.success,
          });
          setTimeout(() => this.deployActionMessage.set(null), 5000);
        },
        error: (err) => {
          this.deployActionInProgress.set(null);
          this.deployActionMessage.set({
            text: err?.message ?? 'Deployment action failed',
            success: false,
          });
          setTimeout(() => this.deployActionMessage.set(null), 5000);
        },
      });
  }

  // ---------- alert actions ----------
  acknowledgeAlert(alert: ResourceAlert): void {
    this.svc
      .acknowledgeAlert(alert.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.alerts.update((list) =>
            list.map((a) =>
              a.id === alert.id ? { ...a, acknowledged: true } : a,
            ),
          );
        },
        error: () => {},
      });
  }

  // ---------- template helpers ----------
  nodeStatusClass(status: NodeStatus): string {
    switch (status) {
      case 'online':
        return 'status-online';
      case 'degraded':
        return 'status-degraded';
      case 'offline':
        return 'status-offline';
      case 'maintenance':
        return 'status-maintenance';
      default:
        return '';
    }
  }

  deployStatusClass(status: string): string {
    switch (status) {
      case 'running':
        return 'deploy-running';
      case 'deploying':
      case 'rolling-update':
        return 'deploy-progress';
      case 'failed':
        return 'deploy-failed';
      case 'stopped':
        return 'deploy-stopped';
      default:
        return '';
    }
  }

  alertSeverityClass(severity: string): string {
    switch (severity) {
      case 'critical':
        return 'alert-critical';
      case 'warning':
        return 'alert-warning';
      case 'info':
        return 'alert-info';
      default:
        return '';
    }
  }

  formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h ${Math.floor((seconds % 3600) / 60)}m`;
  }

  formatBytes(gb: number): string {
    return gb.toFixed(1) + ' GB';
  }

  usagePercent(used: number, total: number): number {
    return total > 0 ? (used / total) * 100 : 0;
  }

  usageBarClass(percent: number): string {
    if (percent > 90) return 'usage-critical';
    if (percent > 75) return 'usage-warning';
    return 'usage-normal';
  }

  trackByNodeId(_: number, node: ServerNode): string {
    return node.id;
  }

  trackByDeployId(_: number, deploy: DeploymentInfo): string {
    return deploy.id;
  }

  trackByAlertId(_: number, alert: ResourceAlert): string {
    return alert.id;
  }

  trackBySshIndex(index: number): number {
    return index;
  }
}
