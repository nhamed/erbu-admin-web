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
  ChaosService,
  ChaosScenario,
  FaultType,
} from './chaos.service';
import { ChaosFault } from '@erbu-admin-web/shared/models';

@Component({
  selector: 'app-chaos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chaos.component.html',
  styleUrl: './chaos.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChaosComponent implements OnInit, OnDestroy {
  private readonly svc = inject(ChaosService);
  private readonly destroyRef = inject(DestroyRef);

  // ---------- state ----------
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly lastUpdated = signal<string>('');
  readonly actionInProgress = signal<string | null>(null);
  readonly killSwitchInProgress = signal(false);

  // delegated from service
  readonly faults = this.svc.filteredFaults;
  readonly scenarios = this.svc.scenarios;
  readonly state = this.svc.state;
  readonly featureFlagEnabled = this.svc.featureFlagEnabled;
  readonly killSwitchActive = this.svc.killSwitchActive;
  readonly activeFaults = this.svc.activeFaults;
  readonly activeScenarios = this.svc.activeScenarios;
  readonly faultsByType = this.svc.faultsByType;
  readonly targetServices = this.svc.targetServices;
  readonly selectedFaultType = this.svc.selectedFaultType;
  readonly showActiveOnly = this.svc.showActiveOnly;

  // ---------- computed ----------
  readonly kpiCards = computed(() => {
    const s = this.state();
    return [
      {
        label: 'Active Faults',
        value: s.activeFaultCount,
        icon: 'bug_report',
        cssClass: 'kpi-active-faults',
      },
      {
        label: 'Active Scenarios',
        value: s.activeScenarioCount,
        icon: 'dynamic_feed',
        cssClass: 'kpi-active-scenarios',
      },
      {
        label: 'Total Faults',
        value: s.totalFaults,
        icon: 'all_inclusive',
        cssClass: 'kpi-total-faults',
      },
      {
        label: 'Total Scenarios',
        value: s.totalScenarios,
        icon: 'playlist_play',
        cssClass: 'kpi-total-scenarios',
      },
      {
        label: 'Kill Switch',
        value: s.killSwitchActive ? 'ACTIVE' : 'Off',
        icon: 'power_settings_new',
        cssClass: s.killSwitchActive ? 'kpi-kill-active' : 'kpi-kill-off',
      },
      {
        label: 'Feature Flag',
        value: s.featureFlagEnabled ? 'Enabled' : 'Disabled',
        icon: 'flag',
        cssClass: s.featureFlagEnabled ? 'kpi-flag-on' : 'kpi-flag-off',
      },
    ];
  });

  readonly faultTypeOptions: FaultType[] = [
    'Latency',
    'Error',
    'Kill',
    'PacketLoss',
    'CPUStress',
    'MemoryStress',
  ];

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
          this.error.set(err?.message ?? 'Failed to load chaos data');
          this.loading.set(false);
        },
      });
  }

  ngOnDestroy(): void {
    // no chart cleanup needed for this module
  }

  // ---------- template actions ----------

  /**
   * Kill-switch: NO confirmation dialog by emergency design.
   * Fires immediately on click.
   */
  onKillSwitch(): void {
    this.killSwitchInProgress.set(true);
    this.svc.activateKillSwitch().subscribe({
      next: () => this.killSwitchInProgress.set(false),
      error: () => this.killSwitchInProgress.set(false),
    });
  }

  toggleFault(fault: ChaosFault): void {
    this.actionInProgress.set(fault.id);
    const obs = fault.isActive
      ? this.svc.deactivateFault(fault.id)
      : this.svc.activateFault(fault.id);
    obs.subscribe({
      next: () => this.actionInProgress.set(null),
      error: () => this.actionInProgress.set(null),
    });
  }

  toggleScenario(scenario: ChaosScenario): void {
    this.actionInProgress.set(scenario.id);
    const obs = scenario.isActive
      ? this.svc.deactivateScenario(scenario.id)
      : this.svc.activateScenario(scenario.id);
    obs.subscribe({
      next: () => this.actionInProgress.set(null),
      error: () => this.actionInProgress.set(null),
    });
  }

  onFaultTypeChange(type: string): void {
    this.svc.setFaultTypeFilter((type as FaultType) || null);
  }

  onActiveFilterChange(active: boolean): void {
    this.svc.setActiveFilter(active);
  }

  // ---------- template helpers ----------
  faultTypeIcon(type: string): string {
    switch (type) {
      case 'Latency':
        return 'hourglass_top';
      case 'Error':
        return 'error';
      case 'Kill':
        return 'dangerous';
      case 'PacketLoss':
        return 'wifi_off';
      case 'CPUStress':
        return 'memory';
      case 'MemoryStress':
        return 'storage';
      default:
        return 'bug_report';
    }
  }

  faultTypeClass(type: string): string {
    switch (type) {
      case 'Latency':
        return 'fault-latency';
      case 'Error':
        return 'fault-error';
      case 'Kill':
        return 'fault-kill';
      case 'PacketLoss':
        return 'fault-packetloss';
      case 'CPUStress':
        return 'fault-cpustress';
      case 'MemoryStress':
        return 'fault-memorystress';
      default:
        return '';
    }
  }

  severityClass(severity: string): string {
    switch (severity) {
      case 'Critical':
        return 'severity-critical';
      case 'High':
        return 'severity-high';
      case 'Medium':
        return 'severity-medium';
      case 'Low':
        return 'severity-low';
      default:
        return '';
    }
  }

  trackByFaultId(_: number, f: ChaosFault): string {
    return f.id;
  }

  trackByScenarioId(_: number, s: ChaosScenario): string {
    return s.id;
  }
}
