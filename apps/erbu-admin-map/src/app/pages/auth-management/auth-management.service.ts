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

export type UserRole = 'Admin' | 'Operator' | 'Viewer' | 'Driver' | 'Rider';
export type UserStatus = 'Active' | 'Locked' | 'Suspended' | 'Deleted';
export type BanReason = 'Fraud' | 'Abuse' | 'TOS_Violation' | 'Spam' | 'Other';
export type BanStatus = 'Active' | 'Expired' | 'Revoked';
export type DiagnosticLevel = 'Healthy' | 'Warning' | 'Error';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  mfaEnabled: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  loginCount: number;
  lockedUntil: string | null;
}

export interface UserCreateRequest {
  email: string;
  displayName: string;
  role: UserRole;
  password: string;
  sendVerificationEmail: boolean;
}

export interface UserActionResult {
  success: boolean;
  message: string;
  user?: AuthUser;
}

export interface ActiveToken {
  id: string;
  userId: string;
  userName: string;
  tokenType: 'Access' | 'Refresh';
  issuedAt: string;
  expiresAt: string;
  clientId: string;
  ipAddress: string;
  revoked: boolean;
}

export interface Ban {
  id: string;
  userId: string;
  userName: string;
  reason: BanReason;
  description: string;
  status: BanStatus;
  bannedAt: string;
  expiresAt: string | null;
  bannedBy: string;
  revokedAt: string | null;
  revokedBy: string | null;
}

export interface BanCreateRequest {
  userId: string;
  reason: BanReason;
  description: string;
  durationDays: number | null;
}

export interface AuthDiagnostic {
  component: string;
  status: DiagnosticLevel;
  message: string;
  lastCheckedAt: string;
  details: Record<string, string>;
}

export interface AuthDiagnosticsSummary {
  overallStatus: DiagnosticLevel;
  components: AuthDiagnostic[];
  totalUsers: number;
  activeTokenCount: number;
  activeBanCount: number;
  failedLoginLast24h: number;
  avgLoginLatencyMs: number;
}

