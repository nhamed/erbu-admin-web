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
  GeoInfrastructureService,
  InfraNode,
  NodeHealthStatus,
  LiveNodeStatusChange,
  LiveIngestionProgress,
} from './infrastructure.service';

@Component({
  selector: 'app-geostudio-infrastructure',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './infrastructure.component.html',
  styleUrl: './infrastructure.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfrastructureComponent implements OnInit, OnDestroy {
  private readonly svc = inject(GeoInfrastructureService);
  private readonly destroyRef = inject(DestroyRef);

  // ---------- state ----------
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly lastUpdated = signal<string>('');
  readonly selectedNode = signal<InfraNode | null>(null);
  readonly actionInProgress = signal(false);

  // delegated
  readonly kpi = this.svc.kpi;
  readonly nodes = this.svc.nodes;
  readonly cache = this.svc.cache;
  readonly index = this.svc.index;
  readonly cluster = this.svc.cluster;
  readonly hubConnected = this.svc.hubConnected;
  readonly liveStatusChanges = this.svc.liveStatusChanges;
  readonly liveIngestionProgress = this.svc.liveIngestionProgress;
  readonly cacheUtilizationPct = this.svc.cacheUtilizationPct;

  // ---------- computed ----------
  readonly kpiCards = computed(() => {
    const k = this.kpi();
    return [
      { label: 'Total Nodes', value: k.totalNodes, icon: 'dns', cssClass: 'kpi-total' },
      { label: 'Online', value: k.nodesOnline, icon: 'check_circle', cssClass: 'kpi-online' },
      { label: 'Degraded', value: k.nodesDegraded, icon: 'warning', cssClass: 'kpi-degraded' },
      { label: 'Offline', value: k.nodesOffline, icon: 'cancel', cssClass: 'kpi-offline' },
      { label: 'Avg CPU', value: k.avgCpuPct.toFixed(1), icon: 'memory', cssClass: 'kpi-cpu', suffix: '%' },
      { label: 'Avg Memory', value: k.avgMemoryPct.toFixed(1), icon: 'sd_storage', cssClass: 'kpi-memory', suffix: '%' },
      { label: 'Avg Disk', value: k.avgDiskPct.toFixed(1), icon: 'storage', cssClass: 'kpi-disk', suffix: '%' },
      { label: 'Network I/O', value: (k.totalNetworkInMbps + k.totalNetworkOutMbps).toFixed(0), icon: 'swap_vert', cssClass: 'kpi-network', suffix: 'Mbps' },
    ];
  });

  readonly clusterHealthClass = this.svc.clusterHealthClass;

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
          this.error.set(err?.message ?? 'Failed to load infrastructure data');
          this.loading.set(false);
        },
      });

    // Connect SignalR live hub
    this.svc.connectHub();
  }

  ngOnDestroy(): void {
    this.svc.disconnectHub();
  }

  // ---------- actions ----------
  selectNode(node: InfraNode): void {
    this.selectedNode.set(
      this.selectedNode()?.id === node.id ? null : node,
    );
  }

  deleteCache(): void {
    this.actionInProgress.set(true);
    this.svc.deleteCache().subscribe({
      next: () => this.actionInProgress.set(false),
      error: () => this.actionInProgress.set(false),
    });
  }

  runQualityCheck(): void {
    this.actionInProgress.set(true);
    this.svc.runQualityCheck().subscribe({
      next: () => this.actionInProgress.set(false),
      error: () => this.actionInProgress.set(false),
    });
  }

  runCleanup(): void {
    this.actionInProgress.set(true);
    this.svc.runCleanup().subscribe({
      next: () => this.actionInProgress.set(false),
      error: () => this.actionInProgress.set(false),
    });
  }

  // ---------- template helpers ----------
  nodeStatusClass(status: NodeHealthStatus): string {
    switch (status) {
      case 'online': return 'node-online';
      case 'degraded': return 'node-degraded';
      case 'offline': return 'node-offline';
      case 'maintenance': return 'node-maintenance';
      default: return '';
    }
  }

  nodeStatusIcon(status: NodeHealthStatus): string {
    switch (status) {
      case 'online': return 'check_circle';
      case 'degraded': return 'warning';
      case 'offline': return 'cancel';
      case 'maintenance': return 'build';
      default: return 'help';
    }
  }

  usageClass(pct: number): string {
    if (pct >= 90) return 'usage-critical';
    if (pct >= 70) return 'usage-warning';
    return 'usage-normal';
  }

  formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    if (days > 0) return `${days}d ${hours}h`;
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }

  trackByNodeId(_: number, n: InfraNode): string {
    return n.id;
  }

  trackByChangeTimestamp(_: number, c: LiveNodeStatusChange): string {
    return c.nodeId + c.timestamp;
  }

  trackByProgressId(_: number, p: LiveIngestionProgress): string {
    return p.pipelineId;
  }
}
