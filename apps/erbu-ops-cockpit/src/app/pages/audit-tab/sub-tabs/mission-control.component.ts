import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatListModule } from '@angular/material/list';
import {
  AuditMissionControlStatus,
  AuditHealthState,
  TunnelState,
  CaptureMode,
  AuditTunnel,
} from '@erbu-admin-web/shared/models';
import { AuditService } from '../audit.service';
import { AuditTunnelService } from '../audit-tunnel.service';

@Component({
  selector: 'app-mission-control',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatCardModule,
    MatDividerModule,
    MatListModule,
  ],
  templateUrl: './mission-control.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      display: block;
      padding: 16px;
    }

    .dashboard-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }

    .status-card {
      padding: 20px;
      border-radius: 12px;
      border: 1px solid rgba(0, 0, 0, 0.12);
    }

    .status-card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }

    .status-card-header mat-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }

    .card-title {
      font-size: 13px;
      color: rgba(0, 0, 0, 0.54);
      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.5px;
    }

    .card-value {
      font-size: 32px;
      font-weight: 700;
      line-height: 1;
    }

    .card-subtitle {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.54);
      margin-top: 4px;
    }

    .health-green { color: #2e7d32; }
    .health-yellow { color: #f9a825; }
    .health-red { color: #c62828; }
    .health-unknown { color: #9e9e9e; }

    .health-indicator {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      display: inline-block;
    }

    .indicator-green { background: #4caf50; box-shadow: 0 0 8px rgba(76, 175, 80, 0.5); }
    .indicator-yellow { background: #fdd835; box-shadow: 0 0 8px rgba(253, 216, 53, 0.5); }
    .indicator-red { background: #f44336; box-shadow: 0 0 8px rgba(244, 67, 54, 0.5); }
    .indicator-unknown { background: #9e9e9e; }

    .agents-section {
      margin-top: 24px;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      font-size: 16px;
      font-weight: 500;
    }

    .agent-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 12px;
    }

    .agent-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 8px;
    }

    .agent-info {
      flex: 1;
    }

    .agent-name {
      font-weight: 500;
      font-size: 14px;
    }

    .agent-meta {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.54);
    }

    .tunnels-section {
      margin-top: 24px;
    }

    .tunnel-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 8px;
      margin-bottom: 8px;
    }

    .tunnel-info {
      flex: 1;
    }

    .tunnel-name {
      font-weight: 500;
      font-size: 14px;
    }

    .tunnel-detail {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.54);
      font-family: 'Cascadia Code', 'Consolas', monospace;
    }

    .tunnel-bytes {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.54);
    }

    .toolbar {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-bottom: 16px;
    }

    .loading-overlay {
      display: flex;
      justify-content: center;
      padding: 48px;
    }

    .empty-state {
      text-align: center;
      padding: 48px;
      color: rgba(0, 0, 0, 0.38);
    }

    .error-banner {
      background: #ffebee;
      color: #c62828;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
  `],
})
export class MissionControlComponent implements OnInit, OnDestroy {
  private readonly auditService = inject(AuditService);
  private readonly tunnelService = inject(AuditTunnelService);

  readonly status = signal<AuditMissionControlStatus | null>(null);
  readonly tunnels = signal<AuditTunnel[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  private refreshInterval: ReturnType<typeof setInterval> | null = null;

  readonly AuditHealthState = AuditHealthState;

  ngOnInit(): void {
    this.refresh();
    this.refreshInterval = setInterval(() => this.refresh(), 15_000);
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  refresh(): void {
    this.isLoading.set(true);
    this.error.set(null);

    this.auditService.getMissionControlStatus().subscribe({
      next: data => {
        this.status.set(data);
        this.isLoading.set(false);
      },
      error: err => {
        this.error.set(err?.message ?? 'Failed to load mission control status');
        this.isLoading.set(false);
      },
    });

    this.tunnelService.listTunnels().subscribe({
      next: data => this.tunnels.set(data),
      error: () => {
        // Tunnel listing failure is non-blocking
      },
    });
  }

  closeTunnel(tunnel: AuditTunnel): void {
    this.tunnelService.closeTunnel(tunnel.id).subscribe({
      next: () => {
        this.tunnels.update(list => list.filter(t => t.id !== tunnel.id));
      },
    });
  }

  getHealthClass(state: AuditHealthState): string {
    return 'health-' + state.toLowerCase();
  }

  getIndicatorClass(state: AuditHealthState): string {
    return 'indicator-' + state.toLowerCase();
  }

  getTunnelIndicatorClass(state: string): string {
    switch (state) {
      case 'Connected': return 'indicator-green';
      case 'Connecting': return 'indicator-yellow';
      case 'Error': return 'indicator-red';
      default: return 'indicator-unknown';
    }
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
