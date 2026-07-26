import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  DestroyRef,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { DeviceStatus, E2EPlatform } from '@erbu-admin-web/shared/models';
import {
  MobileService,
  MobileDeviceInfo,
  MobileKpi,
  MaestroFlow,
  MaestroRunResult,
  MaestroRunStatus,
  DeviceLogEntry,
  DeviceLogLevel,
  DeviceLogFilter,
  AdbCommandResult,
  ScreenCaptureResult,
  AppDeployRequest,
} from './mobile.service';

@Component({
  selector: 'app-mobile-tab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatInputModule,
    MatFormFieldModule,
    MatTabsModule,
    MatChipsModule,
    MatMenuModule,
    MatTooltipModule,
    MatBadgeModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatDividerModule,
    MatSlideToggleModule,
  ],
  templateUrl: './mobile-tab.page.html',
  styleUrls: ['./mobile-tab.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileTabPage implements OnInit, OnDestroy {
  private readonly mobile = inject(MobileService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly destroyRef = inject(DestroyRef);

  // ---- State signals ----
  readonly loading = signal(true);
  readonly devices = signal<MobileDeviceInfo[]>([]);
  readonly kpi = signal<MobileKpi | null>(null);
  readonly selectedDevice = signal<MobileDeviceInfo | null>(null);

  // Maestro
  readonly maestroFlows = signal<MaestroFlow[]>([]);
  readonly maestroResults = signal<MaestroRunResult[]>([]);
  readonly maestroRunning = signal(false);
  readonly selectedFlowIds = signal<Set<string>>(new Set());

  // Logs
  readonly logs = signal<DeviceLogEntry[]>([]);
  readonly logFilter = signal<DeviceLogFilter>({});
  readonly logLoading = signal(false);
  readonly logAutoScroll = signal(true);

  // ADB
  readonly adbCommand = signal('');
  readonly adbHistory = signal<AdbCommandResult[]>([]);
  readonly adbRunning = signal(false);

  // Capture
  readonly captures = signal<ScreenCaptureResult[]>([]);
  readonly recording = signal(false);
  readonly recordingId = signal<string | null>(null);

  // Deploy
  readonly deploying = signal(false);
  readonly deployArtifactUrl = signal('');
  readonly deployForceReinstall = signal(false);

  // Active sub-tab
  readonly activeSubTab = signal(0);

  // ---- Computed ----
  readonly deviceColumns = [
    'status',
    'name',
    'platform',
    'model',
    'osVersion',
    'battery',
    'connection',
    'appVersion',
    'actions',
  ] as const;

  readonly maestroColumns = [
    'name',
    'platform',
    'tags',
    'estimatedDuration',
    'lastRunStatus',
    'lastRunAt',
    'select',
  ] as const;

  readonly maestroResultColumns = [
    'flowName',
    'status',
    'passedSteps',
    'duration',
    'startedAt',
    'actions',
  ] as const;

  readonly logLevels = Object.values(DeviceLogLevel);
  readonly platforms = Object.values(E2EPlatform);

  readonly connectedCount = computed(
    () => this.devices().filter((d) => d.status !== DeviceStatus.Offline).length,
  );

  readonly androidDevices = computed(
    () => this.devices().filter((d) => d.platform === E2EPlatform.Android),
  );

  readonly iosDevices = computed(
    () => this.devices().filter((d) => d.platform === E2EPlatform.iOS),
  );

  readonly filteredLogs = computed(() => {
    const filter = this.logFilter();
    let entries = this.logs();
    if (filter.level) {
      const levels = Object.values(DeviceLogLevel);
      const minIdx = levels.indexOf(filter.level);
      entries = entries.filter((e) => levels.indexOf(e.level) >= minIdx);
    }
    if (filter.tag) {
      const tag = filter.tag.toLowerCase();
      entries = entries.filter((e) => e.tag.toLowerCase().includes(tag));
    }
    if (filter.search) {
      const search = filter.search.toLowerCase();
      entries = entries.filter((e) => e.message.toLowerCase().includes(search));
    }
    if (filter.pid) {
      entries = entries.filter((e) => e.pid === filter.pid);
    }
    return entries;
  });

  readonly selectedFlowCount = computed(() => this.selectedFlowIds().size);

  readonly hasSelectedDevice = computed(() => this.selectedDevice() !== null);

  // ---- Lifecycle ----

  ngOnInit(): void {
    this.mobile.devices$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (devices) => {
          this.devices.set(devices);
          this.loading.set(false);

          // Keep selectedDevice in sync if it is still in the list
          const selected = this.selectedDevice();
          if (selected) {
            const updated = devices.find((d) => d.id === selected.id);
            if (updated) {
              this.selectedDevice.set(updated);
            }
          }
        },
        error: () => {
          this.loading.set(false);
          this.toast('Failed to load devices', true);
        },
      });

    this.mobile.kpi$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((kpi) => this.kpi.set(kpi));

    this.loadMaestroFlows();
    this.loadMaestroHistory();
  }

  ngOnDestroy(): void {
    // DestroyRef handles subscription cleanup
  }

  // ---- Device actions ----

  selectDevice(device: MobileDeviceInfo): void {
    this.selectedDevice.set(device);
    this.loadLogs();
    this.loadCaptures();
  }

  deselectDevice(): void {
    this.selectedDevice.set(null);
    this.logs.set([]);
    this.captures.set([]);
  }

  refreshDevice(device: MobileDeviceInfo): void {
    this.mobile
      .refreshDevice(device.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.devices.update((list) =>
            list.map((d) => (d.id === updated.id ? updated : d)),
          );
          if (this.selectedDevice()?.id === updated.id) {
            this.selectedDevice.set(updated);
          }
          this.toast(`Refreshed ${updated.name}`);
        },
        error: () => this.toast('Refresh failed', true),
      });
  }

  disconnectDevice(device: MobileDeviceInfo): void {
    this.mobile
      .disconnectDevice(device.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.devices.update((list) => list.filter((d) => d.id !== device.id));
          if (this.selectedDevice()?.id === device.id) {
            this.deselectDevice();
          }
          this.toast(`Disconnected ${device.name}`);
        },
        error: () => this.toast('Disconnect failed', true),
      });
  }

  rebootDevice(device: MobileDeviceInfo, mode?: 'bootloader' | 'recovery'): void {
    this.mobile
      .rebootDevice(device.id, mode)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.toast(`Rebooting ${device.name}...`),
        error: () => this.toast('Reboot failed', true),
      });
  }

  // ---- App deployment ----

  deployToDevice(): void {
    const device = this.selectedDevice();
    if (!device || !this.deployArtifactUrl()) return;

    this.deploying.set(true);
    const request: AppDeployRequest = {
      deviceId: device.id,
      artifactUrl: this.deployArtifactUrl(),
      platform: device.platform,
      version: 'latest',
      forceReinstall: this.deployForceReinstall(),
    };

    this.mobile
      .deployApp(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.deploying.set(false);
          if (result.success) {
            this.toast(
              `Deployed v${result.installedVersion} to ${device.name}`,
            );
            this.deployArtifactUrl.set('');
          } else {
            this.toast(`Deploy failed: ${result.error}`, true);
          }
        },
        error: () => {
          this.deploying.set(false);
          this.toast('Deployment request failed', true);
        },
      });
  }

  uninstallApp(device: MobileDeviceInfo, packageName: string): void {
    this.mobile
      .uninstallApp(device.id, packageName)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.toast(`Uninstalled ${packageName}`),
        error: () => this.toast('Uninstall failed', true),
      });
  }

  // ---- Screen capture ----

  takeScreenshot(): void {
    const device = this.selectedDevice();
    if (!device) return;

    this.mobile
      .takeScreenshot(device.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (capture) => {
          this.captures.update((list) => [capture, ...list]);
          this.toast('Screenshot captured');
        },
        error: () => this.toast('Screenshot failed', true),
      });
  }

  toggleRecording(): void {
    const device = this.selectedDevice();
    if (!device) return;

    if (this.recording()) {
      const recId = this.recordingId();
      if (!recId) return;

      this.mobile
        .stopRecording(device.id, recId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (capture) => {
            this.recording.set(false);
            this.recordingId.set(null);
            this.captures.update((list) => [capture, ...list]);
            this.toast('Recording saved');
          },
          error: () => this.toast('Failed to stop recording', true),
        });
    } else {
      this.mobile
        .startRecording(device.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (res) => {
            this.recording.set(true);
            this.recordingId.set(res.recordingId);
            this.toast('Recording started');
          },
          error: () => this.toast('Failed to start recording', true),
        });
    }
  }

  private loadCaptures(): void {
    const device = this.selectedDevice();
    if (!device) return;
    this.mobile
      .listCaptures(device.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((captures) => this.captures.set(captures));
  }

  // ---- Maestro test runner ----

  private loadMaestroFlows(): void {
    this.mobile
      .listFlows()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((flows) => this.maestroFlows.set(flows));
  }

  private loadMaestroHistory(): void {
    this.mobile
      .getMaestroRunHistory()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((results) => this.maestroResults.set(results));
  }

  toggleFlowSelection(flowId: string): void {
    this.selectedFlowIds.update((set) => {
      const next = new Set(set);
      if (next.has(flowId)) {
        next.delete(flowId);
      } else {
        next.add(flowId);
      }
      return next;
    });
  }

  selectAllFlows(): void {
    this.selectedFlowIds.set(new Set(this.maestroFlows().map((f) => f.id)));
  }

  deselectAllFlows(): void {
    this.selectedFlowIds.set(new Set());
  }

  runSelectedFlows(): void {
    const device = this.selectedDevice();
    if (!device || this.selectedFlowIds().size === 0) return;

    this.maestroRunning.set(true);
    this.mobile
      .runFlows({
        flowIds: [...this.selectedFlowIds()],
        deviceId: device.id,
        continueOnFailure: true,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (results) => {
          this.maestroRunning.set(false);
          this.maestroResults.update((list) => [...results, ...list]);
          const passed = results.filter(
            (r) => r.status === MaestroRunStatus.Passed,
          ).length;
          this.toast(
            `Maestro: ${passed}/${results.length} flows passed`,
          );
        },
        error: () => {
          this.maestroRunning.set(false);
          this.toast('Maestro run failed', true);
        },
      });
  }

  cancelMaestroRun(runId: string): void {
    this.mobile
      .cancelMaestroRun(runId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.maestroResults.update((list) =>
            list.map((r) =>
              r.id === runId
                ? { ...r, status: MaestroRunStatus.Cancelled }
                : r,
            ),
          );
          this.toast('Run cancelled');
        },
        error: () => this.toast('Cancel failed', true),
      });
  }

  // ---- Device logs ----

  private loadLogs(): void {
    const device = this.selectedDevice();
    if (!device) return;

    this.logLoading.set(true);
    this.mobile
      .fetchLogs(device.id, this.logFilter())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (entries) => {
          this.logs.set(entries);
          this.logLoading.set(false);
        },
        error: () => {
          this.logLoading.set(false);
          this.toast('Failed to load logs', true);
        },
      });
  }

  refreshLogs(): void {
    this.loadLogs();
  }

  clearLogs(): void {
    const device = this.selectedDevice();
    if (!device) return;

    this.mobile
      .clearLogs(device.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.logs.set([]);
          this.toast('Logs cleared');
        },
        error: () => this.toast('Failed to clear logs', true),
      });
  }

  updateLogFilter(partial: Partial<DeviceLogFilter>): void {
    this.logFilter.update((f) => ({ ...f, ...partial }));
    this.loadLogs();
  }

  // ---- ADB bridge ----

  executeAdb(): void {
    const device = this.selectedDevice();
    const cmdStr = this.adbCommand().trim();
    if (!device || !cmdStr) return;

    const parts = cmdStr.split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);

    this.adbRunning.set(true);
    this.mobile
      .executeAdb({ deviceId: device.id, command, args })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.adbRunning.set(false);
          this.adbHistory.update((list) => [result, ...list]);
          this.adbCommand.set('');
        },
        error: () => {
          this.adbRunning.set(false);
          this.toast('ADB command failed', true);
        },
      });
  }

  clearAdbHistory(): void {
    this.adbHistory.set([]);
  }

  // ---- Helpers ----

  getStatusIcon(status: DeviceStatus): string {
    switch (status) {
      case DeviceStatus.Available:
        return 'check_circle';
      case DeviceStatus.InUse:
        return 'play_circle';
      case DeviceStatus.Offline:
        return 'cloud_off';
      case DeviceStatus.Maintenance:
        return 'build';
      case DeviceStatus.Error:
        return 'error';
      default:
        return 'help';
    }
  }

  getStatusClass(status: DeviceStatus): string {
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

  getPlatformIcon(platform: E2EPlatform): string {
    switch (platform) {
      case E2EPlatform.Android:
        return 'android';
      case E2EPlatform.iOS:
        return 'phone_iphone';
      default:
        return 'devices';
    }
  }

  getLogLevelClass(level: DeviceLogLevel): string {
    switch (level) {
      case DeviceLogLevel.Verbose:
        return 'log-verbose';
      case DeviceLogLevel.Debug:
        return 'log-debug';
      case DeviceLogLevel.Info:
        return 'log-info';
      case DeviceLogLevel.Warn:
        return 'log-warn';
      case DeviceLogLevel.Error:
        return 'log-error';
      case DeviceLogLevel.Fatal:
        return 'log-fatal';
      default:
        return '';
    }
  }

  getMaestroStatusIcon(status: MaestroRunStatus | null): string {
    switch (status) {
      case MaestroRunStatus.Passed:
        return 'check_circle';
      case MaestroRunStatus.Failed:
        return 'cancel';
      case MaestroRunStatus.Running:
        return 'sync';
      case MaestroRunStatus.Pending:
        return 'schedule';
      case MaestroRunStatus.Cancelled:
        return 'block';
      case MaestroRunStatus.Error:
        return 'error';
      default:
        return 'help_outline';
    }
  }

  getMaestroStatusClass(status: MaestroRunStatus | null): string {
    switch (status) {
      case MaestroRunStatus.Passed:
        return 'maestro-passed';
      case MaestroRunStatus.Failed:
        return 'maestro-failed';
      case MaestroRunStatus.Running:
        return 'maestro-running';
      case MaestroRunStatus.Pending:
        return 'maestro-pending';
      case MaestroRunStatus.Cancelled:
        return 'maestro-cancelled';
      case MaestroRunStatus.Error:
        return 'maestro-error';
      default:
        return '';
    }
  }

  getBatteryIcon(level: number): string {
    if (level > 80) return 'battery_full';
    if (level > 50) return 'battery_5_bar';
    if (level > 20) return 'battery_3_bar';
    return 'battery_1_bar';
  }

  getBatteryClass(level: number): string {
    if (level > 50) return 'battery-good';
    if (level > 20) return 'battery-warn';
    return 'battery-critical';
  }

  trackByDeviceId(_: number, device: MobileDeviceInfo): string {
    return device.id;
  }

  trackByFlowId(_: number, flow: MaestroFlow): string {
    return flow.id;
  }

  trackByResultId(_: number, result: MaestroRunResult): string {
    return result.id;
  }

  private toast(message: string, isError = false): void {
    this.snackBar.open(message, 'Dismiss', {
      duration: isError ? 5000 : 3000,
      panelClass: isError ? 'snack-error' : 'snack-success',
    });
  }
}
