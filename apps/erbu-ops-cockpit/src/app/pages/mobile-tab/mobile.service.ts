import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  Observable,
  timer,
  switchMap,
  shareReplay,
  Subject,
  scan,
  map,
  startWith,
  takeUntil,
} from 'rxjs';
import {
  DeviceInstance,
  DeviceStatus,
  E2EPlatform,
} from '@erbu-admin-web/shared/models';

// ---------- DTOs ----------

export interface MobileDeviceInfo extends DeviceInstance {
  serialNumber: string;
  model: string;
  manufacturer: string;
  batteryLevel: number;
  sdkVersion: string;
  ip: string | null;
  connectedVia: 'usb' | 'wifi' | 'cloud';
  appInstalled: boolean;
  appVersion: string | null;
}

export interface AppDeployRequest {
  deviceId: string;
  artifactUrl: string;
  platform: E2EPlatform;
  version: string;
  forceReinstall: boolean;
}

export interface AppDeployResult {
  deviceId: string;
  success: boolean;
  installedVersion: string | null;
  error: string | null;
  durationSeconds: number;
}

export interface ScreenCaptureResult {
  deviceId: string;
  type: 'screenshot' | 'recording';
  url: string;
  size: number;
  capturedAt: string;
  durationSeconds: number | null;
}

export interface MaestroFlow {
  id: string;
  name: string;
  filePath: string;
  platform: E2EPlatform;
  tags: string[];
  estimatedDurationSeconds: number;
  lastRunStatus: MaestroRunStatus | null;
  lastRunAt: string | null;
}

export enum MaestroRunStatus {
  Pending = 'Pending',
  Running = 'Running',
  Passed = 'Passed',
  Failed = 'Failed',
  Cancelled = 'Cancelled',
  Error = 'Error',
}

export interface MaestroRunRequest {
  flowIds: string[];
  deviceId: string;
  tags?: string[];
  env?: Record<string, string>;
  continueOnFailure: boolean;
}

export interface MaestroRunResult {
  id: string;
  flowId: string;
  flowName: string;
  deviceId: string;
  status: MaestroRunStatus;
  totalSteps: number;
  passedSteps: number;
  failedSteps: number;
  durationSeconds: number;
  startedAt: string;
  completedAt: string | null;
  screenshotUrl: string | null;
  videoUrl: string | null;
  errorMessage: string | null;
  output: string;
}

export enum DeviceLogLevel {
  Verbose = 'Verbose',
  Debug = 'Debug',
  Info = 'Info',
  Warn = 'Warn',
  Error = 'Error',
  Fatal = 'Fatal',
}

export interface DeviceLogEntry {
  timestamp: string;
  level: DeviceLogLevel;
  tag: string;
  pid: number;
  message: string;
}

export interface DeviceLogFilter {
  level?: DeviceLogLevel;
  tag?: string;
  search?: string;
  pid?: number;
  since?: string;
}

export interface AdbCommand {
  deviceId: string;
  command: string;
  args: string[];
}

export interface AdbCommandResult {
  deviceId: string;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface MobileKpi {
  connectedDevices: number;
  androidCount: number;
  iosCount: number;
  devicesInUse: number;
  devicesAvailable: number;
  devicesOffline: number;
  devicesInError: number;
  lastMaestroPassRate: number;
  activeRecordings: number;
}

// ---------- Service ----------

const DEVICE_POLL_MS = 5_000;
const API_BASE = '/api/ops/mobile';

@Injectable({ providedIn: 'root' })
export class MobileService {
  private readonly http = inject(HttpClient);

  // ---- Real-time device status (poll every 5s) ----

