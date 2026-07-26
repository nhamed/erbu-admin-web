import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  EnvBackupService,
  EnvBackup,
  BackupDetail,
  BackupComparison,
  BackupStatus,
  CreateBackupRequest,
} from './env-backup.service';

@Component({
  selector: 'app-env-backup',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './env-backup.page.html',
  styleUrl: './env-backup.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnvBackupPage implements OnInit, OnDestroy {
  protected readonly svc = inject(EnvBackupService);
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  // ---- Delegate signals from service ----
  readonly loading = this.svc.loading;
  readonly detailLoading = this.svc.detailLoading;
  readonly creating = this.svc.creating;
  readonly restoring = this.svc.restoring;
  readonly comparing = this.svc.comparing;
  readonly error = this.svc.error;
  readonly backups = this.svc.backups;
  readonly selectedBackup = this.svc.selectedBackup;
  readonly comparison = this.svc.comparison;
  readonly totpChallenge = this.svc.totpChallenge;
  readonly environments = this.svc.environments;

  // ---- UI state ----
  readonly showCreateDialog = signal(false);
  readonly showRestoreDialog = signal(false);
  readonly showCompareDialog = signal(false);
  readonly showDeleteConfirm = signal(false);

  // ---- Create form ----
  readonly createName = signal('');
  readonly createEnvironment = signal('');
  readonly createNotes = signal('');
  readonly createIncludeSecrets = signal(false);

  // ---- Restore form ----
  readonly restoreTargetEnv = signal('');
  readonly restoreTotpCode = signal('');
  readonly restoreNotes = signal('');
  readonly restoreBackupId = signal('');

  // ---- Compare form ----
  readonly compareBaseId = signal('');
  readonly compareTargetId = signal('');

  // ---- Delete form ----
  readonly deleteBackupId = signal('');
  readonly deleteTotpCode = signal('');

  // ---- Filter ----
  readonly filterEnvironment = signal('');

  // ---- Computed ----
  readonly hasBackups = computed(() => this.backups().length > 0);
  readonly hasSelection = computed(() => this.selectedBackup() !== null);
  readonly hasComparison = computed(() => this.comparison() !== null);

  readonly kpiCards = computed(() => {
    const all = this.backups();
    const completed = all.filter((b) => b.status === 'Completed');
    const failed = all.filter((b) => b.status === 'Failed');
    const totalSize = all.reduce((sum, b) => sum + b.sizeBytes, 0);

    return [
      {
        label: 'Total Backups',
        value: all.length.toString(),
        icon: 'backup',
      },
      {
        label: 'Completed',
        value: completed.length.toString(),
        icon: 'check_circle',
      },
      {
        label: 'Failed',
        value: failed.length.toString(),
        icon: 'error_outline',
      },
      {
        label: 'Total Size',
        value: this.formatBytes(totalSize),
        icon: 'storage',
      },
    ];
  });

  readonly completedBackupsForCompare = computed(() =>
    this.backups().filter((b) => b.status === 'Completed'),
  );

  // ---- Lifecycle ----
  ngOnInit(): void {
    this.svc.loadBackups();
    this.refreshTimer = setInterval(() => this.svc.loadBackups(), 30_000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    this.svc.clearError();
  }

  // ---- Actions ----
  onRefresh(): void {
    const env = this.filterEnvironment() || undefined;
    this.svc.loadBackups(1, 25, env);
  }

  onFilterChange(env: string): void {
    this.filterEnvironment.set(env);
    this.svc.loadBackups(1, 25, env || undefined);
  }

  onSelectBackup(backup: EnvBackup): void {
    this.svc.loadBackupDetail(backup.id);
  }

  onCloseDetail(): void {
    this.svc.clearSelection();
  }

  // ---- Create ----
  onOpenCreate(): void {
    this.createName.set('');
    this.createEnvironment.set('');
    this.createNotes.set('');
    this.createIncludeSecrets.set(false);
    this.showCreateDialog.set(true);
  }

  onCloseCreate(): void {
    this.showCreateDialog.set(false);
  }

  onSubmitCreate(): void {
    const name = this.createName().trim();
    const environment = this.createEnvironment().trim();
    if (!name || !environment) return;

    const request: CreateBackupRequest = {
      name,
      environment,
      notes: this.createNotes().trim() || undefined,
      includeSecrets: this.createIncludeSecrets(),
    };

    this.svc.createBackup(request);
    this.showCreateDialog.set(false);
  }

  // ---- Restore ----
  onOpenRestore(backup: EnvBackup): void {
    this.restoreBackupId.set(backup.id);
    this.restoreTargetEnv.set('');
    this.restoreTotpCode.set('');
    this.restoreNotes.set('');
    this.showRestoreDialog.set(true);
  }

  onCloseRestore(): void {
    this.showRestoreDialog.set(false);
    this.svc.clearTotpChallenge();
  }

  onRequestTotp(): void {
    const backupId = this.restoreBackupId();
    const targetEnv = this.restoreTargetEnv().trim();
    if (!backupId || !targetEnv) return;
    this.svc.requestTotpChallenge(backupId, targetEnv);
  }

  onSubmitRestore(): void {
    const code = this.restoreTotpCode().trim();
    if (!code || code.length !== 6) return;

    this.svc.restoreBackup({
      backupId: this.restoreBackupId(),
      targetEnvironment: this.restoreTargetEnv().trim(),
      totpCode: code,
      notes: this.restoreNotes().trim() || undefined,
    });
    this.showRestoreDialog.set(false);
  }

  // ---- Compare ----
  onOpenCompare(): void {
    this.compareBaseId.set('');
    this.compareTargetId.set('');
    this.svc.clearComparison();
    this.showCompareDialog.set(true);
  }

  onCloseCompare(): void {
    this.showCompareDialog.set(false);
    this.svc.clearComparison();
  }

  onSubmitCompare(): void {
    const base = this.compareBaseId();
    const target = this.compareTargetId();
    if (!base || !target || base === target) return;
    this.svc.compareBackups(base, target);
  }

  // ---- Delete ----
  onOpenDelete(backup: EnvBackup): void {
    this.deleteBackupId.set(backup.id);
    this.deleteTotpCode.set('');
    this.showDeleteConfirm.set(true);
  }

  onCloseDelete(): void {
    this.showDeleteConfirm.set(false);
  }

  onSubmitDelete(): void {
    const code = this.deleteTotpCode().trim();
    if (!code || code.length !== 6) return;

    this.svc.deleteBackup(this.deleteBackupId(), code).subscribe({
      next: () => this.showDeleteConfirm.set(false),
      error: () => {
        // error handled in service
      },
    });
  }

  onDismissError(): void {
    this.svc.clearError();
  }

  // ---- Template helpers ----
  statusClass(status: BackupStatus): string {
    switch (status) {
      case 'Completed':
        return 'status-completed';
      case 'InProgress':
        return 'status-in-progress';
      case 'Failed':
        return 'status-failed';
      case 'Restoring':
        return 'status-restoring';
      default:
        return '';
    }
  }

  serviceStatusClass(status: string): string {
    switch (status) {
      case 'Ok':
        return 'svc-ok';
      case 'Warning':
        return 'svc-warning';
      case 'Error':
        return 'svc-error';
      default:
        return '';
    }
  }

  restoreStatusClass(status: string): string {
    switch (status) {
      case 'Success':
        return 'restore-success';
      case 'Failed':
        return 'restore-failed';
      case 'Partial':
        return 'restore-partial';
      default:
        return '';
    }
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  trackByBackupId(_: number, backup: EnvBackup): string {
    return backup.id;
  }

  trackByServiceName(_: number, svc: { serviceName: string }): string {
    return svc.serviceName;
  }

  trackByKey(_: number, entry: { key: string; serviceName: string }): string {
    return `${entry.serviceName}::${entry.key}`;
  }
}
