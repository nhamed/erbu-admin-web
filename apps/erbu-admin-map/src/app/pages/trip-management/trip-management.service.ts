import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// ---------- DTOs ----------

export type TripMgmtStatus =
  | 'requested'
  | 'searching'
  | 'driver-assigned'
  | 'driver-en-route'
  | 'driver-arrived'
  | 'in-progress'
  | 'completed'
  | 'cancelled-rider'
  | 'cancelled-driver'
  | 'cancelled-system'
  | 'disputed'
  | 'no-driver-found';

export interface TripListItem {
  id: string;
  tripNumber: string;
  riderName: string;
  riderPhone: string;
  driverName: string | null;
  driverPhone: string | null;
  status: TripMgmtStatus;
  vehicleType: string;
  pickupAddress: string;
  pickupLat: number;
  pickupLng: number;
  dropoffAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  requestedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  distanceKm: number | null;
  durationMinutes: number | null;
  fareAmount: number;
  currency: string;
  paymentMethod: string;
  rating: number | null;
  surgeMultiplier: number;
}

export interface TripFilters {
  status?: TripMgmtStatus;
  dateFrom?: string;
  dateTo?: string;
  riderId?: string;
  driverId?: string;
  search?: string;
  page: number;
  pageSize: number;
}

export interface TripListResponse {
  items: TripListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TripDetail {
  trip: TripListItem;
  timeline: TripTimelineEvent[];
  route: TripRoutePoint[];
  cancellationReason: string | null;
  disputeDetails: DisputeDetails | null;
  paymentDetails: PaymentDetails;
}

export interface TripTimelineEvent {
  timestamp: string;
  event: string;
  description: string;
  actor: string;
  metadata: Record<string, unknown>;
}

export interface TripRoutePoint {
  lat: number;
  lng: number;
  timestamp: string;
  speedKmh: number;
  heading: number;
  accuracy: number;
}

export interface DisputeDetails {
  id: string;
  reason: string;
  description: string;
  status: 'open' | 'investigating' | 'resolved' | 'closed';
  createdAt: string;
  resolvedAt: string | null;
  resolution: string | null;
}

export interface PaymentDetails {
  transactionId: string;
  method: string;
  baseFare: number;
  distanceCharge: number;
  timeCharge: number;
  surgeCharge: number;
  discount: number;
  tip: number;
  totalCharged: number;
  currency: string;
  status: 'pending' | 'completed' | 'refunded' | 'failed';
}

export interface TripReplayFrame {
  index: number;
  timestamp: string;
  driverLat: number;
  driverLng: number;
  driverHeading: number;
  speedKmh: number;
  distanceCoveredKm: number;
  elapsedSeconds: number;
  event: string | null;
}

export interface TripReplayData {
  tripId: string;
  totalFrames: number;
  totalDurationSeconds: number;
  frames: TripReplayFrame[];
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
}

export interface TripStats {
  totalTrips: number;
  completedTrips: number;
  cancelledTrips: number;
  disputedTrips: number;
  avgDurationMinutes: number;
  avgDistanceKm: number;
  avgFare: number;
  totalRevenue: number;
  avgRating: number;
  completionRate: number;
}

// ---------- Service ----------

const API_BASE = '/api/admin/trips';

@Injectable({ providedIn: 'root' })
export class TripManagementService {
  private readonly http = inject(HttpClient);

  /** Fetch paginated trip list with filters. */
  fetchTrips(filters: TripFilters): Observable<TripListResponse> {
    const params: Record<string, string> = {
      page: filters.page.toString(),
      pageSize: filters.pageSize.toString(),
    };
    if (filters.status) params['status'] = filters.status;
    if (filters.dateFrom) params['dateFrom'] = filters.dateFrom;
    if (filters.dateTo) params['dateTo'] = filters.dateTo;
    if (filters.riderId) params['riderId'] = filters.riderId;
    if (filters.driverId) params['driverId'] = filters.driverId;
    if (filters.search) params['search'] = filters.search;

    return this.http.get<TripListResponse>(`${API_BASE}`, { params });
  }

  /** Fetch full trip detail including timeline. */
  fetchTripDetail(tripId: string): Observable<TripDetail> {
    return this.http.get<TripDetail>(`${API_BASE}/${tripId}`);
  }

  /** Fetch trip replay data for the map player. */
  fetchTripReplay(tripId: string): Observable<TripReplayData> {
    return this.http.get<TripReplayData>(`${API_BASE}/${tripId}/replay`);
  }

  /** Fetch trip statistics for a date range. */
  fetchTripStats(dateFrom: string, dateTo: string): Observable<TripStats> {
    return this.http.get<TripStats>(`${API_BASE}/stats`, {
      params: { dateFrom, dateTo },
    });
  }

  /** Cancel a trip (admin action). */
  cancelTrip(tripId: string, reason: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${API_BASE}/${tripId}/cancel`,
      { reason },
    );
  }

  /** Resolve a dispute. */
  resolveDispute(
    tripId: string,
    resolution: string,
    refundAmount?: number,
  ): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${API_BASE}/${tripId}/resolve-dispute`,
      { resolution, refundAmount },
    );
  }

  /** Export trips as CSV. */
  exportTrips(filters: TripFilters): Observable<Blob> {
    const params: Record<string, string> = {};
    if (filters.status) params['status'] = filters.status;
    if (filters.dateFrom) params['dateFrom'] = filters.dateFrom;
    if (filters.dateTo) params['dateTo'] = filters.dateTo;
    if (filters.search) params['search'] = filters.search;

    return this.http.get(`${API_BASE}/export`, {
      params,
      responseType: 'blob',
    });
  }
}
