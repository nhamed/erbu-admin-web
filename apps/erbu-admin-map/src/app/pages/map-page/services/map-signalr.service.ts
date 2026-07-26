import { Injectable, inject, OnDestroy, signal } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { HubConnectionState } from '@microsoft/signalr';
import {
  PositionUpdate,
  PositionEntityType,
  TripUpdate,
  FraudAlert,
  InfraAlert,
  SurgeZone,
  GeoFence,
  HubEventType,
} from '@erbu-admin-web/shared/models';
import { SignalRService } from '@erbu-admin-web/shared/data-access';
import { MapStateService, MapAlert } from '@erbu-admin-web/shared/data-access';
import { Environment } from '@erbu-admin-web/shared/data-access';

/** Hub path for the secure real-time channel */
const SECURE_HUB = '/hubs/secure';

/**
 * MapSignalRService
 *
 * Connects to the secure SignalR hub and pipes position, trip, fraud, and
 * infrastructure events through MapStateService. Position updates are
 * automatically batched via MapStateService's requestAnimationFrame flush.
 */
@Injectable()
export class MapSignalRService implements OnDestroy {
  private readonly signalR = inject(SignalRService);
  private readonly mapState = inject(MapStateService);
  private readonly environment = inject<Environment>('ENVIRONMENT' as never);
  private readonly destroy$ = new Subject<void>();

  private readonly _connectionState = signal<HubConnectionState>(
    HubConnectionState.Disconnected,
  );
  readonly connectionState = this._connectionState.asReadonly();

  private readonly _lastError = signal<string | null>(null);
  readonly lastError = this._lastError.asReadonly();

  /**
   * Establish connection to /hubs/secure and register all event handlers.
   * Safe to call multiple times -- re-entrant guard in SignalRService.
   */
  async connect(): Promise<void> {
    const hubPath = this.environment.signalrHubs.secure;

    try {
      await this.signalR.connectHub(hubPath);
      this._connectionState.set(HubConnectionState.Connected);
      this._lastError.set(null);
    } catch (err) {
      this._connectionState.set(HubConnectionState.Disconnected);
      this._lastError.set(
        err instanceof Error ? err.message : 'Failed to connect to hub',
      );
      return;
    }

    // Track connection state changes
    this.signalR
      .onConnectionState(hubPath)
      .pipe(takeUntil(this.destroy$))
      .subscribe((state) => this._connectionState.set(state));

    // Register handlers
    this.registerHandlers(hubPath);

    // Subscribe to event streams
    this.subscribePositionUpdates();
    this.subscribeTripUpdates();
    this.subscribeFraudAlerts();
    this.subscribeInfraAlerts();
    this.subscribeSurgeUpdates();
    this.subscribeGeofenceUpdates();
  }

  async disconnect(): Promise<void> {
    await this.signalR.disconnectHub(this.environment.signalrHubs.secure);
    this._connectionState.set(HubConnectionState.Disconnected);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.disconnect();
  }

  // ------------------------------------------------------------------
  // Private registration
  // ------------------------------------------------------------------

  private registerHandlers(hubPath: string): void {
    const methods = [
      'ReceivePositionUpdate',
      'ReceivePositionBatch',
      'ReceiveTripUpdate',
      'ReceiveFraudAlert',
      'ReceiveInfraAlert',
      'ReceiveSurgeUpdate',
      'ReceiveGeofenceUpdate',
    ];

    for (const method of methods) {
      this.signalR.registerHandler(hubPath, method);
    }
  }

  // ------------------------------------------------------------------
  // Subscriptions
  // ------------------------------------------------------------------

  private subscribePositionUpdates(): void {
    // Single position
    this.signalR
      .on<PositionUpdate>('ReceivePositionUpdate')
      .pipe(takeUntil(this.destroy$))
      .subscribe((pos) => this.applyPositionUpdate(pos));

    // Batched positions
    this.signalR
      .on<PositionUpdate[]>('ReceivePositionBatch')
      .pipe(takeUntil(this.destroy$))
      .subscribe((batch) => {
        for (const pos of batch) {
          this.applyPositionUpdate(pos);
        }
      });
  }

