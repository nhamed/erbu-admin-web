import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ChaosExperiment,
  ChaosType,
  ChaosStatus,
  ChaosSeverity,
} from '@erbu-admin-web/shared/models';
import { ChaosService, ChaosExperimentFormData } from './chaos.service';

interface ConfirmAction {
  title: string;
  message: string;
  confirmLabel: string;
  variant: 'primary' | 'danger';
  action: () => void;
}

@Component({
  selector: 'ops-chaos-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chaos-tab.page.html',
  styleUrl: './chaos-tab.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChaosTabPage implements OnInit {
  readonly chaosService = inject(ChaosService);

  /* Enums exposed to template */
  readonly chaosStatuses = Object.values(ChaosStatus);
  readonly chaosTypes = Object.values(ChaosType);
  readonly chaosSeverities = Object.values(ChaosSeverity);

  /* UI state */
  readonly showForm = signal(false);
  readonly editingExperiment = signal<ChaosExperiment | null>(null);
  readonly confirmAction = signal<ConfirmAction | null>(null);
  readonly statusFilter = signal<ChaosStatus | ''>('');
  readonly typeFilter = signal<ChaosType | ''>('');

  /* Form model */
  formData: ChaosExperimentFormData = this.emptyFormData();

  /* Computed */
  readonly isFormValid = computed(() => {
    const d = this.formData;
    return (
      !!d.name?.trim() &&
      !!d.targetService?.trim() &&
      !!d.faultType &&
      !!d.severity &&
      d.durationSeconds > 0 &&
      !!d.hypothesis?.trim()
    );
  });

  /* Lifecycle */
  ngOnInit(): void {
    this.chaosService.loadExperiments();
  }

  /* Filter handlers */
  onStatusFilterChange(value: ChaosStatus | ''): void {
    this.statusFilter.set(value);
    this.chaosService.loadExperiments(
      1,
      25,
      value || undefined,
      this.typeFilter() || undefined
    );
  }

  onTypeFilterChange(value: ChaosType | ''): void {
    this.typeFilter.set(value);
    this.chaosService.loadExperiments(
      1,
      25,
      this.statusFilter() || undefined,
      value || undefined
    );
  }

  refreshList(): void {
    this.chaosService.loadExperiments(
      1,
      25,
      this.statusFilter() || undefined,
      this.typeFilter() || undefined
    );
  }

  /* Selection */
  selectExperiment(experiment: ChaosExperiment): void {
    this.chaosService.getExperiment(experiment.id).subscribe(() => {
      this.chaosService.loadImpactMetrics(experiment.id);
    });
  }

  /* Form management */
  openCreateForm(): void {
    this.formData = this.emptyFormData();
    this.editingExperiment.set(null);
    this.showForm.set(true);
  }

  openEditForm(experiment: ChaosExperiment): void {
    this.editingExperiment.set(experiment);
    this.formData = {
      name: experiment.name,
      description: experiment.description,
      targetService: experiment.targetService,
      faultType: experiment.faultType,
      severity: experiment.severity,
      durationSeconds: experiment.durationSeconds,
      rollbackOnFailure: experiment.rollbackOnFailure,
      hypothesis: experiment.hypothesis,
    };
    this.showForm.set(true);
  }

  cancelForm(): void {
    this.showForm.set(false);
    this.editingExperiment.set(null);
    this.formData = this.emptyFormData();
  }

  submitForm(): void {
    if (!this.isFormValid()) return;

    const editing = this.editingExperiment();
    if (editing) {
      this.chaosService
        .updateExperiment(editing.id, this.formData)
        .subscribe(() => this.cancelForm());
    } else {
      this.chaosService
        .createExperiment(this.formData)
        .subscribe(() => this.cancelForm());
    }
  }

  /* Run / Stop with confirmation */
  confirmRun(experiment: ChaosExperiment): void {
    this.confirmAction.set({
      title: 'Run Chaos Experiment',
      message: `Are you sure you want to run "${experiment.name}" against ${experiment.targetService}? This will inject a ${this.formatFaultType(experiment.faultType)} fault with ${experiment.severity} severity for ${experiment.durationSeconds} seconds.`,
      confirmLabel: 'Run Experiment',
      variant: 'primary',
      action: () => {
        this.chaosService.runExperiment(experiment.id).subscribe();
      },
    });
  }

  confirmStop(experiment: ChaosExperiment): void {
    this.confirmAction.set({
      title: 'Stop Chaos Experiment',
      message: `Are you sure you want to stop "${experiment.name}"? ${experiment.rollbackOnFailure ? 'The system will attempt an automatic rollback.' : 'Manual intervention may be required after stopping.'}`,
      confirmLabel: 'Stop Experiment',
      variant: 'danger',
      action: () => {
        this.chaosService.stopExperiment(experiment.id).subscribe();
      },
    });
  }

  confirmDelete(experiment: ChaosExperiment): void {
    this.confirmAction.set({
      title: 'Delete Experiment',
      message: `Are you sure you want to permanently delete "${experiment.name}"? This action cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      action: () => {
        this.chaosService.deleteExperiment(experiment.id).subscribe();
      },
    });
  }

  executeConfirmedAction(): void {
    const action = this.confirmAction();
    if (action) {
      action.action();
      this.confirmAction.set(null);
    }
  }

  cancelConfirm(): void {
    this.confirmAction.set(null);
  }

  /* Status-based guards */
  canRun(experiment: ChaosExperiment): boolean {
    return [ChaosStatus.Draft, ChaosStatus.Approved, ChaosStatus.Scheduled].includes(
      experiment.status
    );
  }

  canStop(experiment: ChaosExperiment): boolean {
    return experiment.status === ChaosStatus.Running;
  }

  canEdit(experiment: ChaosExperiment): boolean {
    return [ChaosStatus.Draft, ChaosStatus.Approved].includes(experiment.status);
  }

  canDelete(experiment: ChaosExperiment): boolean {
    return [
      ChaosStatus.Draft,
      ChaosStatus.Completed,
      ChaosStatus.RolledBack,
      ChaosStatus.Cancelled,
    ].includes(experiment.status);
  }

  /* Display helpers */
  formatFaultType(faultType: ChaosType): string {
    const labels: Record<ChaosType, string> = {
      [ChaosType.NetworkLatency]: 'Network Latency',
      [ChaosType.NetworkPartition]: 'Network Partition',
      [ChaosType.ServiceKill]: 'Service Kill',
      [ChaosType.CpuStress]: 'CPU Stress',
      [ChaosType.MemoryStress]: 'Memory Stress',
      [ChaosType.DiskFill]: 'Disk Fill',
      [ChaosType.DnsFailure]: 'DNS Failure',
      [ChaosType.ClockSkew]: 'Clock Skew',
    };
    return labels[faultType] ?? faultType;
  }

  /* Private */
  private emptyFormData(): ChaosExperimentFormData {
    return {
      name: '',
      description: '',
      targetService: '',
      faultType: ChaosType.NetworkLatency,
      severity: ChaosSeverity.Low,
      durationSeconds: 60,
      rollbackOnFailure: true,
      hypothesis: '',
    };
  }
}
