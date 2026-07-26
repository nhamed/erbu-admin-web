import { Injectable, inject, signal, computed, OnDestroy, NgZone } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom, Subject, takeUntil } from 'rxjs';
import * as signalR from '@microsoft/signalr';
import { PlannerTrip, ReplayDiff } from '@erbu-admin-web/shared/models';

// ── Request / response DTOs ────────────────────────────────────────────

export interface PlanTripRequest {
  origin: string;
  destination: string;
  departureTime: string;
  vehicleType: string;
  isRoundTrip: boolean;
  passengerCount: number;
}

export interface TripTwinResult {
  tripId: string;
  scenarioId: string;
  predictedDurationMinutes: number;
  predictedDistanceKm: number;
  predictedFare: number;
  actualDurationMinutes: number | null;
  actualDistanceKm: number | null;
  actualFare: number | null;
  durationDeltaPercent: number | null;
  distanceDeltaPercent: number | null;
  fareDeltaPercent: number | null;
  routeMatchPercent: number | null;
  verdict: string | null;
  simulatedAt: string;
}

export interface LocationSuggestion {
  placeId: string;
  displayName: string;
  lat: number;
  lng: number;
}

export interface TripRealtimeUpdate {
  tripId: string;
  status: string;
  lat: number | null;
  lng: number | null;
  estimatedArrivalMinutes: number | null;
  fareEstimate: number | null;
  timestamp: string;
}

// ── Hub connection state ────────────────────────────────────────────────

export type HubConnectionState = 'Disconnected' | 'Connecting' | 'Connected' | 'Reconnecting' | 'Error';

// ── API base URL token (provided at app config level) ───────────────────

const API_BASE = '/api/cockpit/planner';
const HUB_URL = '/hubs/trip-planner';

