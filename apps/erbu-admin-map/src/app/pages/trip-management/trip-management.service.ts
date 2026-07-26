import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';

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
const ADMIN_USER_ID = '11111111-1111-1111-1111-111111111111';

@Injectable({ providedIn: 'root' })
export class TripManagementService {
  private readonly http = inject(HttpClient);

  private mapTrip(raw: any): TripListItem {
    return {
      id: raw.tripId ?? raw.id ?? '',
      tripNumber: raw.tripNumber ?? raw.tripId?.slice(0, 8) ?? '',
      riderName: raw.riderName ?? raw.rider?.name ?? raw.riderId ?? '',
      riderPhone: raw.riderPhone ?? raw.rider?.phone ?? '',
      driverName: raw.driverName ?? raw.driver?.name ?? raw.driverId ?? null,
      driverPhone: raw.driverPhone ?? raw.driver?.phone ?? null,
      status: raw.status ?? 'requested',
      vehicleType: raw.vehicleType ?? raw.vehicleCategory ?? raw.category ?? 'Standard',
      pickupAddress: raw.pickupAddress ?? raw.pickup?.address ?? '',
      pickupLat: raw.pickupLat ?? raw.pickup?.lat ?? raw.pickup?.latitude ?? 0,
      pickupLng: raw.pickupLng ?? raw.pickup?.lng ?? raw.pickup?.longitude ?? 0,
      dropoffAddress: raw.dropoffAddress ?? raw.dropoff?.address ?? '',
      dropoffLat: raw.dropoffLat ?? raw.dropoff?.lat ?? raw.dropoff?.latitude ?? 0,
      dropoffLng: raw.dropoffLng ?? raw.dropoff?.lng ?? raw.dropoff?.longitude ?? 0,
      requestedAt: raw.requestedAt ?? raw.createdAt ?? '',
      startedAt: raw.startedAt ?? null,
      completedAt: raw.completedAt ?? null,
      distanceKm: raw.distanceKm ?? (raw.distanceMeters != null ? raw.distanceMeters / 1000 : null),
      durationMinutes: raw.durationMinutes ?? (raw.durationSeconds != null ? raw.durationSeconds / 60 : null),
      fareAmount: raw.fareAmount ?? raw.fare?.total ?? raw.fare?.amount ?? 0,
      currency: raw.currency ?? raw.fare?.currency ?? 'EUR',
      paymentMethod: raw.paymentMethod ?? 'Card',
      rating: raw.rating ?? null,
      surgeMultiplier: raw.surgeMultiplier ?? 1,
    };
  }

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

    return this.http.get<any>(`${API_BASE}`, { params }).pipe(
      map((res: any) => {
        const items = Array.isArray(res) ? res : (res.items ?? []);
        return {
          items: items.map((t: any) => this.mapTrip(t)),
          totalCount: res.totalCount ?? items.length,
          page: res.page ?? 1,
          pageSize: res.pageSize ?? 20,
          totalPages: res.totalPages ?? Math.ceil((res.totalCount ?? items.length) / (res.pageSize ?? 20)),
        };
      })
    );
  }

  /** Fetch full trip detail including timeline. */
  fetchTripDetail(tripId: string): Observable<TripDetail> {
    return this.http.get<any>(`${API_BASE}/${tripId}`).pipe(
      map((raw: any) => ({
        trip: this.mapTrip(raw.trip ?? raw),
        timeline: raw.timeline ?? raw.events ?? [],
        route: raw.route ?? raw.positions ?? [],
        cancellationReason: raw.cancellationReason ?? null,
        disputeDetails: raw.disputeDetails ?? null,
        paymentDetails: raw.paymentDetails ?? raw.payment ?? {
          transactionId: '', method: 'Card', baseFare: 0, distanceCharge: 0,
          timeCharge: 0, surgeCharge: 0, discount: 0, tip: 0, totalCharged: 0,
          currency: 'EUR', status: 'pending',
        },
      }))
    );
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
      `${API_BASE}/${tripId}/admin-cancel`,
      { adminId: ADMIN_USER_ID, reason },
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
