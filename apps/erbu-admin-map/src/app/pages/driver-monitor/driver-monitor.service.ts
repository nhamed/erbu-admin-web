import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  Observable,
  timer,
  switchMap,
  shareReplay,
  catchError,
  throwError,
  tap,
  finalize,
} from 'rxjs';

// ---------- DTOs ----------

export type DriverStatus = 'Online' | 'Offline' | 'OnTrip' | 'Idle' | 'Suspended';
export type GpsQuality = 'Excellent' | 'Good' | 'Poor' | 'NoSignal';
export type AlertSeverity = 'Info' | 'Warning' | 'Critical';

export interface DriverPosition {
  driverId: string;
  driverName: string;
  status: DriverStatus;
  latitude: number;
  longitude: number;
  heading: number;
  speed: number;
  gpsQuality: GpsQuality;
  lastUpdatedAt: string;
  currentTripId: string | null;
  vehiclePlate: string;
  zone: string;
}

export interface DriverMonitorKpi {
  totalOnline: number;
  totalOffline: number;
  totalOnTrip: number;
  totalIdle: number;
  avgGpsAccuracy: number;
  avgSpeedKmh: number;
}

export interface DriverAlert {
  id: string;
  driverId: string;
  driverName: string;
  severity: AlertSeverity;
  message: string;
  createdAt: string;
  acknowledged: boolean;
  zone: string;
}

export interface DriverMonitorDashboard {
  kpi: DriverMonitorKpi;
  drivers: DriverPosition[];
  alerts: DriverAlert[];
  zones: string[];
}

export interface DriverListResponse {
  items: DriverPosition[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------- Service ----------

const REFRESH_INTERVAL_MS = 10_000;
const API_BASE = '/api/ops/driver-monitor';

@Injectable({ providedIn: 'root' })
export class DriverMonitorService {
  private readonly http = inject(HttpClient);

  // ---------- state signals ----------
  readonly drivers = signal<DriverPosition[]>([]);
  readonly alerts = signal<DriverAlert[]>([]);
  readonly kpi = signal<DriverMonitorKpi>({
    totalOnline: 0,
    totalOffline: 0,
    totalOnTrip: 0,
    totalIdle: 0,
    avgGpsAccuracy: 0,
    avgSpeedKmh: 0,
  });
  readonly zones = signal<string[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedZone = signal<string | null>(null);
  readonly selectedStatus = signal<DriverStatus | null>(null);

  // ---------- computed ----------
  readonly onlineCount = computed(() => this.kpi().totalOnline);
  readonly offlineCount = computed(() => this.kpi().totalOffline);
  readonly onTripCount = computed(() => this.kpi().totalOnTrip);

  readonly filteredDrivers = computed(() => {
    let result = this.drivers();
    const zone = this.selectedZone();
    const status = this.selectedStatus();
    if (zone) {
      result = result.filter((d) => d.zone === zone);
    }
    if (status) {
      result = result.filter((d) => d.status === status);
    }
    return result;
  });

  readonly criticalAlerts = computed(
    () => this.alerts().filter((a) => a.severity === 'Critical' && !a.acknowledged),
  );

  // ---------- polling ----------
  readonly dashboard$: Observable<DriverMonitorDashboard> = timer(
    0,
    REFRESH_INTERVAL_MS,
  ).pipe(
    switchMap(() => this.http.get<DriverMonitorDashboard>(`${API_BASE}/dashboard`)),
    tap((d) => this.applyDashboard(d)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  // ---------- commands ----------
  loadDashboard(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http
      .get<DriverMonitorDashboard>(`${API_BASE}/dashboard`)
      .pipe(
        tap((d) => this.applyDashboard(d)),
        catchError((err) => {
          this.error.set('Failed to load driver monitor data.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  loadDrivers(
    page = 1,
    pageSize = 50,
    zone?: string,
    status?: DriverStatus,
  ): Observable<DriverListResponse> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (zone) params = params.set('zone', zone);
    if (status) params = params.set('status', status);

    return this.http.get<DriverListResponse>(`${API_BASE}/drivers`, { params }).pipe(
      tap((response) => this.drivers.set(response.items)),
      catchError((err) => {
        this.error.set('Failed to load drivers.');
        return throwError(() => err);
      }),
    );
  }

  acknowledgeAlert(alertId: string): Observable<void> {
    return this.http.post<void>(`${API_BASE}/alerts/${alertId}/acknowledge`, {}).pipe(
      tap(() => {
        this.alerts.update((list) =>
          list.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a)),
        );
      }),
      catchError((err) => {
        this.error.set('Failed to acknowledge alert.');
        return throwError(() => err);
      }),
    );
  }

  setZoneFilter(zone: string | null): void {
    this.selectedZone.set(zone);
  }

  setStatusFilter(status: DriverStatus | null): void {
    this.selectedStatus.set(status);
  }

  clearError(): void {
    this.error.set(null);
  }

  // ---------- private ----------
  private applyDashboard(d: DriverMonitorDashboard): void {
    this.kpi.set(d.kpi);
    this.drivers.set(d.drivers);
    this.alerts.set(d.alerts);
    this.zones.set(d.zones);
    this.error.set(null);
  }
}