  readonly devices$: Observable<MobileDeviceInfo[]> = timer(
    0,
    DEVICE_POLL_MS,
  ).pipe(
    switchMap(() => this.http.get<MobileDeviceInfo[]>(`${API_BASE}/devices`)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly kpi$: Observable<MobileKpi> = timer(0, DEVICE_POLL_MS).pipe(
    switchMap(() => this.http.get<MobileKpi>(`${API_BASE}/kpi`)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  // ---- Device management ----

  getDevice(id: string): Observable<MobileDeviceInfo> {
    return this.http.get<MobileDeviceInfo>(
      `${API_BASE}/devices/${encodeURIComponent(id)}`,
    );
  }

  refreshDevice(id: string): Observable<MobileDeviceInfo> {
    return this.http.post<MobileDeviceInfo>(
      `${API_BASE}/devices/${encodeURIComponent(id)}/refresh`,
      null,
    );
  }

  disconnectDevice(id: string): Observable<void> {
    return this.http.post<void>(
      `${API_BASE}/devices/${encodeURIComponent(id)}/disconnect`,
      null,
    );
  }

  connectWifi(ip: string, port = 5555): Observable<MobileDeviceInfo> {
    return this.http.post<MobileDeviceInfo>(
      `${API_BASE}/devices/connect-wifi`,
      { ip, port },
    );
  }

  // ---- App deployment ----

  deployApp(request: AppDeployRequest): Observable<AppDeployResult> {
    return this.http.post<AppDeployResult>(`${API_BASE}/deploy`, request);
  }

  uninstallApp(
    deviceId: string,
    packageName: string,
  ): Observable<AppDeployResult> {
    return this.http.post<AppDeployResult>(`${API_BASE}/deploy/uninstall`, {
      deviceId,
      packageName,
    });
  }

  listInstalledApps(deviceId: string): Observable<string[]> {
    return this.http.get<string[]>(
      `${API_BASE}/devices/${encodeURIComponent(deviceId)}/apps`,
    );
  }

  // ---- Screen capture / recording ----

  takeScreenshot(deviceId: string): Observable<ScreenCaptureResult> {
    return this.http.post<ScreenCaptureResult>(
      `${API_BASE}/devices/${encodeURIComponent(deviceId)}/screenshot`,
      null,
    );
  }

  startRecording(deviceId: string): Observable<{ recordingId: string }> {
    return this.http.post<{ recordingId: string }>(
      `${API_BASE}/devices/${encodeURIComponent(deviceId)}/recording/start`,
      null,
    );
  }

  stopRecording(
    deviceId: string,
    recordingId: string,
  ): Observable<ScreenCaptureResult> {
    return this.http.post<ScreenCaptureResult>(
      `${API_BASE}/devices/${encodeURIComponent(deviceId)}/recording/stop`,
      { recordingId },
    );
  }

  listCaptures(deviceId: string): Observable<ScreenCaptureResult[]> {
    return this.http.get<ScreenCaptureResult[]>(
      `${API_BASE}/devices/${encodeURIComponent(deviceId)}/captures`,
    );
  }

  // ---- Maestro test runner ----

  listFlows(platform?: E2EPlatform): Observable<MaestroFlow[]> {
    let params = new HttpParams();
    if (platform) {
      params = params.set('platform', platform);
    }
    return this.http.get<MaestroFlow[]>(`${API_BASE}/maestro/flows`, {
      params,
    });
  }

  runFlows(request: MaestroRunRequest): Observable<MaestroRunResult[]> {
    return this.http.post<MaestroRunResult[]>(
      `${API_BASE}/maestro/run`,
      request,
    );
  }

  getMaestroRunHistory(
    limit = 50,
  ): Observable<MaestroRunResult[]> {
    return this.http.get<MaestroRunResult[]>(
      `${API_BASE}/maestro/history`,
      { params: { limit } },
    );
  }

  getMaestroRunResult(runId: string): Observable<MaestroRunResult> {
    return this.http.get<MaestroRunResult>(
      `${API_BASE}/maestro/runs/${encodeURIComponent(runId)}`,
    );
  }

  cancelMaestroRun(runId: string): Observable<void> {
    return this.http.post<void>(
      `${API_BASE}/maestro/runs/${encodeURIComponent(runId)}/cancel`,
      null,
    );
  }

  // ---- Device logs ----

  fetchLogs(
    deviceId: string,
    filter?: DeviceLogFilter,
    limit = 500,
  ): Observable<DeviceLogEntry[]> {
    let params = new HttpParams().set('limit', limit);
    if (filter?.level) {
      params = params.set('level', filter.level);
    }
    if (filter?.tag) {
      params = params.set('tag', filter.tag);
    }
    if (filter?.search) {
      params = params.set('search', filter.search);
    }
    if (filter?.pid) {
      params = params.set('pid', filter.pid);
    }
    if (filter?.since) {
      params = params.set('since', filter.since);
    }
    return this.http.get<DeviceLogEntry[]>(
      `${API_BASE}/devices/${encodeURIComponent(deviceId)}/logs`,
      { params },
    );
  }

  clearLogs(deviceId: string): Observable<void> {
    return this.http.delete<void>(
      `${API_BASE}/devices/${encodeURIComponent(deviceId)}/logs`,
    );
  }

  // ---- ADB bridge ----

  executeAdb(command: AdbCommand): Observable<AdbCommandResult> {
    return this.http.post<AdbCommandResult>(`${API_BASE}/adb/exec`, command);
  }

  getAdbDevices(): Observable<string[]> {
    return this.http.get<string[]>(`${API_BASE}/adb/devices`);
  }

  rebootDevice(deviceId: string, mode?: 'bootloader' | 'recovery'): Observable<void> {
    return this.http.post<void>(
      `${API_BASE}/devices/${encodeURIComponent(deviceId)}/reboot`,
      { mode: mode ?? null },
    );
  }

  forwardPort(
    deviceId: string,
    localPort: number,
    remotePort: number,
  ): Observable<void> {
    return this.http.post<void>(
      `${API_BASE}/devices/${encodeURIComponent(deviceId)}/forward`,
      { localPort, remotePort },
    );
  }
}
