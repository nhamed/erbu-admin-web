import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, tap, throwError, finalize } from 'rxjs';

// ---------- DTOs ----------

export type ReportFormat = 'PDF' | 'CSV' | 'JSON';

export type ReportStatus =
  | 'Pending'
  | 'Generating'
  | 'Ready'
  | 'Failed'
  | 'Expired';

export type ReportType =
  | 'TripSummary'
  | 'Revenue'
  | 'DriverPerformance'
  | 'RiderActivity'
  | 'Incidents'
  | 'SLA'
  | 'Custom';

export type ScheduleFrequency = 'Daily' | 'Weekly' | 'Monthly';

export interface ReportItem {
  id: string;
  name: string;
  type: ReportType;
  format: ReportFormat;
  status: ReportStatus;
  createdAt: string;
  completedAt: string | null;
  fileSize: number | null;
  downloadUrl: string | null;
  generatedBy: string;
  parameters: Record<string, unknown>;
}

export interface ReportListResponse {
  items: ReportItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface GenerateReportRequest {
  name: string;
  type: ReportType;
  format: ReportFormat;
  dateFrom: string;
  dateTo: string;
  parameters?: Record<string, unknown>;
}

export interface ScheduledReport {
  id: string;
  name: string;
  type: ReportType;
  format: ReportFormat;
  frequency: ScheduleFrequency;
  nextRunAt: string;
  lastRunAt: string | null;
  enabled: boolean;
  recipients: string[];
  parameters: Record<string, unknown>;
}

export interface ScheduleReportRequest {
  name: string;
  type: ReportType;
  format: ReportFormat;
  frequency: ScheduleFrequency;
  recipients: string[];
  parameters?: Record<string, unknown>;
}

// ---------- Service ----------

const API_BASE = '/api/ops/reports';

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private readonly http = inject(HttpClient);

  readonly reports = signal<ReportItem[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly totalCount = signal(0);

  readonly schedules = signal<ScheduledReport[]>([]);
  readonly schedulesLoading = signal(false);

  readonly selectedReport = signal<ReportItem | null>(null);
  readonly generating = signal(false);

  readonly readyCount = computed(
    () => this.reports().filter((r) => r.status === 'Ready').length,
  );

  readonly pendingCount = computed(
    () =>
      this.reports().filter(
        (r) => r.status === 'Pending' || r.status === 'Generating',
      ).length,
  );

  loadReports(page = 1, pageSize = 25, typeFilter?: ReportType): void {
    this.loading.set(true);
    this.error.set(null);

    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (typeFilter) {
      params = params.set('type', typeFilter);
    }

    this.http
      .get<ReportListResponse>(API_BASE, { params })
      .pipe(
        tap((response) => {
          this.reports.set(response.items);
          this.totalCount.set(response.total);
        }),
        catchError((err) => {
          this.error.set('Failed to load reports.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  generate(request: GenerateReportRequest): Observable<ReportItem> {
    this.generating.set(true);
    return this.http.post<ReportItem>(`${API_BASE}/generate`, request).pipe(
      tap((created) => {
        this.reports.update((list) => [created, ...list]);
        this.totalCount.update((c) => c + 1);
      }),
      catchError((err) => {
        this.error.set('Failed to generate report.');
        return throwError(() => err);
      }),
      finalize(() => this.generating.set(false)),
    );
  }

  getById(id: string): Observable<ReportItem> {
    return this.http.get<ReportItem>(`${API_BASE}/${id}`).pipe(
      tap((report) => this.selectedReport.set(report)),
      catchError((err) => {
        this.error.set('Failed to load report details.');
        return throwError(() => err);
      }),
    );
  }

  download(id: string): Observable<Blob> {
    return this.http
      .get(`${API_BASE}/${id}/download`, { responseType: 'blob' })
      .pipe(
        catchError((err) => {
          this.error.set('Failed to download report.');
          return throwError(() => err);
        }),
      );
  }

  deleteReport(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/${id}`).pipe(
      tap(() => {
        this.reports.update((list) => list.filter((r) => r.id !== id));
        this.totalCount.update((c) => c - 1);
        if (this.selectedReport()?.id === id) {
          this.selectedReport.set(null);
        }
      }),
      catchError((err) => {
        this.error.set('Failed to delete report.');
        return throwError(() => err);
      }),
    );
  }

  // ── Scheduled reports ──────────────────────────────────────

  loadSchedules(): void {
    this.schedulesLoading.set(true);
    this.http
      .get<ScheduledReport[]>(`${API_BASE}/schedules`)
      .pipe(
        tap((list) => this.schedules.set(list)),
        catchError((err) => {
          this.error.set('Failed to load report schedules.');
          return throwError(() => err);
        }),
        finalize(() => this.schedulesLoading.set(false)),
      )
      .subscribe();
  }

  createSchedule(
    request: ScheduleReportRequest,
  ): Observable<ScheduledReport> {
    return this.http
      .post<ScheduledReport>(`${API_BASE}/schedules`, request)
      .pipe(
        tap((created) =>
          this.schedules.update((list) => [...list, created]),
        ),
        catchError((err) => {
          this.error.set('Failed to create schedule.');
          return throwError(() => err);
        }),
      );
  }

  toggleSchedule(id: string, enabled: boolean): Observable<ScheduledReport> {
    return this.http
      .patch<ScheduledReport>(`${API_BASE}/schedules/${id}`, { enabled })
      .pipe(
        tap((updated) =>
          this.schedules.update((list) =>
            list.map((s) => (s.id === id ? updated : s)),
          ),
        ),
        catchError((err) => {
          this.error.set('Failed to update schedule.');
          return throwError(() => err);
        }),
      );
  }

  deleteSchedule(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/schedules/${id}`).pipe(
      tap(() =>
        this.schedules.update((list) => list.filter((s) => s.id !== id)),
      ),
      catchError((err) => {
        this.error.set('Failed to delete schedule.');
        return throwError(() => err);
      }),
    );
  }

  shareReport(id: string, recipients: string[]): Observable<void> {
    return this.http
      .post<void>(`${API_BASE}/${id}/share`, { recipients })
      .pipe(
        catchError((err) => {
          this.error.set('Failed to share report.');
          return throwError(() => err);
        }),
      );
  }

  clearSelection(): void {
    this.selectedReport.set(null);
  }

  clearError(): void {
    this.error.set(null);
  }
}
