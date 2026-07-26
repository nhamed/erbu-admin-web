import { Injectable, signal, computed } from '@angular/core';
import {
  DriverPosition,
  RiderPosition,
  Trip,
  SurgeZone,
  GeoFence,
} from '@erbu-admin-web/shared/models';

export interface MapAlert {
  id: string;
  type: 'fraud' | 'infra' | 'surge' | 'geofence' | 'trip';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  lat: number | null;
  lng: number | null;
  timestamp: string;
  dismissed: boolean;
}

@Injectable({ providedIn: 'root' })
export class MapStateService {
  private readonly _drivers = signal<Map<string, DriverPosition>>(new Map());
  private readonly _riders = signal<Map<string, RiderPosition>>(new Map());
  private readonly _trips = signal<Map<string, Trip>>(new Map());
  private readonly _surgeZones = signal<Map<string, SurgeZone>>(new Map());
  private readonly _geoFences = signal<Map<string, GeoFence>>(new Map());
  private readonly _alerts = signal<MapAlert[]>([]);

  private pendingDriverUpdates: DriverPosition[] = [];
  private pendingRiderUpdates: RiderPosition[] = [];
  private pendingTripUpdates: Trip[] = [];
  private rafId: number | null = null;

  readonly drivers = computed(() => Array.from(this._drivers().values()));
  readonly riders = computed(() => Array.from(this._riders().values()));
  readonly trips = computed(() => Array.from(this._trips().values()));
  readonly surgeZones = computed(() => Array.from(this._surgeZones().values()));
  readonly geoFences = computed(() => Array.from(this._geoFences().values()));
  readonly alerts = this._alerts.asReadonly();

  readonly activeAlerts = computed(() => this._alerts().filter((a) => !a.dismissed));
  readonly criticalAlerts = computed(
    () => this._alerts().filter((a) => a.severity === 'critical' && !a.dismissed),
  );

  readonly driverCount = computed(() => this._drivers().size);
  readonly riderCount = computed(() => this._riders().size);
  readonly activeTripCount = computed(
    () =>
      Array.from(this._trips().values()).filter(
        (t) =>
          t.status !== 'Completed' &&
          t.status !== 'CancelledByRider' &&
          t.status !== 'CancelledByDriver' &&
          t.status !== 'CancelledBySystem',
      ).length,
  );
  readonly activeSurgeZoneCount = computed(
    () => Array.from(this._surgeZones().values()).filter((z) => z.isActive).length,
  );

  updatePositions(
    driverUpdates: DriverPosition[],
    riderUpdates: RiderPosition[] = [],
  ): void {
    this.pendingDriverUpdates.push(...driverUpdates);
    this.pendingRiderUpdates.push(...riderUpdates);
    this.scheduleFlush();
  }

  updateTrips(tripUpdates: Trip[]): void {
    this.pendingTripUpdates.push(...tripUpdates);
    this.scheduleFlush();
  }

  updateSurgeZones(zones: SurgeZone[]): void {
    this._surgeZones.update((current) => {
      const next = new Map(current);
      for (const zone of zones) {
        next.set(zone.id, zone);
      }
      return next;
    });
  }

  updateGeoFences(fences: GeoFence[]): void {
    this._geoFences.update((current) => {
      const next = new Map(current);
      for (const fence of fences) {
        next.set(fence.id, fence);
      }
      return next;
    });
  }

  addAlert(alert: MapAlert): void {
    this._alerts.update((current) => [alert, ...current].slice(0, 500));
  }

  dismissAlert(alertId: string): void {
    this._alerts.update((current) =>
      current.map((a) => (a.id === alertId ? { ...a, dismissed: true } : a)),
    );
  }

  clearDismissedAlerts(): void {
    this._alerts.update((current) => current.filter((a) => !a.dismissed));
  }

  removeDriver(driverId: string): void {
    this._drivers.update((current) => {
      const next = new Map(current);
      next.delete(driverId);
      return next;
    });
  }

  removeTrip(tripId: string): void {
    this._trips.update((current) => {
      const next = new Map(current);
      next.delete(tripId);
      return next;
    });
  }

  removeSurgeZone(zoneId: string): void {
    this._surgeZones.update((current) => {
      const next = new Map(current);
      next.delete(zoneId);
      return next;
    });
  }

  clearAll(): void {
    this._drivers.set(new Map());
    this._riders.set(new Map());
    this._trips.set(new Map());
    this._surgeZones.set(new Map());
    this._geoFences.set(new Map());
    this._alerts.set([]);
    this.pendingDriverUpdates = [];
    this.pendingRiderUpdates = [];
    this.pendingTripUpdates = [];

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private scheduleFlush(): void {
    if (this.rafId !== null) {
      return;
    }

    this.rafId = requestAnimationFrame(() => {
      this.flush();
      this.rafId = null;
    });
  }

  private flush(): void {
    if (this.pendingDriverUpdates.length > 0) {
      const updates = this.pendingDriverUpdates;
      this.pendingDriverUpdates = [];

      this._drivers.update((current) => {
        const next = new Map(current);
        for (const pos of updates) {
          next.set(pos.driverId, pos);
        }
        return next;
      });
    }

    if (this.pendingRiderUpdates.length > 0) {
      const updates = this.pendingRiderUpdates;
      this.pendingRiderUpdates = [];

      this._riders.update((current) => {
        const next = new Map(current);
        for (const pos of updates) {
          next.set(pos.riderId, pos);
        }
        return next;
      });
    }

    if (this.pendingTripUpdates.length > 0) {
      const updates = this.pendingTripUpdates;
      this.pendingTripUpdates = [];

      this._trips.update((current) => {
        const next = new Map(current);
        for (const trip of updates) {
          next.set(trip.id, trip);
        }
        return next;
      });
    }
  }
}
