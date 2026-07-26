import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, tap, throwError, finalize } from 'rxjs';
import { CoverageReport, CoverageFile } from '@erbu-admin-web/shared/models';

// ---------- DTOs ----------

export interface CoverageOverview {
  lineCoveragePercent: number;
  branchCoveragePercent: number;
  functionCoveragePercent: number;
  totalLines: number;
  coveredLines: number;
  totalBranches: number;
  coveredBranches: number;
  totalFunctions: number;
  coveredFunctions: number;
  lastUpdatedAt: string;
}

export interface CoverageMatrixEntry {
  serviceName: string;
  unit: number;
  integration: number;
  e2e: number;
  smoke: number;
  overall: number;
}

export interface CoverageTrendPoint {
  date: string;
  lineCoveragePercent: number;
  branchCoveragePercent: number;
  functionCoveragePercent: number;
}

export interface CoverageFileNode {
  path: string;
  name: string;
  isDirectory: boolean;
  lineCoveragePercent: number;
  branchCoveragePercent: number;
  functionCoveragePercent: number;
  uncoveredLineRanges: string[];
  children: CoverageFileNode[];
}

export interface CoverageThreshold {
  id: string;
  metric: 'line' | 'branch' | 'function';
  warningPercent: number;
  failPercent: number;
  scope: string;
  updatedAt: string;
}

export interface CoverageThresholdUpdate {
  metric: 'line' | 'branch' | 'function';
  warningPercent: number;
  failPercent: number;
  scope: string;
}

export interface CoverageDashboard {
  overview: CoverageOverview;
  matrix: CoverageMatrixEntry[];
  trend: CoverageTrendPoint[];
  fileTree: CoverageFileNode[];
  thresholds: CoverageThreshold[];
  reports: CoverageReport[];
}

export interface CoverageReportRequest {
  projectName?: string;
  branch?: string;
  fromDate?: string;
  toDate?: string;
}

// ---------- Service ----------

const API_BASE = '/api/ops/coverage';

@Injectable({ providedIn: 'root' })
export class CoverageService {
  private readonly http = inject(HttpClient);

  readonly dashboard = signal<CoverageDashboard | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly overview = signal<CoverageOverview | null>(null);
  readonly matrix = signal<CoverageMatrixEntry[]>([]);
  readonly trend = signal<CoverageTrendPoint[]>([]);
  readonly fileTree = signal<CoverageFileNode[]>([]);
  readonly thresholds = signal<CoverageThreshold[]>([]);
  readonly reports = signal<CoverageReport[]>([]);
  readonly selectedReport = signal<CoverageReport | null>(null);
  readonly generatingReport = signal(false);

  readonly overallHealth = computed(() => {
    const ov = this.overview();
    if (!ov) return 'unknown';
    const thresholds = this.thresholds();
    const lineThreshold = thresholds.find((t) => t.metric === 'line');
    if (lineThreshold && ov.lineCoveragePercent < lineThreshold.failPercent) {
      return 'critical';
    }
    if (lineThreshold && ov.lineCoveragePercent < lineThreshold.warningPercent) {
      return 'warning';
    }
    return 'healthy';
  });

  readonly belowThresholdCount = computed(() => {
    const entries = this.matrix();
    const thresholds = this.thresholds();
    const lineThreshold = thresholds.find((t) => t.metric === 'line');
    if (!lineThreshold) return 0;
    return entries.filter((e) => e.overall < lineThreshold.failPercent).length;
  });

