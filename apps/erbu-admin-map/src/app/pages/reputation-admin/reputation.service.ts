import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  Observable,
  catchError,
  tap,
  throwError,
  finalize,
} from 'rxjs';

// ---------- DTOs ----------

export type UserType = 'Driver' | 'Rider';
export type FraudAlertStatus = 'Open' | 'Investigating' | 'Resolved' | 'Dismissed';
export type FraudAlertSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

export interface ReputationScore {
  userId: string;
  userName: string;
  userType: UserType;
  currentScore: number;
  previousScore: number;
  totalTrips: number;
  totalRatings: number;
  averageRating: number;
  lastUpdatedAt: string;
  flagged: boolean;
}

export interface ScoreHistoryPoint {
  timestamp: string;
  score: number;
  reason: string;
}

export interface ScoreAdjustment {
  userId: string;
  adjustment: number;
  reason: string;
}

export interface FraudAlert {
  id: string;
  userId: string;
  userName: string;
  userType: UserType;
  severity: FraudAlertSeverity;
  status: FraudAlertStatus;
  description: string;
  detectedAt: string;
  resolvedAt: string | null;
  evidence: string[];
  assignedTo: string | null;
}

export interface ReputationSummary {
  totalDrivers: number;
  totalRiders: number;
  avgDriverScore: number;
  avgRiderScore: number;
  flaggedCount: number;
  openFraudAlerts: number;
}

export interface ReputationListResponse {
  items: ReputationScore[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FraudAlertListResponse {
  items: FraudAlert[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------- Service ----------

const API_BASE = '/api/ops/reputation';

@Injectable({ providedIn: 'root' })
export class ReputationService {
  private readonly http = inject(HttpClient);

  // ---------- state signals ----------
  readonly scores = signal<ReputationScore[]>([]);
  readonly summary = signal<ReputationSummary>({
    totalDrivers: 0,
    totalRiders: 0,
    avgDriverScore: 0,
    avgRiderScore: 0,
    flaggedCount: 0,
    openFraudAlerts: 0,
  });
  readonly fraudAlerts = signal<FraudAlert[]>([]);
  readonly scoreHistory = signal<ScoreHistoryPoint[]>([]);
  readonly selectedUser = signal<ReputationScore | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly totalScores = signal(0);
  readonly totalAlerts = signal(0);

  // ---------- filters ----------
  readonly filterUserType = signal<UserType | null>(null);
  readonly filterFlagged = signal<boolean>(false);

  // ---------- computed ----------
  readonly filteredScores = computed(() => {
    let result = this.scores();
    const userType = this.filterUserType();
    const flagged = this.filterFlagged();
    if (userType) {
      result = result.filter((s) => s.userType === userType);
    }
    if (flagged) {
      result = result.filter((s) => s.flagged);
    }
    return result;
  });

  readonly openAlertCount = computed(
    () => this.fraudAlerts().filter((a) => a.status === 'Open').length,
  );

  readonly scoreChange = computed(() => {
    const user = this.selectedUser();
    if (!user) return 0;
    return user.currentScore - user.previousScore;
  });

  // ---------- queries ----------
  loadSummary(): void {
    this.http
      .get<ReputationSummary>(`${API_BASE}/summary`)
      .pipe(
        tap((s) => this.summary.set(s)),
        catchError((err) => {
          this.error.set('Failed to load reputation summary.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  loadScores(page = 1, pageSize = 25, userType?: UserType, flaggedOnly?: boolean): void {
    this.loading.set(true);
    this.error.set(null);

    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (userType) params = params.set('userType', userType);
    if (flaggedOnly) params = params.set('flagged', 'true');

    this.http
      .get<ReputationListResponse>(`${API_BASE}/scores`, { params })
      .pipe(
        tap((response) => {
          this.scores.set(response.items);
          this.totalScores.set(response.total);
        }),
        catchError((err) => {
          this.error.set('Failed to load reputation scores.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  loadScoreHistory(userId: string): void {
    this.http
      .get<ScoreHistoryPoint[]>(`${API_BASE}/scores/${userId}/history`)
      .pipe(
        tap((history) => this.scoreHistory.set(history)),
        catchError((err) => {
          this.error.set('Failed to load score history.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  loadFraudAlerts(page = 1, pageSize = 25, status?: FraudAlertStatus): void {
    this.loading.set(true);

    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (status) params = params.set('status', status);

    this.http
      .get<FraudAlertListResponse>(`${API_BASE}/fraud-alerts`, { params })
      .pipe(
        tap((response) => {
          this.fraudAlerts.set(response.items);
          this.totalAlerts.set(response.total);
        }),
        catchError((err) => {
          this.error.set('Failed to load fraud alerts.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  // ---------- commands ----------
  adjustScore(data: ScoreAdjustment): Observable<ReputationScore> {
    return this.http.post<ReputationScore>(`${API_BASE}/scores/${data.userId}/adjust`, data).pipe(
      tap((updated) => {
        this.scores.update((list) =>
          list.map((s) => (s.userId === updated.userId ? updated : s)),
        );
        if (this.selectedUser()?.userId === updated.userId) {
          this.selectedUser.set(updated);
        }
      }),
      catchError((err) => {
        this.error.set('Failed to adjust score.');
        return throwError(() => err);
      }),
    );
  }

  updateFraudAlertStatus(alertId: string, status: FraudAlertStatus): Observable<FraudAlert> {
    return this.http
      .patch<FraudAlert>(`${API_BASE}/fraud-alerts/${alertId}`, { status })
      .pipe(
        tap((updated) => {
          this.fraudAlerts.update((list) =>
            list.map((a) => (a.id === alertId ? updated : a)),
          );
        }),
        catchError((err) => {
          this.error.set('Failed to update fraud alert.');
          return throwError(() => err);
        }),
      );
  }

  selectUser(user: ReputationScore | null): void {
    this.selectedUser.set(user);
    if (user) {
      this.loadScoreHistory(user.userId);
    } else {
      this.scoreHistory.set([]);
    }
  }

  setUserTypeFilter(userType: UserType | null): void {
    this.filterUserType.set(userType);
  }

  setFlaggedFilter(flagged: boolean): void {
    this.filterFlagged.set(flagged);
  }

  clearError(): void {
    this.error.set(null);
  }
}
