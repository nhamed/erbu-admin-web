import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, tap, throwError, finalize } from 'rxjs';
import {
  DriverNetworkNode,
  SignalStrength,
  MarketplaceReservation,
  ReservationStatus,
  DemandLiquidity,
  LiquidityTrend,
  AuctionBid,
  BidStatus,
  AlarmRule,
  AlarmCondition,
  AlarmSeverity,
} from '@erbu-admin-web/shared/models';

// ── Driver Profile (tab-local DTO) ─────────────────────────────

export interface DriverProfile {
  driverId: string;
  driverName: string;
  email: string;
  phone: string;
  vehicleType: string;
  licensePlate: string;
  rating: number;
  totalTrips: number;
  acceptanceRate: number;
  cancellationRate: number;
  onlineHoursToday: number;
  earningsToday: number;
  earningsThisWeek: number;
  currency: string;
  status: string;
  joinedAt: string;
  lastTripAt: string | null;
  zones: string[];
}

// ── Audit Alert ────────────────────────────────────────────────

export interface AuditAlert {
  id: string;
  type: AuditAlertType;
  severity: AuditAlertSeverity;
  message: string;
  source: string;
  entityId: string | null;
  entityType: string | null;
  details: string;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
  isResolved: boolean;
}

export type AuditAlertType =
  | 'FraudDetection'
  | 'PriceAnomaly'
  | 'DriverBehavior'
  | 'SystemHealth'
  | 'ComplianceViolation'
  | 'PaymentFailure';

export type AuditAlertSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

// ── Active Auction ─────────────────────────────────────────────

export interface ActiveAuction {
  id: string;
  tripRequestId: string;
  riderName: string;
  pickupAddress: string;
  dropoffAddress: string;
  estimatedFare: number;
  currency: string;
  status: AuctionStatus;
  bids: AuctionBid[];
  bidCount: number;
  lowestBid: number | null;
  createdAt: string;
  expiresAt: string;
  winnerDriverId: string | null;
  winnerDriverName: string | null;
}

export type AuctionStatus = 'Open' | 'Closed' | 'Awarded' | 'Expired' | 'Cancelled';

// ── Paginated response ─────────────────────────────────────────

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ── Alarm rule form ────────────────────────────────────────────

export interface AlarmRuleFormData {
  name: string;
  description: string;
  metric: string;
  condition: AlarmCondition;
  threshold: number;
  evaluationPeriodMinutes: number;
  consecutiveBreaches: number;
  severity: AlarmSeverity;
  isEnabled: boolean;
  notificationChannels: string[];
}

// ── Demand adjustment request ──────────────────────────────────

export interface SurgeAdjustment {
  zoneId: string;
  surgeMultiplier: number;
  reason: string;
}

// ── API base ───────────────────────────────────────────────────

const API_BASE = '/api/admin/marketplace';

@Injectable({ providedIn: 'root' })
export class MarketplaceService {
  private readonly http = inject(HttpClient);

  // ── Shared loading / error signals ───────────────────────────
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // ═══════════════════════════════════════════════════════════════
  //  DRIVER NETWORK
  // ═══════════════════════════════════════════════════════════════

  readonly networkNodes = signal<DriverNetworkNode[]>([]);
  readonly networkLoading = signal(false);

  readonly onlineDrivers = computed(
    () => this.networkNodes().filter(n => n.signalStrength !== SignalStrength.Disconnected).length,
  );

  readonly onTripDrivers = computed(
    () => this.networkNodes().filter(n => n.isOnTrip).length,
  );

  readonly disconnectedDrivers = computed(
    () => this.networkNodes().filter(n => n.signalStrength === SignalStrength.Disconnected).length,
  );

  loadNetworkNodes(): void {
    this.networkLoading.set(true);
    this.http
      .get<DriverNetworkNode[]>(`${API_BASE}/network/drivers`)
      .pipe(
        tap(nodes => this.networkNodes.set(nodes)),
        catchError(err => {
          this.error.set('Failed to load driver network.');
          return throwError(() => err);
        }),
        finalize(() => this.networkLoading.set(false)),
      )
      .subscribe();
  }

  // ═══════════════════════════════════════════════════════════════
  //  DRIVER PROFILE
  // ═══════════════════════════════════════════════════════════════

  getDriverProfile(driverId: string): Observable<DriverProfile> {
    return this.http.get<DriverProfile>(`${API_BASE}/drivers/${driverId}/profile`).pipe(
      catchError(err => {
        this.error.set('Failed to load driver profile.');
        return throwError(() => err);
      }),
    );
  }

