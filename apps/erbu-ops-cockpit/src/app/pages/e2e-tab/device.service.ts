import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import {
  DeviceInstance,
  DeviceStatus,
  E2EPlatform,
} from '@erbu-admin-web/shared/models';
import {
  DevToolsService,
  DeviceInfo,
} from '@erbu-admin-web/shared/data-access';

// ---------- DTOs ----------

export interface AdbDevice {
  serial: string;
  model: string;
  state: 'device' | 'offline' | 'unauthorized' | 'no permissions';
  transportId: string;
  product: string;
  androidVersion: string;
}

export interface ApkInstallRequest {
  deviceId: string;
  apkUrl: string;
  packageName: string;
  reinstall: boolean;
}

export interface ApkInstallResult {
  success: boolean;
  deviceId: string;
  packageName: string;
  versionInstalled: string;
  durationMs: number;
  error: string | null;
}

// ---------- Service ----------

const API_BASE = '/api/ops/e2e/devices';

@Injectable({ providedIn: 'root' })
export class DeviceService {
  private readonly http = inject(HttpClient);
  private readonly devTools = inject(DevToolsService);

  /** Scan for connected devices via DevTools API proxy. */
  scanDevices(): Observable<DeviceInstance[]> {
    return this.devTools.scanDevices().pipe(
      map((infos: DeviceInfo[]) =>
        infos.map((d) => this.mapDeviceInfoToInstance(d)),
      ),
    );
  }

  /** Get detailed info for a specific device. */
  getDeviceInfo(deviceId: string): Observable<DeviceInstance> {
    return this.http.get<DeviceInstance>(
      `${API_BASE}/${encodeURIComponent(deviceId)}`,
    );
  }

  /** List ADB-connected Android devices via DevTools SSH proxy. */
  listAdbDevices(): Observable<AdbDevice[]> {
    return this.devTools.sshExec('adb devices -l').pipe(
      map((result) => this.parseAdbDevicesList(result.stdout)),
    );
  }

  /** Install an APK on a device via DevTools API proxy. */
  installApk(request: ApkInstallRequest): Observable<ApkInstallResult> {
    return this.http.post<ApkInstallResult>(`${API_BASE}/install-apk`, request);
  }

  /** Reboot a device. */
  rebootDevice(deviceId: string): Observable<void> {
    return this.http.post<void>(
      `${API_BASE}/${encodeURIComponent(deviceId)}/reboot`,
      null,
    );
  }

  /** Get real-time device properties (battery, CPU, memory). */
  getDeviceProperties(
    deviceId: string,
  ): Observable<Record<string, string>> {
    return this.http.get<Record<string, string>>(
      `${API_BASE}/${encodeURIComponent(deviceId)}/properties`,
    );
  }

  // ── Private helpers ────────────────────────────────────────

  private mapDeviceInfoToInstance(info: DeviceInfo): DeviceInstance {
    return {
      id: info.id,
      name: info.name,
      platform: this.inferPlatform(info.type),
      osVersion: info.metadata['osVersion'] ?? 'Unknown',
      status: this.mapStatus(info.status),
      isPhysical: info.type === 'physical',
      resolution: info.metadata['resolution'] ?? 'Unknown',
      assignedToRunId: null,
      lastUsedAt: info.lastSeenAt,
      provisionedAt: info.lastSeenAt,
      tags: info.metadata['tags']?.split(',') ?? [],
    };
  }

  private inferPlatform(type: string): E2EPlatform {
    const lower = type.toLowerCase();
    if (lower.includes('ios') || lower.includes('iphone') || lower.includes('ipad')) {
      return E2EPlatform.iOS;
    }
    if (lower.includes('web') || lower.includes('browser')) {
      return E2EPlatform.Web;
    }
    return E2EPlatform.Android;
  }

  private mapStatus(status: string): DeviceStatus {
    const statusMap: Record<string, DeviceStatus> = {
      online: DeviceStatus.Available,
      available: DeviceStatus.Available,
      busy: DeviceStatus.InUse,
      in_use: DeviceStatus.InUse,
      offline: DeviceStatus.Offline,
      maintenance: DeviceStatus.Maintenance,
      error: DeviceStatus.Error,
    };
    return statusMap[status.toLowerCase()] ?? DeviceStatus.Offline;
  }

  private parseAdbDevicesList(stdout: string): AdbDevice[] {
    const lines = stdout.split('\n').filter((l) => l.trim().length > 0);
    const devices: AdbDevice[] = [];

    for (const line of lines) {
      // Skip the header line
      if (line.startsWith('List of devices')) continue;

      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) continue;

      const serial = parts[0];
      const state = parts[1] as AdbDevice['state'];
      const props = new Map<string, string>();

      for (let i = 2; i < parts.length; i++) {
        const [key, value] = parts[i].split(':');
        if (key && value) {
          props.set(key, value);
        }
      }

      devices.push({
        serial,
        model: props.get('model') ?? 'Unknown',
        state,
        transportId: props.get('transport_id') ?? '',
        product: props.get('product') ?? '',
        androidVersion: props.get('device') ?? '',
      });
    }

    return devices;
  }
}