export interface UserListResponse {
  items: AuthUser[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TokenListResponse {
  items: ActiveToken[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BanListResponse {
  items: Ban[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------- Service ----------

const API_BASE = '/api/auth/admin';

@Injectable({ providedIn: 'root' })
export class AuthManagementService {
  private readonly http = inject(HttpClient);

  // ---------- state signals ----------
  readonly users = signal<AuthUser[]>([]);
  readonly totalUsers = signal(0);
  readonly tokens = signal<ActiveToken[]>([]);
  readonly totalTokens = signal(0);
  readonly bans = signal<Ban[]>([]);
  readonly totalBans = signal(0);
  readonly diagnostics = signal<AuthDiagnosticsSummary | null>(null);
  readonly selectedUser = signal<AuthUser | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // ---------- filters ----------
  readonly filterRole = signal<UserRole | null>(null);
  readonly filterStatus = signal<UserStatus | null>(null);
  readonly searchQuery = signal('');

  // ---------- computed ----------
  readonly filteredUsers = computed(() => {
    let result = this.users();
    const role = this.filterRole();
    const status = this.filterStatus();
    const query = this.searchQuery().toLowerCase().trim();

    if (role) result = result.filter((u) => u.role === role);
    if (status) result = result.filter((u) => u.status === status);
    if (query) {
      result = result.filter(
        (u) =>
          u.displayName.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query),
      );
    }
    return result;
  });

  readonly activeBanCount = computed(
    () => this.bans().filter((b) => b.status === 'Active').length,
  );

  readonly diagnosticStatus = computed(
    () => this.diagnostics()?.overallStatus ?? 'Healthy',
  );

  // ==================== User Management ====================

  loadUsers(page = 1, pageSize = 25): void {
    this.loading.set(true);
    this.error.set(null);

    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    const role = this.filterRole();
    const status = this.filterStatus();
    const query = this.searchQuery().trim();

    if (role) params = params.set('role', role);
    if (status) params = params.set('status', status);
    if (query) params = params.set('search', query);

    this.http
      .get<UserListResponse>(`${API_BASE}/users`, { params })
      .pipe(
        tap((response) => {
          this.users.set(response.items);
          this.totalUsers.set(response.total);
        }),
        catchError((err) => {
          this.error.set('Failed to load users.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  createUser(data: UserCreateRequest): Observable<AuthUser> {
    this.loading.set(true);
    return this.http.post<AuthUser>(`${API_BASE}/users`, data).pipe(
      tap((created) => {
        this.users.update((list) => [created, ...list]);
        this.totalUsers.update((c) => c + 1);
      }),
      catchError((err) => {
        this.error.set('Failed to create user.');
        return throwError(() => err);
      }),
      finalize(() => this.loading.set(false)),
    );
  }

  lockUser(userId: string, durationMinutes: number): Observable<UserActionResult> {
    return this.http
      .post<UserActionResult>(`${API_BASE}/users/${userId}/lock`, { durationMinutes })
      .pipe(
        tap((result) => {
          if (result.user) {
            this.users.update((list) =>
              list.map((u) => (u.id === userId ? result.user! : u)),
            );
          }
        }),
        catchError((err) => {
          this.error.set('Failed to lock user.');
          return throwError(() => err);
        }),
      );
  }

  unlockUser(userId: string): Observable<UserActionResult> {
    return this.http
      .post<UserActionResult>(`${API_BASE}/users/${userId}/unlock`, {})
      .pipe(
        tap((result) => {
          if (result.user) {
            this.users.update((list) =>
              list.map((u) => (u.id === userId ? result.user! : u)),
            );
          }
        }),
        catchError((err) => {
          this.error.set('Failed to unlock user.');
          return throwError(() => err);
        }),
      );
  }

  suspendUser(userId: string, reason: string): Observable<UserActionResult> {
    return this.http
      .post<UserActionResult>(`${API_BASE}/users/${userId}/suspend`, { reason })
      .pipe(
        tap((result) => {
          if (result.user) {
            this.users.update((list) =>
              list.map((u) => (u.id === userId ? result.user! : u)),
            );
          }
        }),
        catchError((err) => {
          this.error.set('Failed to suspend user.');
          return throwError(() => err);
        }),
      );
  }

  reactivateUser(userId: string): Observable<UserActionResult> {
    return this.http
      .post<UserActionResult>(`${API_BASE}/users/${userId}/reactivate`, {})
      .pipe(
        tap((result) => {
          if (result.user) {
            this.users.update((list) =>
              list.map((u) => (u.id === userId ? result.user! : u)),
            );
          }
        }),
        catchError((err) => {
          this.error.set('Failed to reactivate user.');
          return throwError(() => err);
        }),
      );
  }

  resetPassword(userId: string): Observable<UserActionResult> {
    return this.http
      .post<UserActionResult>(`${API_BASE}/users/${userId}/reset-password`, {})
      .pipe(
        catchError((err) => {
          this.error.set('Failed to reset password.');
          return throwError(() => err);
        }),
      );
  }

  deleteUser(userId: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/users/${userId}`).pipe(
      tap(() => {
        this.users.update((list) => list.filter((u) => u.id !== userId));
        this.totalUsers.update((c) => c - 1);
        if (this.selectedUser()?.id === userId) {
          this.selectedUser.set(null);
        }
      }),
      catchError((err) => {
        this.error.set('Failed to delete user.');
        return throwError(() => err);
      }),
    );
  }

  // ==================== Token Management ====================

  loadTokens(page = 1, pageSize = 25): void {
    this.loading.set(true);

    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    this.http
      .get<TokenListResponse>(`${API_BASE}/tokens`, { params })
      .pipe(
        tap((response) => {
          this.tokens.set(response.items);
          this.totalTokens.set(response.total);
        }),
        catchError((err) => {
          this.error.set('Failed to load tokens.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  revokeToken(tokenId: string): Observable<void> {
    return this.http.post<void>(`${API_BASE}/tokens/${tokenId}/revoke`, {}).pipe(
      tap(() => {
        this.tokens.update((list) =>
          list.map((t) => (t.id === tokenId ? { ...t, revoked: true } : t)),
        );
      }),
      catchError((err) => {
        this.error.set('Failed to revoke token.');
        return throwError(() => err);
      }),
    );
  }

  revokeAllUserTokens(userId: string): Observable<void> {
    return this.http.post<void>(`${API_BASE}/users/${userId}/revoke-tokens`, {}).pipe(
      tap(() => {
        this.tokens.update((list) =>
          list.map((t) => (t.userId === userId ? { ...t, revoked: true } : t)),
        );
      }),
      catchError((err) => {
        this.error.set('Failed to revoke user tokens.');
        return throwError(() => err);
      }),
    );
  }

  // ==================== Bans Management ====================

  loadBans(page = 1, pageSize = 25, status?: BanStatus): void {
    this.loading.set(true);

    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (status) params = params.set('status', status);

    this.http
      .get<BanListResponse>(`${API_BASE}/bans`, { params })
      .pipe(
        tap((response) => {
          this.bans.set(response.items);
          this.totalBans.set(response.total);
        }),
        catchError((err) => {
          this.error.set('Failed to load bans.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  createBan(data: BanCreateRequest): Observable<Ban> {
    return this.http.post<Ban>(`${API_BASE}/bans`, data).pipe(
      tap((created) => {
        this.bans.update((list) => [created, ...list]);
        this.totalBans.update((c) => c + 1);
      }),
      catchError((err) => {
        this.error.set('Failed to create ban.');
        return throwError(() => err);
      }),
    );
  }

  revokeBan(banId: string): Observable<Ban> {
    return this.http.post<Ban>(`${API_BASE}/bans/${banId}/revoke`, {}).pipe(
      tap((updated) => {
        this.bans.update((list) =>
          list.map((b) => (b.id === banId ? updated : b)),
        );
      }),
      catchError((err) => {
        this.error.set('Failed to revoke ban.');
        return throwError(() => err);
      }),
    );
  }

  // ==================== Diagnostics ====================

  loadDiagnostics(): void {
    this.loading.set(true);

    this.http
      .get<AuthDiagnosticsSummary>(`${API_BASE}/diagnostics`)
      .pipe(
        tap((d) => this.diagnostics.set(d)),
        catchError((err) => {
          this.error.set('Failed to load diagnostics.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  // ==================== Helpers ====================

  selectUser(user: AuthUser | null): void {
    this.selectedUser.set(user);
  }

  setRoleFilter(role: UserRole | null): void {
    this.filterRole.set(role);
  }

  setStatusFilter(status: UserStatus | null): void {
    this.filterStatus.set(status);
  }

  setSearchQuery(query: string): void {
    this.searchQuery.set(query);
  }

  clearError(): void {
    this.error.set(null);
  }
}
