import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  AuthManagementService,
  AuthDiagnostic,
  DiagnosticLevel,
} from '../auth-management.service';

@Component({
  selector: 'app-diagnostics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './diagnostics.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DiagnosticsComponent implements OnInit {
  private readonly svc = inject(AuthManagementService);

  readonly diagnostics = this.svc.diagnostics;
  readonly loading = this.svc.loading;

  readonly overallStatus = computed(() => this.diagnostics()?.overallStatus ?? 'Healthy');
  readonly components = computed(() => this.diagnostics()?.components ?? []);

  readonly summaryCards = computed(() => {
    const d = this.diagnostics();
    if (!d) return [];
    return [
      { label: 'Total Users', value: d.totalUsers.toLocaleString(), icon: 'people' },
      { label: 'Active Tokens', value: d.activeTokenCount.toLocaleString(), icon: 'vpn_key' },
      { label: 'Active Bans', value: d.activeBanCount.toLocaleString(), icon: 'block' },
      { label: 'Failed Logins (24h)', value: d.failedLoginLast24h.toLocaleString(), icon: 'error_outline' },
      { label: 'Avg Login Latency', value: d.avgLoginLatencyMs + 'ms', icon: 'speed' },
    ];
  });

  readonly healthyCount = computed(
    () => this.components().filter((c) => c.status === 'Healthy').length,
  );

  readonly totalComponents = computed(() => this.components().length);

  ngOnInit(): void {
    this.svc.loadDiagnostics();
  }

  refresh(): void {
    this.svc.loadDiagnostics();
  }

  overallStatusClass(): string {
    return this.levelClass(this.overallStatus());
  }

  levelClass(level: DiagnosticLevel): string {
    switch (level) {
      case 'Healthy':
        return 'diag-healthy';
      case 'Warning':
        return 'diag-warning';
      case 'Error':
        return 'diag-error';
      default:
        return '';
    }
  }

  levelIcon(level: DiagnosticLevel): string {
    switch (level) {
      case 'Healthy':
        return 'check_circle';
      case 'Warning':
        return 'warning';
      case 'Error':
        return 'error';
      default:
        return 'help';
    }
  }

  detailEntries(details: Record<string, string>): { key: string; value: string }[] {
    return Object.entries(details).map(([key, value]) => ({ key, value }));
  }

  trackByComponent(_: number, c: AuthDiagnostic): string {
    return c.component;
  }
}
