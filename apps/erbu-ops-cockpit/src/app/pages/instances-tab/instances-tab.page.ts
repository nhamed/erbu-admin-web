import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DeviceInstance, DeviceStatus, E2EPlatform } from '@erbu-admin-web/shared/models';
import {
  InstancesService,
  DeviceGroup,
  DeviceActionType,
  DeviceActionResult,
  BatchActionResult,
  AdbCommandResult,
} from './instances.service';

@Component({
  selector: 'cockpit-instances-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './instances-tab.page.html',
  styleUrls: ['./instances-tab.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstancesTabPage implements OnInit, OnDestroy {
  private readonly instancesService = inject(InstancesService);
  private pollSub?: Subscription;

  // ── State ──

  readonly devices = signal<DeviceInstance[]>([]);
  readonly groups = signal<DeviceGroup[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // ── Selection ──

  readonly selectedIds = signal<Set<string>>(new Set());
  readonly allSelected = computed(
    () =>
      this.filteredDevices().length > 0 &&
      this.filteredDevices().every((d) => this.selectedIds().has(d.id)),
  );

  // ── Filters ──

  readonly searchTerm = signal('');
  readonly statusFilter = signal<DeviceStatus | ''>('');
  readonly platformFilter = signal<E2EPlatform | ''>('');
  readonly groupFilter = signal('');

  readonly filteredDevices = computed(() => {
    let result = this.devices();
    const search = this.searchTerm().toLowerCase();
    const status = this.statusFilter();
    const platform = this.platformFilter();
    const group = this.groupFilter();

    if (search) {
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(search) ||
          d.id.toLowerCase().includes(search) ||
          d.osVersion.toLowerCase().includes(search),
      );
    }
    if (status) {
      result = result.filter((d) => d.status === status);
    }
    if (platform) {
      result = result.filter((d) => d.platform === platform);
    }
    if (group) {
      const g = this.groups().find((gr) => gr.id === group);
      if (g) {
        const ids = new Set(g.deviceIds);
        result = result.filter((d) => ids.has(d.id));
      }
    }

    return result;
  });

  // ── KPIs ──

  readonly totalCount = computed(() => this.devices().length);
  readonly availableCount = computed(
    () => this.devices().filter((d) => d.status === DeviceStatus.Available).length,
  );
  readonly inUseCount = computed(
    () => this.devices().filter((d) => d.status === DeviceStatus.InUse).length,
  );
  readonly offlineCount = computed(
    () => this.devices().filter((d) => d.status === DeviceStatus.Offline).length,
  );
  readonly errorCount = computed(
    () => this.devices().filter((d) => d.status === DeviceStatus.Error).length,
  );

  // ── Action feedback ──

  readonly actionInProgress = signal(false);
  readonly lastActionResult = signal<string | null>(null);

  // ── ADB console ──

  readonly adbDeviceId = signal('');
  readonly adbCommand = signal('');
  readonly adbOutput = signal<AdbCommandResult | null>(null);
  readonly adbRunning = signal(false);

  // ── Group management ──

  readonly showGroupDialog = signal(false);
  readonly newGroupName = signal('');
  readonly newGroupDescription = signal('');

  // ── Enum refs for template ──

  readonly DeviceStatus = DeviceStatus;
  readonly E2EPlatform = E2EPlatform;
  readonly DeviceActionType = DeviceActionType;

  // ── Lifecycle ──

  ngOnInit(): void {
    this.loadDevices();
    this.loadGroups();
    this.startPolling();
  }

  ngOnDestroy(): void {
    this.pollSub?.unsubscribe();
  }

  // ── Data loading ──

  loadDevices(): void {
    this.loading.set(true);
    this.error.set(null);

    this.instancesService
      .list(
        {
          status: this.statusFilter() ? [this.statusFilter() as DeviceStatus] : undefined,
          platform: this.platformFilter() || undefined,
          search: this.searchTerm() || undefined,
          groupId: this.groupFilter() || undefined,
        },
        1,
        500,
      )
      .subscribe({
        next: (page) => {
          this.devices.set(page.items);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set('Failed to load device instances');
          this.loading.set(false);
          console.error('Instances load error:', err);
        },
      });
  }

  loadGroups(): void {
    this.instancesService.listGroups().subscribe({
      next: (groups) => this.groups.set(groups),
      error: (err) => console.error('Groups load error:', err),
    });
  }

  private startPolling(): void {
    this.pollSub = this.instancesService.instances$.subscribe({
      next: (devices) => this.devices.set(devices),
      error: (err) => console.error('Polling error:', err),
    });
  }

  refresh(): void {
    this.loadDevices();
    this.loadGroups();
  }

  // ── Selection ──

  toggleSelect(deviceId: string): void {
    this.selectedIds.update((ids) => {
      const next = new Set(ids);
      if (next.has(deviceId)) {
        next.delete(deviceId);
      } else {
        next.add(deviceId);
      }
      return next;
    });
  }

  toggleSelectAll(): void {
    if (this.allSelected()) {
      this.selectedIds.set(new Set());
    } else {
      this.selectedIds.set(new Set(this.filteredDevices().map((d) => d.id)));
    }
  }

  isSelected(deviceId: string): boolean {
    return this.selectedIds().has(deviceId);
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  // ── Single device actions ──

  restartApp(device: DeviceInstance): void {
    this.executeAction(
      device.name,
      this.instancesService.restartApp(device.id),
    );
  }

  clearData(device: DeviceInstance): void {
    if (!confirm(`Clear all app data on "${device.name}"? This cannot be undone.`)) {
      return;
    }
    this.executeAction(
      device.name,
      this.instancesService.clearData(device.id),
    );
  }

  captureLogs(device: DeviceInstance): void {
    this.executeAction(
      device.name,
      this.instancesService.captureLogs(device.id),
    );
  }

  private executeAction(
    label: string,
    action$: ReturnType<typeof this.instancesService.restartApp>,
  ): void {
    this.actionInProgress.set(true);
    this.lastActionResult.set(null);

    action$.subscribe({
      next: (result: DeviceActionResult) => {
        this.actionInProgress.set(false);
        this.lastActionResult.set(
          result.success
            ? `${result.action} on "${label}" succeeded (${result.durationMs}ms)`
            : `${result.action} on "${label}" failed: ${result.message}`,
        );
      },
      error: (err) => {
        this.actionInProgress.set(false);
        this.lastActionResult.set(`Action on "${label}" failed: ${err.message ?? 'Unknown error'}`);
      },
    });
  }

  // ── Batch operations ──

  batchRestart(): void {
    this.executeBatch(DeviceActionType.RestartApp);
  }

  batchClearData(): void {
    const count = this.selectedIds().size;
    if (!confirm(`Clear app data on ${count} device(s)? This cannot be undone.`)) {
      return;
    }
    this.executeBatch(DeviceActionType.ClearData);
  }

  batchCaptureLogs(): void {
    this.executeBatch(DeviceActionType.CaptureLogs);
  }

  private executeBatch(action: DeviceActionType): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    this.actionInProgress.set(true);
    this.lastActionResult.set(null);

    this.instancesService
      .batchAction({ deviceIds: ids, action })
      .subscribe({
        next: (result: BatchActionResult) => {
          this.actionInProgress.set(false);
          this.lastActionResult.set(
            `Batch ${action}: ${result.succeeded}/${result.totalDevices} succeeded, ${result.failed} failed`,
          );
          this.clearSelection();
          this.loadDevices();
        },
        error: (err) => {
          this.actionInProgress.set(false);
          this.lastActionResult.set(`Batch ${action} failed: ${err.message ?? 'Unknown error'}`);
        },
      });
  }

  // ── ADB console ──

  runAdbCommand(): void {
    const deviceId = this.adbDeviceId();
    const command = this.adbCommand().trim();
    if (!deviceId || !command) return;

    this.adbRunning.set(true);
    this.adbOutput.set(null);

    this.instancesService
      .adbShell({ deviceId, command, timeoutMs: 30_000 })
      .subscribe({
        next: (result) => {
          this.adbOutput.set(result);
          this.adbRunning.set(false);
        },
        error: (err) => {
          this.adbOutput.set({
            deviceId,
            command,
            exitCode: -1,
            stdout: '',
            stderr: err.message ?? 'ADB command failed',
            durationMs: 0,
          });
          this.adbRunning.set(false);
        },
      });
  }

  captureAdbScreenshot(): void {
    const deviceId = this.adbDeviceId();
    if (!deviceId) return;

    this.adbRunning.set(true);
    this.instancesService.adbScreenshot(deviceId).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        this.adbRunning.set(false);
      },
      error: (err) => {
        this.lastActionResult.set(`Screenshot failed: ${err.message ?? 'Unknown error'}`);
        this.adbRunning.set(false);
      },
    });
  }

  captureAdbLogcat(): void {
    const deviceId = this.adbDeviceId();
    if (!deviceId) return;

    this.adbRunning.set(true);
    this.instancesService.adbLogcat(deviceId).subscribe({
      next: (result) => {
        this.adbOutput.set(result);
        this.adbRunning.set(false);
      },
      error: (err) => {
        this.adbOutput.set({
          deviceId,
          command: 'logcat',
          exitCode: -1,
          stdout: '',
          stderr: err.message ?? 'Logcat failed',
          durationMs: 0,
        });
        this.adbRunning.set(false);
      },
    });
  }

  // ── Group management ──

  openGroupDialog(): void {
    this.newGroupName.set('');
    this.newGroupDescription.set('');
    this.showGroupDialog.set(true);
  }

  closeGroupDialog(): void {
    this.showGroupDialog.set(false);
  }

  createGroup(): void {
    const name = this.newGroupName().trim();
    const description = this.newGroupDescription().trim();
    if (!name) return;

    const deviceIds = Array.from(this.selectedIds());
    this.instancesService.createGroup(name, description, deviceIds).subscribe({
      next: () => {
        this.loadGroups();
        this.closeGroupDialog();
        this.lastActionResult.set(`Group "${name}" created with ${deviceIds.length} device(s)`);
      },
      error: (err) => {
        this.lastActionResult.set(`Failed to create group: ${err.message ?? 'Unknown error'}`);
      },
    });
  }

  deleteGroup(group: DeviceGroup): void {
    if (!confirm(`Delete group "${group.name}"?`)) return;

    this.instancesService.deleteGroup(group.id).subscribe({
      next: () => {
        this.loadGroups();
        if (this.groupFilter() === group.id) {
          this.groupFilter.set('');
        }
        this.lastActionResult.set(`Group "${group.name}" deleted`);
      },
      error: (err) => {
        this.lastActionResult.set(`Failed to delete group: ${err.message ?? 'Unknown error'}`);
      },
    });
  }

  // ── Helpers ──

  statusClass(status: DeviceStatus): string {
    switch (status) {
      case DeviceStatus.Available:
        return 'status-available';
      case DeviceStatus.InUse:
        return 'status-in-use';
      case DeviceStatus.Offline:
        return 'status-offline';
      case DeviceStatus.Maintenance:
        return 'status-maintenance';
      case DeviceStatus.Error:
        return 'status-error';
      default:
        return '';
    }
  }

  formatLastSeen(isoDate: string | null): string {
    if (!isoDate) return 'Never';
    const diff = Date.now() - new Date(isoDate).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  trackById(_index: number, device: DeviceInstance): string {
    return device.id;
  }

  trackGroupById(_index: number, group: DeviceGroup): string {
    return group.id;
  }
}