  loadDashboard(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http
      .get<CoverageDashboard>(`${API_BASE}/dashboard`)
      .pipe(
        tap((data) => {
          this.dashboard.set(data);
          this.overview.set(data.overview);
          this.matrix.set(data.matrix);
          this.trend.set(data.trend);
          this.fileTree.set(data.fileTree);
          this.thresholds.set(data.thresholds);
          this.reports.set(data.reports);
        }),
        catchError((err) => {
          this.error.set('Failed to load coverage dashboard.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  loadOverview(): void {
    this.loading.set(true);
    this.http
      .get<CoverageOverview>(`${API_BASE}/overview`)
      .pipe(
        tap((data) => this.overview.set(data)),
        catchError((err) => {
          this.error.set('Failed to load coverage overview.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  loadMatrix(): void {
    this.http
      .get<CoverageMatrixEntry[]>(`${API_BASE}/matrix`)
      .pipe(
        tap((data) => this.matrix.set(data)),
        catchError((err) => {
          this.error.set('Failed to load coverage matrix.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  loadTrend(days = 30): void {
    this.http
      .get<CoverageTrendPoint[]>(`${API_BASE}/trend`, {
        params: { days },
      })
      .pipe(
        tap((data) => this.trend.set(data)),
        catchError((err) => {
          this.error.set('Failed to load coverage trend.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  loadFileTree(project?: string): void {
    let params = new HttpParams();
    if (project) {
      params = params.set('project', project);
    }

    this.http
      .get<CoverageFileNode[]>(`${API_BASE}/files`, { params })
      .pipe(
        tap((data) => this.fileTree.set(data)),
        catchError((err) => {
          this.error.set('Failed to load file coverage tree.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  loadThresholds(): void {
    this.http
      .get<CoverageThreshold[]>(`${API_BASE}/thresholds`)
      .pipe(
        tap((data) => this.thresholds.set(data)),
        catchError((err) => {
          this.error.set('Failed to load coverage thresholds.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  updateThreshold(
    id: string,
    update: CoverageThresholdUpdate,
  ): Observable<CoverageThreshold> {
    return this.http
      .put<CoverageThreshold>(`${API_BASE}/thresholds/${id}`, update)
      .pipe(
        tap((updated) => {
          this.thresholds.update((list) =>
            list.map((t) => (t.id === id ? updated : t)),
          );
        }),
        catchError((err) => {
          this.error.set('Failed to update threshold.');
          return throwError(() => err);
        }),
      );
  }

  createThreshold(
    data: CoverageThresholdUpdate,
  ): Observable<CoverageThreshold> {
    return this.http
      .post<CoverageThreshold>(`${API_BASE}/thresholds`, data)
      .pipe(
        tap((created) => {
          this.thresholds.update((list) => [...list, created]);
        }),
        catchError((err) => {
          this.error.set('Failed to create threshold.');
          return throwError(() => err);
        }),
      );
  }

  deleteThreshold(id: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/thresholds/${id}`).pipe(
      tap(() => {
        this.thresholds.update((list) => list.filter((t) => t.id !== id));
      }),
      catchError((err) => {
        this.error.set('Failed to delete threshold.');
        return throwError(() => err);
      }),
    );
  }

  getReport(id: string): Observable<CoverageReport> {
    return this.http.get<CoverageReport>(`${API_BASE}/reports/${id}`).pipe(
      tap((report) => this.selectedReport.set(report)),
      catchError((err) => {
        this.error.set('Failed to load coverage report.');
        return throwError(() => err);
      }),
    );
  }

  generateReport(request: CoverageReportRequest): Observable<Blob> {
    this.generatingReport.set(true);
    return this.http
      .post(`${API_BASE}/reports/generate`, request, {
        responseType: 'blob',
      })
      .pipe(
        catchError((err) => {
          this.error.set('Failed to generate coverage report.');
          return throwError(() => err);
        }),
        finalize(() => this.generatingReport.set(false)),
      );
  }

  loadReports(filter?: CoverageReportRequest): void {
    let params = new HttpParams();
    if (filter?.projectName) {
      params = params.set('projectName', filter.projectName);
    }
    if (filter?.branch) {
      params = params.set('branch', filter.branch);
    }
    if (filter?.fromDate) {
      params = params.set('fromDate', filter.fromDate);
    }
    if (filter?.toDate) {
      params = params.set('toDate', filter.toDate);
    }

    this.http
      .get<CoverageReport[]>(`${API_BASE}/reports`, { params })
      .pipe(
        tap((data) => this.reports.set(data)),
        catchError((err) => {
          this.error.set('Failed to load coverage reports.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  clearError(): void {
    this.error.set(null);
  }

  clearSelection(): void {
    this.selectedReport.set(null);
  }
}