  searchDriverProfiles(query: string): Observable<DriverProfile[]> {
    const params = new HttpParams().set('q', query);
    return this.http.get<DriverProfile[]>(`${API_BASE}/drivers/search`, { params }).pipe(
      catchError(err => {
        this.error.set('Failed to search driver profiles.');
        return throwError(() => err);
      }),
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  RESERVATIONS
  // ═══════════════════════════════════════════════════════════════

  readonly reservations = signal<MarketplaceReservation[]>([]);
  readonly reservationsTotal = signal(0);
  readonly reservationsLoading = signal(false);

  readonly pendingReservations = computed(
    () => this.reservations().filter(r => r.status === ReservationStatus.Pending).length,
  );

  readonly confirmedReservations = computed(
    () => this.reservations().filter(r => r.status === ReservationStatus.Confirmed).length,
  );

  loadReservations(
    page = 1,
    pageSize = 25,
    statusFilter?: ReservationStatus,
  ): void {
    this.reservationsLoading.set(true);
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (statusFilter) {
      params = params.set('status', statusFilter);
    }

    this.http
      .get<PaginatedResult<MarketplaceReservation>>(`${API_BASE}/reservations`, { params })
      .pipe(
        tap(result => {
          this.reservations.set(result.items);
          this.reservationsTotal.set(result.totalCount);
        }),
        catchError(err => {
          this.error.set('Failed to load reservations.');
          return throwError(() => err);
        }),
        finalize(() => this.reservationsLoading.set(false)),
      )
      .subscribe();
  }

  cancelReservation(id: string, reason: string): Observable<void> {
    return this.http.post<void>(`${API_BASE}/reservations/${id}/cancel`, { reason }).pipe(
      tap(() => {
        this.reservations.update(list =>
          list.map(r =>
            r.id === id ? { ...r, status: ReservationStatus.CancelledBySystem } : r,
          ),
        );
      }),
      catchError(err => {
        this.error.set('Failed to cancel reservation.');
        return throwError(() => err);
      }),
    );
  }

  reassignReservation(id: string, driverId: string): Observable<void> {
    return this.http.post<void>(`${API_BASE}/reservations/${id}/reassign`, { driverId }).pipe(
      catchError(err => {
        this.error.set('Failed to reassign reservation.');
        return throwError(() => err);
      }),
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  DEMAND / LIQUIDITY
  // ═══════════════════════════════════════════════════════════════

  readonly liquidityZones = signal<DemandLiquidity[]>([]);
  readonly liquidityLoading = signal(false);

  readonly deficitZones = computed(
    () =>
      this.liquidityZones().filter(
        z => z.trend === LiquidityTrend.Deficit || z.trend === LiquidityTrend.CriticalDeficit,
      ).length,
  );

  readonly surplusZones = computed(
    () => this.liquidityZones().filter(z => z.trend === LiquidityTrend.Surplus).length,
  );

  readonly avgSupplyDemandRatio = computed(() => {
    const zones = this.liquidityZones();
    if (zones.length === 0) return 0;
    return zones.reduce((sum, z) => sum + z.supplyDemandRatio, 0) / zones.length;
  });

  loadLiquidity(): void {
    this.liquidityLoading.set(true);
    this.http
      .get<DemandLiquidity[]>(`${API_BASE}/liquidity/zones`)
      .pipe(
        tap(zones => this.liquidityZones.set(zones)),
        catchError(err => {
          this.error.set('Failed to load demand/liquidity data.');
          return throwError(() => err);
        }),
        finalize(() => this.liquidityLoading.set(false)),
      )
      .subscribe();
  }

  adjustSurge(adjustment: SurgeAdjustment): Observable<void> {
    return this.http
      .post<void>(`${API_BASE}/liquidity/surge`, adjustment)
      .pipe(
        catchError(err => {
          this.error.set('Failed to adjust surge multiplier.');
          return throwError(() => err);
        }),
      );
  }

  // ═══════════════════════════════════════════════════════════════
  //  AUDIT ALERTS
  // ═══════════════════════════════════════════════════════════════

  readonly auditAlerts = signal<AuditAlert[]>([]);
  readonly auditAlertsTotal = signal(0);
  readonly auditAlertsLoading = signal(false);

  readonly unresolvedAlerts = computed(
    () => this.auditAlerts().filter(a => !a.isResolved).length,
  );

  readonly criticalAlerts = computed(
    () => this.auditAlerts().filter(a => a.severity === 'Critical' && !a.isResolved).length,
  );

  loadAuditAlerts(page = 1, pageSize = 25, severityFilter?: AuditAlertSeverity): void {
    this.auditAlertsLoading.set(true);
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (severityFilter) {
      params = params.set('severity', severityFilter);
    }

    this.http
      .get<PaginatedResult<AuditAlert>>(`${API_BASE}/audit/alerts`, { params })
      .pipe(
        tap(result => {
          this.auditAlerts.set(result.items);
          this.auditAlertsTotal.set(result.totalCount);
        }),
        catchError(err => {
          this.error.set('Failed to load audit alerts.');
          return throwError(() => err);
        }),
        finalize(() => this.auditAlertsLoading.set(false)),
      )
      .subscribe();
  }

  acknowledgeAlert(id: string): Observable<void> {
    return this.http.post<void>(`${API_BASE}/audit/alerts/${id}/acknowledge`, {}).pipe(
      tap(() => {
        this.auditAlerts.update(list =>
          list.map(a =>
            a.id === id ? { ...a, acknowledgedAt: new Date().toISOString(), isResolved: true } : a,
          ),
        );
      }),
      catchError(err => {
        this.error.set('Failed to acknowledge alert.');
        return throwError(() => err);
      }),
    );
  }

  // ═══════════════════════════════════════════════════════════════
  //  AUCTIONS
  // ═══════════════════════════════════════════════════════════════

  readonly auctions = signal<ActiveAuction[]>([]);
  readonly auctionsTotal = signal(0);
  readonly auctionsLoading = signal(false);

  readonly openAuctions = computed(
    () => this.auctions().filter(a => a.status === 'Open').length,
  );

  readonly totalBidsCount = computed(
    () => this.auctions().reduce((sum, a) => sum + a.bidCount, 0),
  );

  loadAuctions(page = 1, pageSize = 25, statusFilter?: AuctionStatus): void {
    this.auctionsLoading.set(true);
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (statusFilter) {
      params = params.set('status', statusFilter);
    }

    this.http
      .get<PaginatedResult<ActiveAuction>>(`${API_BASE}/auctions`, { params })
      .pipe(
        tap(result => {
          this.auctions.set(result.items);
          this.auctionsTotal.set(result.totalCount);
        }),
        catchError(err => {
          this.error.set('Failed to load auctions.');
          return throwError(() => err);
        }),
        finalize(() => this.auctionsLoading.set(false)),
      )
      .subscribe();
  }

  getAuctionBids(auctionId: string): Observable<AuctionBid[]> {
    return this.http.get<AuctionBid[]>(`${API_BASE}/auctions/${auctionId}/bids`).pipe(
      catchError(err => {
        this.error.set('Failed to load auction bids.');
        return throwError(() => err);
      }),
    );
  }

  cancelAuction(id: string, reason: string): Observable<void> {
    return this.http.post<void>(`${API_BASE}/auctions/${id}/cancel`, { reason }).pipe(
      tap(() => {
        this.auctions.update(list =>
          list.map(a => (a.id === id ? { ...a, status: 'Cancelled' as AuctionStatus } : a)),
        );
      }),
      catchError(err => {
        this.error.set('Failed to cancel auction.');
        return throwError(() => err);
      }),
    );
  }

  awardAuction(auctionId: string, bidId: string): Observable<void> {
    return this.http
      .post<void>(`${API_BASE}/auctions/${auctionId}/award`, { bidId })
      .pipe(
        catchError(err => {
          this.error.set('Failed to award auction.');
          return throwError(() => err);
        }),
      );
  }

  // ═══════════════════════════════════════════════════════════════
  //  ALARM ENGINE
  // ═══════════════════════════════════════════════════════════════

  readonly alarmRules = signal<AlarmRule[]>([]);
  readonly alarmRulesLoading = signal(false);

  readonly enabledRules = computed(
    () => this.alarmRules().filter(r => r.isEnabled).length,
  );

  readonly activeAlarms = computed(
    () => this.alarmRules().filter(r => r.isInAlarm).length,
  );

  loadAlarmRules(): void {
    this.alarmRulesLoading.set(true);
    this.http
      .get<AlarmRule[]>(`${API_BASE}/alarms/rules`)
      .pipe(
        tap(rules => this.alarmRules.set(rules)),
        catchError(err => {
          this.error.set('Failed to load alarm rules.');
          return throwError(() => err);
        }),
        finalize(() => this.alarmRulesLoading.set(false)),
      )
      .subscribe();
  }

  createAlarmRule(data: AlarmRuleFormData): Observable<AlarmRule> {
    return this.http.post<AlarmRule>(`${API_BASE}/alarms/rules`, data).pipe(
      tap(created => {
        this.alarmRules.update(list => [created, ...list]);
      }),
      catchError(err => {
        this.error.set('Failed to create alarm rule.');
        return throwError(() => err);
      }),
    );
  }

  updateAlarmRule(id: string, data: Partial<AlarmRuleFormData>): Observable<AlarmRule> {
    return this.http.patch<AlarmRule>(`${API_BASE}/alarms/rules/${id}`, data).pipe(
      tap(updated => {
        this.alarmRules.update(list =>
          list.map(r => (r.id === id ? updated : r)),
        );
      }),
      catchError(err => {
        this.error.set('Failed to update alarm rule.');
        return throwError(() => err);
      }),
    );
  }

  deleteAlarmRule(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/alarms/rules/${id}`).pipe(
      tap(() => {
        this.alarmRules.update(list => list.filter(r => r.id !== id));
      }),
      catchError(err => {
        this.error.set('Failed to delete alarm rule.');
        return throwError(() => err);
      }),
    );
  }

  toggleAlarmRule(id: string, enabled: boolean): Observable<AlarmRule> {
    return this.http
      .patch<AlarmRule>(`${API_BASE}/alarms/rules/${id}`, { isEnabled: enabled })
      .pipe(
        tap(updated => {
          this.alarmRules.update(list =>
            list.map(r => (r.id === id ? updated : r)),
          );
        }),
        catchError(err => {
          this.error.set('Failed to toggle alarm rule.');
          return throwError(() => err);
        }),
      );
  }

  // ── Utility ──────────────────────────────────────────────────

  clearError(): void {
    this.error.set(null);
  }
}