@Injectable()
export class PlannerService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly zone = inject(NgZone);
  private readonly destroy$ = new Subject<void>();

  // ── State signals ──────────────────────────────────────────────────

  private readonly _trips = signal<PlannerTrip[]>([]);
  private readonly _selectedTrip = signal<PlannerTrip | null>(null);
  private readonly _twinResult = signal<TripTwinResult | null>(null);
  private readonly _isPlanning = signal(false);
  private readonly _isSimulating = signal(false);
  private readonly _isLoadingTrips = signal(false);
  private readonly _locationSuggestions = signal<LocationSuggestion[]>([]);
  private readonly _isSearchingLocations = signal(false);
  private readonly _realtimeUpdates = signal<TripRealtimeUpdate[]>([]);
  private readonly _hubState = signal<HubConnectionState>('Disconnected');
  private readonly _error = signal<string | null>(null);

  readonly trips = this._trips.asReadonly();
  readonly selectedTrip = this._selectedTrip.asReadonly();
  readonly twinResult = this._twinResult.asReadonly();
  readonly isPlanning = this._isPlanning.asReadonly();
  readonly isSimulating = this._isSimulating.asReadonly();
  readonly isLoadingTrips = this._isLoadingTrips.asReadonly();
  readonly locationSuggestions = this._locationSuggestions.asReadonly();
  readonly isSearchingLocations = this._isSearchingLocations.asReadonly();
  readonly realtimeUpdates = this._realtimeUpdates.asReadonly();
  readonly hubState = this._hubState.asReadonly();
  readonly error = this._error.asReadonly();

  readonly activeTripsCount = computed(() =>
    this._trips().filter(t => !['Completed', 'Cancelled'].includes(t.vehicleType)).length,
  );

  // ── SignalR hub ────────────────────────────────────────────────────

  private hubConnection: signalR.HubConnection | null = null;

  // ── Lifecycle ──────────────────────────────────────────────────────

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.disconnectHub();
  }

  // ── REST: plan a new trip ──────────────────────────────────────────

  async planTrip(request: PlanTripRequest): Promise<PlannerTrip> {
    this._isPlanning.set(true);
    this._error.set(null);

    try {
      const trip = await firstValueFrom(
        this.http.post<PlannerTrip>(`${API_BASE}/trips`, request),
      );

      this._trips.update(trips => [trip, ...trips]);
      this._selectedTrip.set(trip);
      return trip;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to plan trip';
      this._error.set(message);
      throw err;
    } finally {
      this._isPlanning.set(false);
    }
  }

  // ── REST: list existing planned trips ──────────────────────────────

  async getTrips(scenarioId?: string): Promise<PlannerTrip[]> {
    this._isLoadingTrips.set(true);
    this._error.set(null);

    try {
      let params = new HttpParams();
      if (scenarioId) {
        params = params.set('scenarioId', scenarioId);
      }

      const trips = await firstValueFrom(
        this.http.get<PlannerTrip[]>(`${API_BASE}/trips`, { params }),
      );

      this._trips.set(trips);
      return trips;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load trips';
      this._error.set(message);
      throw err;
    } finally {
      this._isLoadingTrips.set(false);
    }
  }

  // ── REST: delete a planned trip ────────────────────────────────────

  async deleteTrip(tripId: string): Promise<void> {
    this._error.set(null);

    try {
      await firstValueFrom(
        this.http.delete<void>(`${API_BASE}/trips/${tripId}`),
      );

      this._trips.update(trips => trips.filter(t => t.id !== tripId));
      if (this._selectedTrip()?.id === tripId) {
        this._selectedTrip.set(null);
        this._twinResult.set(null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete trip';
      this._error.set(message);
      throw err;
    }
  }

  // ── REST: run trip twin simulation ─────────────────────────────────

  async simulateTwin(tripId: string): Promise<TripTwinResult> {
    this._isSimulating.set(true);
    this._error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.post<TripTwinResult>(`${API_BASE}/trips/${tripId}/simulate-twin`, {}),
      );

      this._twinResult.set(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Twin simulation failed';
      this._error.set(message);
      throw err;
    } finally {
      this._isSimulating.set(false);
    }
  }

  // ── REST: autocomplete location search ─────────────────────────────

  async searchLocations(query: string): Promise<LocationSuggestion[]> {
    if (!query || query.length < 2) {
      this._locationSuggestions.set([]);
      return [];
    }

    this._isSearchingLocations.set(true);

    try {
      const params = new HttpParams().set('q', query).set('limit', '8');
      const suggestions = await firstValueFrom(
        this.http.get<LocationSuggestion[]>(`${API_BASE}/locations/autocomplete`, { params }),
      );

      this._locationSuggestions.set(suggestions);
      return suggestions;
    } catch {
      this._locationSuggestions.set([]);
      return [];
    } finally {
      this._isSearchingLocations.set(false);
    }
  }

  // ── Selection ──────────────────────────────────────────────────────

  selectTrip(trip: PlannerTrip | null): void {
    this._selectedTrip.set(trip);
    this._twinResult.set(null);
  }

  clearError(): void {
    this._error.set(null);
  }

  // ── SignalR: connect to the trip-planner hub ───────────────────────

  async connectHub(): Promise<void> {
    if (this.hubConnection) {
      return;
    }

    this._hubState.set('Connecting');

    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL, {
        accessTokenFactory: () => localStorage.getItem('erbu_access_token') ?? '',
      })
      .withAutomaticReconnect([0, 2_000, 5_000, 10_000, 30_000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    this.hubConnection.onreconnecting(() => {
      this.zone.run(() => this._hubState.set('Reconnecting'));
    });

    this.hubConnection.onreconnected(() => {
      this.zone.run(() => this._hubState.set('Connected'));
    });

    this.hubConnection.onclose(() => {
      this.zone.run(() => this._hubState.set('Disconnected'));
    });

    // ── Hub event handlers ─────────────────────────────────────────

    this.hubConnection.on('TripUpdated', (update: TripRealtimeUpdate) => {
      this.zone.run(() => {
        this._realtimeUpdates.update(updates => {
          const filtered = updates.filter(u => u.tripId !== update.tripId);
          return [update, ...filtered].slice(0, 50);
        });
      });
    });

    this.hubConnection.on('TripPlanned', (trip: PlannerTrip) => {
      this.zone.run(() => {
        this._trips.update(trips => {
          if (trips.some(t => t.id === trip.id)) {
            return trips.map(t => (t.id === trip.id ? trip : t));
          }
          return [trip, ...trips];
        });
      });
    });

    this.hubConnection.on('TwinSimulationCompleted', (result: TripTwinResult) => {
      this.zone.run(() => {
        if (this._selectedTrip()?.id === result.tripId) {
          this._twinResult.set(result);
        }
      });
    });

    try {
      await this.hubConnection.start();
      this._hubState.set('Connected');
    } catch (err) {
      this._hubState.set('Error');
      console.error('[PlannerService] Hub connection failed:', err);
    }
  }

  async disconnectHub(): Promise<void> {
    if (!this.hubConnection) {
      return;
    }

    try {
      await this.hubConnection.stop();
    } catch {
      // Swallow stop errors during teardown
    } finally {
      this.hubConnection = null;
      this._hubState.set('Disconnected');
    }
  }
}
