import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, timer, switchMap, shareReplay } from 'rxjs';
import { DeviceInstance, DeviceStatus } from '@erbu-admin-web/shared/models';

// ---------- DTOs ----------

export interface DeviceGroup {
  id: string;
  name: string;
  description: string;
  deviceIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface DeviceActionResult {
  deviceId: string;
  action: DeviceActionType;
  success: boolean;
  message: string;
  executedAt: string;
  durationMs: number;
}

export enum DeviceActionType {
  RestartApp = 'RestartApp',
  ClearData = 'ClearData',
  CaptureLogs = 'CaptureLogs',
  AdbShell = 'AdbShell',
  AdbInstall = 'AdbInstall',
  AdbScreenshot = 'AdbScreenshot',
  AdbLogcat = 'AdbLogcat',
}

export interface BatchActionRequest {
  deviceIds: string[];
  action: DeviceActionType;
  parameters?: Record<string, string>;
}

export interface BatchActionResult {
  batchId: string;
  totalDevices: number;
  succeeded: number;
  failed: number;
  results: DeviceActionResult[];
}

export interface AdbCommandRequest {
  deviceId: string;
  command: string;
  timeoutMs?: number;
}

export interface AdbCommandResult {
  deviceId: string;
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

export interface InstancesFilter {
  status?: DeviceStatus[];
  platform?: string;
  search?: string;
  groupId?: string;
  isPhysical?: boolean;
}

export interface InstancesPage {
  items: DeviceInstance[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------- Service ----------

const REFRESH_INTERVAL_MS = 10_000;
const API_BASE = '/api/ops/instances';
const DEVTOOLS_API = '/api/devtools';

@Injectable({ providedIn: 'root' })
export class InstancesService {
  private readonly http = inject(HttpClient);
  private readonly devToolsUrl =
    inject<string>('DEVTOOLS_API_URL' as never, { optional: true }) ??
    'http://localhost:5200';

  // ── Live polling stream ──

  readonly instances$: Observable<DeviceInstance[]> = timer(
    0,
    REFRESH_INTERVAL_MS,
  ).pipe(
    switchMap(() => this.http.get<DeviceInstance[]>(`${API_BASE}`)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  // ── Device CRUD ──

  list(
    filter?: InstancesFilter,
    page = 1,
    pageSize = 100,
  ): Observable<InstancesPage> {
    let params = new HttpParams()
      .set('page', page)
      .set('pageSize', pageSize);

    if (filter?.status?.length) {
      for (const s of filter.status) {
        params = params.append('status', s);
      }
    }
    if (filter?.platform) {
      params = params.set('platform', filter.platform);
    }
    if (filter?.search) {
      params = params.set('search', filter.search);
    }
    if (filter?.groupId) {
      params = params.set('groupId', filter.groupId);
    }
    if (filter?.isPhysical !== undefined) {
      params = params.set('isPhysical', filter.isPhysical);
    }

    return this.http.get<InstancesPage>(API_BASE, { params });
  }

  getById(id: string): Observable<DeviceInstance> {
    return this.http.get<DeviceInstance>(
      `${API_BASE}/${encodeURIComponent(id)}`,
    );
  }

  // ── Device actions ──

  restartApp(deviceId: string): Observable<DeviceActionResult> {
    return this.http.post<DeviceActionResult>(
      `${API_BASE}/${encodeURIComponent(deviceId)}/restart`,
      null,
    );
  }

  clearData(deviceId: string): Observable<DeviceActionResult> {
    return this.http.post<DeviceActionResult>(
      `${API_BASE}/${encodeURIComponent(deviceId)}/clear-data`,
      null,
    );
  }

  captureLogs(deviceId: string): Observable<DeviceActionResult> {
    return this.http.post<DeviceActionResult>(
      `${API_BASE}/${encodeURIComponent(deviceId)}/capture-logs`,
      null,
    );
  }

  // ── Batch operations ──

  batchAction(request: BatchActionRequest): Observable<BatchActionResult> {
    return this.http.post<BatchActionResult>(`${API_BASE}/batch`, request);
  }

  // ── Device groups ──

  listGroups(): Observable<DeviceGroup[]> {
    return this.http.get<DeviceGroup[]>(`${API_BASE}/groups`);
  }

  createGroup(
    name: string,
    description: string,
    deviceIds: string[],
  ): Observable<DeviceGroup> {
    return this.http.post<DeviceGroup>(`${API_BASE}/groups`, {
      name,
      description,
      deviceIds,
    });
  }

  updateGroup(
    groupId: string,
    patch: Partial<Pick<DeviceGroup, 'name' | 'description' | 'deviceIds'>>,
  ): Observable<DeviceGroup> {
    return this.http.patch<DeviceGroup>(
      `${API_BASE}/groups/${encodeURIComponent(groupId)}`,
      patch,
    );
  }

  deleteGroup(groupId: string): Observable<void> {
    return this.http.delete<void>(
      `${API_BASE}/groups/${encodeURIComponent(groupId)}`,
    );
  }

  // ── ADB operations (via DevTools API proxy) ──

  adbShell(request: AdbCommandRequest): Observable<AdbCommandResult> {
    return this.http.post<AdbCommandResult>(
      `${this.devToolsUrl}${DEVTOOLS_API}/adb/shell`,
      request,
    );
  }

  adbInstall(deviceId: string, apkFile: File): Observable<DeviceActionResult> {
    const formData = new FormData();
    formData.append('apk', apkFile, apkFile.name);
    return this.http.post<DeviceActionResult>(
      `${this.devToolsUrl}${DEVTOOLS_API}/adb/${encodeURIComponent(deviceId)}/install`,
      formData,
    );
  }

  adbScreenshot(deviceId: string): Observable<Blob> {
    return this.http.get(
      `${this.devToolsUrl}${DEVTOOLS_API}/adb/${encodeURIComponent(deviceId)}/screenshot`,
      { responseType: 'blob' },
    );
  }

  adbLogcat(
    deviceId: string,
    lines = 500,
  ): Observable<AdbCommandResult> {
    return this.http.get<AdbCommandResult>(
      `${this.devToolsUrl}${DEVTOOLS_API}/adb/${encodeURIComponent(deviceId)}/logcat`,
      { params: { lines } },
    );
  }
}
