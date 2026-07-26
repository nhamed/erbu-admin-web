import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, tap, throwError, finalize } from 'rxjs';

// ---------- DTOs ----------

export type AlertSeverity = 'Info' | 'Warning' | 'Error' | 'Critical';

export type AlertStatus = 'Active' | 'Acknowledged' | 'Dismissed' | 'Resolved';

export type AlertSource =
  | 'System'
  | 'CrashDetection'
  | 'DriverService'
  | 'PaymentService'
  | 'TripService'
  | 'Orchestrator'
  | 'Infrastructure';

export interface Alert {
  id: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  status: AlertStatus;
  source: AlertSource;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  metadata: Record<string, string>;
}

export interface CrashAlertDetail extends Alert {
  deviceId: string;
  riderId: string;
  riderName: string;
  tripId: string | null;
  location: { lat: number; lng: number } | null;
  impactSeverity: string;
  accelerometerData: number[] | null;
  responseTime: string | null;
  emergencyContactNotified: boolean;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  source: AlertSource;
  condition: string;
  enabled: boolean;
  throttleMinutes: number;
  notifyEmail: boolean;
  notifySms: boolean;
  notifyPush: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AlertRuleFormData {
  name: string;
  description: string;
  severity: AlertSeverity;
  source: AlertSource;
  condition: string;
  enabled: boolean;
  throttleMinutes: number;
  notifyEmail: boolean;
  notifySms: boolean;
  notifyPush: boolean;
}

export interface NotificationPreferences {
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  emailRecipients: string[];
  criticalOnlyEmail: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
}

export interface AlertListResponse {
  items: Alert[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------- Service ----------

const ALERT_API = '/api/admin/alerts';
const RULES_API = '/api/admin/alerts/rules';
const PREFS_API = '/api/admin/alerts/preferences';

@Injectable({ providedIn: 'root' })
export class AlertCenterService {
  private readonly http = inject(HttpClient);

  // ---- State signals ----
  readonly alerts = signal<Alert[]>([]);
  readonly selectedAlert = signal<Alert | CrashAlertDetail | null>(null);
  readonly alertRules = signal<AlertRule[]>([]);
  readonly notificationPrefs = signal<NotificationPreferences | null>(null);
  readonly loading = signal(false);
  readonly detailLoading = signal(false);
  readonly rulesLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly totalCount = signal(0);

  // ---- Computed ----
  readonly activeAlerts = computed(
    () => this.alerts().filter((a) => a.status === 'Active').length,
  );
  readonly criticalAlerts = computed(
    () => this.alerts().filter((a) => a.severity === 'Critical' && a.status === 'Active').length,
  );
  readonly acknowledgedAlerts = computed(
    () => this.alerts().filter((a) => a.status === 'Acknowledged').length,
  );
  readonly enabledRules = computed(
    () => this.alertRules().filter((r) => r.enabled).length,
  );

  // ---- Alert Feed ----
  loadAlerts(
    page = 1,
    pageSize = 50,
    severityFilter?: AlertSeverity,
    statusFilter?: AlertStatus,
    sourceFilter?: AlertSource,
  ): void {
    this.loading.set(true);
    this.error.set(null);

    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (severityFilter) params = params.set('severity', severityFilter);
    if (statusFilter) params = params.set('status', statusFilter);
    if (sourceFilter) params = params.set('source', sourceFilter);

    this.http
      .get<AlertListResponse>(ALERT_API, { params })
      .pipe(
        tap((res) => {
          this.alerts.set(res.items);
          this.totalCount.set(res.total);
        }),
        catchError((err) => {
          this.error.set('Failed to load alerts.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  // ---- Alert Detail ----
  loadAlertDetail(id: string): void {
    this.detailLoading.set(true);
    this.http
      .get<Alert | CrashAlertDetail>(`${ALERT_API}/${id}`)
      .pipe(
        tap((detail) => this.selectedAlert.set(detail)),
        catchError((err) => {
          this.error.set('Failed to load alert details.');
          return throwError(() => err);
        }),
        finalize(() => this.detailLoading.set(false)),
      )
      .subscribe();
  }

  // ---- Acknowledge / Dismiss ----
  acknowledgeAlert(id: string): Observable<Alert> {
    return this.http.post<Alert>(`${ALERT_API}/${id}/acknowledge`, {}).pipe(
      tap((updated) => {
        this.alerts.update((list) =>
          list.map((a) => (a.id === id ? { ...a, status: updated.status, acknowledgedAt: updated.acknowledgedAt, acknowledgedBy: updated.acknowledgedBy } : a)),
        );
        if (this.selectedAlert()?.id === id) {
          this.selectedAlert.set(updated);
        }
      }),
      catchError((err) => {
        this.error.set('Failed to acknowledge alert.');
        return throwError(() => err);
      }),
    );
  }

  dismissAlert(id: string): Observable<Alert> {
    return this.http.post<Alert>(`${ALERT_API}/${id}/dismiss`, {}).pipe(
      tap((updated) => {
        this.alerts.update((list) =>
          list.map((a) => (a.id === id ? { ...a, status: 'Dismissed' as AlertStatus } : a)),
        );
        if (this.selectedAlert()?.id === id) {
          this.selectedAlert.set(updated);
        }
      }),
      catchError((err) => {
        this.error.set('Failed to dismiss alert.');
        return throwError(() => err);
      }),
    );
  }

  resolveAlert(id: string, resolution: string): Observable<Alert> {
    return this.http.post<Alert>(`${ALERT_API}/${id}/resolve`, { resolution }).pipe(
      tap((updated) => {
        this.alerts.update((list) =>
          list.map((a) => (a.id === id ? { ...a, status: 'Resolved' as AlertStatus, resolvedAt: updated.resolvedAt } : a)),
        );
        if (this.selectedAlert()?.id === id) {
          this.selectedAlert.set(updated);
        }
      }),
      catchError((err) => {
        this.error.set('Failed to resolve alert.');
        return throwError(() => err);
      }),
    );
  }

  // ---- Alert Rules ----
  loadRules(): void {
    this.rulesLoading.set(true);
    this.http
      .get<AlertRule[]>(RULES_API)
      .pipe(
        tap((rules) => this.alertRules.set(rules)),
        catchError((err) => {
          this.error.set('Failed to load alert rules.');
          return throwError(() => err);
        }),
        finalize(() => this.rulesLoading.set(false)),
      )
      .subscribe();
  }

  createRule(data: AlertRuleFormData): Observable<AlertRule> {
    return this.http.post<AlertRule>(RULES_API, data).pipe(
      tap((rule) => this.alertRules.update((list) => [...list, rule])),
      catchError((err) => {
        this.error.set('Failed to create alert rule.');
        return throwError(() => err);
      }),
    );
  }

  updateRule(id: string, data: Partial<AlertRuleFormData>): Observable<AlertRule> {
    return this.http.patch<AlertRule>(`${RULES_API}/${id}`, data).pipe(
      tap((updated) => {
        this.alertRules.update((list) =>
          list.map((r) => (r.id === id ? updated : r)),
        );
      }),
      catchError((err) => {
        this.error.set('Failed to update alert rule.');
        return throwError(() => err);
      }),
    );
  }

  toggleRule(id: string, enabled: boolean): Observable<AlertRule> {
    return this.updateRule(id, { enabled });
  }

  deleteRule(id: string): Observable<void> {
    return this.http.delete<void>(`${RULES_API}/${id}`).pipe(
      tap(() => this.alertRules.update((list) => list.filter((r) => r.id !== id))),
      catchError((err) => {
        this.error.set('Failed to delete alert rule.');
        return throwError(() => err);
      }),
    );
  }

  // ---- Notification Preferences ----
  loadPreferences(): void {
    this.http
      .get<NotificationPreferences>(PREFS_API)
      .pipe(
        tap((prefs) => this.notificationPrefs.set(prefs)),
        catchError((err) => {
          this.error.set('Failed to load notification preferences.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  updatePreferences(prefs: NotificationPreferences): Observable<NotificationPreferences> {
    return this.http.put<NotificationPreferences>(PREFS_API, prefs).pipe(
      tap((updated) => this.notificationPrefs.set(updated)),
      catchError((err) => {
        this.error.set('Failed to update notification preferences.');
        return throwError(() => err);
      }),
    );
  }

  // ---- Utility ----
  clearSelection(): void {
    this.selectedAlert.set(null);
  }

  clearError(): void {
    this.error.set(null);
  }
}
