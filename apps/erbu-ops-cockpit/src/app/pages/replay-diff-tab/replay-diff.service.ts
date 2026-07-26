import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  ReplayDiff,
  DiffVerdict,
  TripReplay,
  Trip,
} from '@erbu-admin-web/shared/models';

// ---------- DTOs ----------

export interface ReplayCompareRequest {
  baselineTripId: string;
  comparisonTripId: string;
  /** When comparing two versions of the same trip, set this to true. */
  sameTrip: boolean;
}

export interface DiffMetrics {
  timeDeviationSeconds: number;
  timeDeviationPercent: number;
  routeDeviationKm: number;
  routeDeviationPercent: number;
  costDifference: number;
  costDifferencePercent: number;
  waypointMismatches: number;
  verdict: DiffVerdict;
}

export interface DiffSegment {
  index: number;
  baselineLat: number;
  baselineLng: number;
  comparisonLat: number;
  comparisonLng: number;
  deviationMeters: number;
  /** Color bucket: 'match' | 'minor' | 'significant' | 'mismatch'. */
  severity: string;
}

export interface DiffReport {
  diff: ReplayDiff;
  metrics: DiffMetrics;
  segments: DiffSegment[];
  baselineReplay: TripReplay;
  comparisonReplay: TripReplay;
}

export interface TripSearchResult {
  items: Trip[];
  total: number;
}

// ---------- Service ----------

const API_BASE = '/api/ops/replay-diff';

@Injectable({ providedIn: 'root' })
export class ReplayDiffService {
  private readonly http = inject(HttpClient);

  /** Search trips by number or rider/driver name for selection. */
  searchTrips(query: string, page = 1, pageSize = 20): Observable<TripSearchResult> {
    const params = new HttpParams()
      .set('q', query)
      .set('page', page)
      .set('pageSize', pageSize);
    return this.http.get<TripSearchResult>(`${API_BASE}/trips/search`, { params });
  }

  /** Get the full replay data for a single trip. */
  getReplay(tripId: string): Observable<TripReplay> {
    return this.http.get<TripReplay>(
      `${API_BASE}/trips/${encodeURIComponent(tripId)}/replay`,
    );
  }

  /** Compare two trips (or two versions of the same trip) and get a diff report. */
  compare(request: ReplayCompareRequest): Observable<DiffReport> {
    return this.http.post<DiffReport>(`${API_BASE}/compare`, request);
  }

  /** Get a previously generated diff by ID. */
  getDiff(diffId: string): Observable<DiffReport> {
    return this.http.get<DiffReport>(
      `${API_BASE}/diffs/${encodeURIComponent(diffId)}`,
    );
  }

  /** List recent diffs for a trip. */
  listDiffs(tripId: string, limit = 20): Observable<ReplayDiff[]> {
    const params = new HttpParams().set('limit', limit);
    return this.http.get<ReplayDiff[]>(
      `${API_BASE}/trips/${encodeURIComponent(tripId)}/diffs`,
      { params },
    );
  }

  /** Export diff report as a downloadable file (PDF or CSV). */
  exportReport(diffId: string, format: 'pdf' | 'csv' = 'pdf'): Observable<Blob> {
    const params = new HttpParams().set('format', format);
    return this.http.get(
      `${API_BASE}/diffs/${encodeURIComponent(diffId)}/export`,
      { params, responseType: 'blob' },
    );
  }
}