  private subscribeTripUpdates(): void {
    this.signalR
      .on<TripUpdate>('ReceiveTripUpdate')
      .pipe(takeUntil(this.destroy$))
      .subscribe((update) => {
        // Trip updates are merged via MapStateService.updateTrips
        this.mapState.updateTrips([
          {
            id: update.tripId,
            riderId: update.riderId,
            driverId: update.driverId,
            status: update.newStatus as never,
            pickupLat: update.lat ?? 0,
            pickupLng: update.lng ?? 0,
            dropoffLat: 0,
            dropoffLng: 0,
            pickupAddress: '',
            dropoffAddress: '',
            fareEstimate: update.fareEstimate ?? 0,
            currency: 'TND',
            requestedAt: update.timestamp,
            completedAt: null,
            distanceKm: 0,
            durationMinutes: update.estimatedArrivalMinutes ?? 0,
          } as never,
        ]);

        // If fraud-flagged or notable, push an alert
        if (update.newStatus === 'Disputed') {
          this.mapState.addAlert({
            id: `trip-${update.tripId}-${Date.now()}`,
            type: 'trip',
            severity: 'high',
            title: 'Trip Disputed',
            message: `Trip ${update.tripId.slice(0, 8)} moved to Disputed`,
            lat: update.lat,
            lng: update.lng,
            timestamp: update.timestamp,
            dismissed: false,
          });
        }
      });
  }

  private subscribeFraudAlerts(): void {
    this.signalR
      .on<FraudAlert>('ReceiveFraudAlert')
      .pipe(takeUntil(this.destroy$))
      .subscribe((alert) => {
        this.mapState.addAlert({
          id: `fraud-${alert.id}`,
          type: 'fraud',
          severity: alert.severity.toLowerCase() as MapAlert['severity'],
          title: `Fraud: ${alert.alertType}`,
          message: alert.description,
          lat: null,
          lng: null,
          timestamp: alert.detectedAt,
          dismissed: false,
        });
      });
  }

  private subscribeInfraAlerts(): void {
    this.signalR
      .on<InfraAlert>('ReceiveInfraAlert')
      .pipe(takeUntil(this.destroy$))
      .subscribe((alert) => {
        this.mapState.addAlert({
          id: `infra-${alert.id}`,
          type: 'infra',
          severity: alert.severity.toLowerCase() as MapAlert['severity'],
          title: `Infra: ${alert.service}`,
          message: alert.message,
          lat: null,
          lng: null,
          timestamp: alert.detectedAt,
          dismissed: false,
        });
      });
  }

  private subscribeSurgeUpdates(): void {
    this.signalR
      .on<SurgeZone[]>('ReceiveSurgeUpdate')
      .pipe(takeUntil(this.destroy$))
      .subscribe((zones) => {
        this.mapState.updateSurgeZones(zones);
      });
  }

  private subscribeGeofenceUpdates(): void {
    this.signalR
      .on<GeoFence[]>('ReceiveGeofenceUpdate')
      .pipe(takeUntil(this.destroy$))
      .subscribe((fences) => {
        this.mapState.updateGeoFences(fences);
      });
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  private applyPositionUpdate(pos: PositionUpdate): void {
    if (pos.entityType === PositionEntityType.Driver) {
      this.mapState.updatePositions([
        {
          driverId: pos.entityId,
          lat: pos.lat,
          lng: pos.lng,
          headingDegrees: pos.headingDegrees,
          speedKmh: pos.speedKmh,
          accuracy: pos.accuracy,
          status: pos.isOnTrip ? 'OnTrip' : 'Available',
          vehicleType: '',
          isOnTrip: pos.isOnTrip,
          currentTripId: pos.tripId,
          lastUpdatedAt: pos.timestamp,
          batteryLevel: pos.batteryLevel,
        },
      ]);
    } else if (pos.entityType === PositionEntityType.Rider) {
      this.mapState.updatePositions([], [
        {
          riderId: pos.entityId,
          lat: pos.lat,
          lng: pos.lng,
          accuracy: pos.accuracy,
          isWaitingForPickup: !pos.isOnTrip,
          currentTripId: pos.tripId,
          requestedAt: null,
          lastUpdatedAt: pos.timestamp,
        },
      ]);
    }
  }
}
