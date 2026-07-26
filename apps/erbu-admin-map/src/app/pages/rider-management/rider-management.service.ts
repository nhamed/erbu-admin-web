import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, tap, throwError, finalize } from 'rxjs';

// ---------- DTOs ----------

export type RiderStatus = 'Active' | 'Inactive' | 'Suspended' | 'PendingVerification';

export type MarketplaceStatus = 'Available' | 'OnTrip' | 'Offline' | 'Idle';

export interface Rider {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  status: RiderStatus;
  rating: number;
  totalTrips: number;
  joinedAt: string;
  lastActiveAt: string;
  preferredPayment: string;
  avatarUrl: string | null;
  city: string;
  verificationComplete: boolean;
}

export interface RiderDetail extends Rider {
  address: string;
  dateOfBirth: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  loyaltyPoints: number;
  cancelRate: number;
  avgRating: number;
  totalSpent: number;
  currency: string;
  recentTrips: RiderTrip[];
  paymentMethods: RiderPaymentMethod[];
}

export interface RiderTrip {
  id: string;
  tripNumber: string;
  driverName: string;
  pickupAddress: string;
  dropoffAddress: string;
  fare: number;
  currency: string;
  status: string;
  requestedAt: string;
  completedAt: string | null;
  rating: number | null;
}

export interface RiderPaymentMethod {
  id: string;
  type: 'Card' | 'Wallet' | 'Cash' | 'BankTransfer';
  label: string;
  isDefault: boolean;
  lastFour: string | null;
}

export interface MarketplaceRider {
  riderId: string;
  fullName: string;
  marketplaceStatus: MarketplaceStatus;
  currentLocation: { lat: number; lng: number } | null;
  lastRequestedAt: string | null;
  waitingMinutes: number;
  surgeMultiplier: number;
  nearbyDrivers: number;
}

export interface RiderListResponse {
  items: Rider[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MarketplaceResponse {
  items: MarketplaceRider[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------- Service ----------

const API_BASE = '/api/admin/riders';
const MARKETPLACE_API = '/api/admin/marketplace/riders';

@Injectable({ providedIn: 'root' })
export class RiderManagementService {
  private readonly http = inject(HttpClient);

  // ---- State signals ----
  readonly riders = signal<Rider[]>([]);
  readonly selectedRider = signal<RiderDetail | null>(null);
  readonly marketplaceRiders = signal<MarketplaceRider[]>([]);
  readonly loading = signal(false);
  readonly detailLoading = signal(false);
  readonly marketplaceLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly totalCount = signal(0);
  readonly marketplaceTotal = signal(0);

  // ---- Computed ----
  readonly activeCount = computed(
    () => this.riders().filter((r) => r.status === 'Active').length,
  );
  readonly suspendedCount = computed(
    () => this.riders().filter((r) => r.status === 'Suspended').length,
  );
  readonly pendingCount = computed(
    () => this.riders().filter((r) => r.status === 'PendingVerification').length,
  );

  // ---- Rider List ----
  loadRiders(
    page = 1,
    pageSize = 25,
    search?: string,
    statusFilter?: RiderStatus,
  ): void {
    this.loading.set(true);
    this.error.set(null);

    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (search) params = params.set('search', search);
    if (statusFilter) params = params.set('status', statusFilter);

    this.http
      .get<RiderListResponse>(API_BASE, { params })
      .pipe(
        tap((res) => {
          this.riders.set(res.items);
          this.totalCount.set(res.total);
        }),
        catchError((err) => {
          this.error.set('Failed to load riders.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  // ---- Rider Detail ----
  loadRiderDetail(id: string): void {
    this.detailLoading.set(true);
    this.http
      .get<RiderDetail>(`${API_BASE}/${id}`)
      .pipe(
        tap((detail) => this.selectedRider.set(detail)),
        catchError((err) => {
          this.error.set('Failed to load rider details.');
          return throwError(() => err);
        }),
        finalize(() => this.detailLoading.set(false)),
      )
      .subscribe();
  }

  // ---- Status Management ----
  updateRiderStatus(id: string, status: RiderStatus): Observable<Rider> {
    return this.http.patch<Rider>(`${API_BASE}/${id}/status`, { status }).pipe(
      tap((updated) => {
        this.riders.update((list) =>
          list.map((r) => (r.id === id ? { ...r, status: updated.status } : r)),
        );
        if (this.selectedRider()?.id === id) {
          this.selectedRider.update((d) => (d ? { ...d, status: updated.status } : d));
        }
      }),
      catchError((err) => {
        this.error.set('Failed to update rider status.');
        return throwError(() => err);
      }),
    );
  }

  suspendRider(id: string, reason: string): Observable<Rider> {
    return this.http
      .post<Rider>(`${API_BASE}/${id}/suspend`, { reason })
      .pipe(
        tap((updated) => {
          this.riders.update((list) =>
            list.map((r) => (r.id === id ? { ...r, status: updated.status } : r)),
          );
        }),
        catchError((err) => {
          this.error.set('Failed to suspend rider.');
          return throwError(() => err);
        }),
      );
  }

  reactivateRider(id: string): Observable<Rider> {
    return this.http.post<Rider>(`${API_BASE}/${id}/reactivate`, {}).pipe(
      tap((updated) => {
        this.riders.update((list) =>
          list.map((r) => (r.id === id ? { ...r, status: updated.status } : r)),
        );
      }),
      catchError((err) => {
        this.error.set('Failed to reactivate rider.');
        return throwError(() => err);
      }),
    );
  }

  // ---- Marketplace ----
  loadMarketplace(page = 1, pageSize = 25, statusFilter?: MarketplaceStatus): void {
    this.marketplaceLoading.set(true);

    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (statusFilter) params = params.set('status', statusFilter);

    this.http
      .get<MarketplaceResponse>(MARKETPLACE_API, { params })
      .pipe(
        tap((res) => {
          this.marketplaceRiders.set(res.items);
          this.marketplaceTotal.set(res.total);
        }),
        catchError((err) => {
          this.error.set('Failed to load marketplace data.');
          return throwError(() => err);
        }),
        finalize(() => this.marketplaceLoading.set(false)),
      )
      .subscribe();
  }

  // ---- Utility ----
  clearSelection(): void {
    this.selectedRider.set(null);
  }

  clearError(): void {
    this.error.set(null);
  }
}
