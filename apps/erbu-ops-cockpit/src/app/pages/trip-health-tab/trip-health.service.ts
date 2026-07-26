import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timer, switchMap, shareReplay, startWith } from 'rxjs';
import { TripHealth, TripStatus } from '@erbu-admin-web/shared/models';

// ---------- DTOs ----------

export interface TripHealthKpi {
  activeTrips: number;
  activeTripsChange: number;
  failedTrips: number;
  failedTripsChange: number;
  avgDurationMinutes: number;
  avgDurationChange: number;
  slaCompliancePercent: number;
  slaComplianceChange: number;
}

export interface TripHealthRow {
  id: string;
  tripNumber: string;
  riderName: string;
  driverName: string;
  status: TripStatus;
  pickupAddress: string;
  dropoffAddress: string;
  requestedAt: string;
  durationMinutes: number | null;
  fareAmount: number;
  currency: string;
  healthScore: number;
}

export interface ServiceStatus {
  name: string;
  status: 'Healthy' | 'Degraded' | 'Down';
  latencyMs: number;
  uptime: number;
  lastCheckedAt: string;
  errorCount: number;
}

export interface TripVolumePoint {
  timestamp: string;
  tripCount: number;
  failureCount: number;
  failureRate: number;
}

export interface TripHealthDashboard {
  kpi: TripHealthKpi;
  trips: TripHealthRow[];
  services: ServiceStatus[];
  volumeHistory: TripVolumePoint[];
  health: TripHealth;
}

// ---------- Service ----------

const REFRESH_INTERVAL_MS = 15_000;
const API_BASE = '/api/ops/trip-health';

@Injectable({ providedIn: 'root' })
export class TripHealthService {
  private readonly http = inject(HttpClient);

  /**
   * Polls the trip-health dashboard endpoint every 15 seconds.
   * Subscribers share a single HTTP stream (shareReplay).
   */
  readonly dashboard$: Observable<TripHealthDashboard> = timer(
    0,
    REFRESH_INTERVAL_MS,
  ).pipe(
    switchMap(() => this.http.get<TripHealthDashboard>(`${API_BASE}/dashboard`)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** One-shot fetch for the full dashboard. */
  fetchDashboard(): Observable<TripHealthDashboard> {
    return this.http.get<TripHealthDashboard>(`${API_BASE}/dashboard`);
  }

  /** Fetch volume history for custom date range. */
  fetchVolumeHistory(
    from: string,
    to: string,
  ): Observable<TripVolumePoint[]> {
    return this.http.get<TripVolumePoint[]>(`${API_BASE}/volume`, {
      params: { from, to },
    });
  }

  /** Fetch service statuses on demand. */
  fetchServiceStatuses(): Observable<ServiceStatus[]> {
    return this.http.get<ServiceStatus[]>(`${API_BASE}/services`);
  }
}
