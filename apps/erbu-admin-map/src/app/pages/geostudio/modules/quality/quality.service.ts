import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  Observable,
  timer,
  switchMap,
  shareReplay,
  catchError,
  throwError,
  tap,
  finalize,
} from 'rxjs';
import {
  QualityReport,
  QualityReportType,
  QualityMetric,
  QualityIssue,
} from '@erbu-admin-web/shared/models';

// ---------- DTOs ----------

export interface QualityTestResult {
  id: string;
  testName: string;
  suite: string;
  status: 'Passed' | 'Failed' | 'Skipped' | 'Error';
  score: number;
  threshold: number;
  executedAt: string;
  durationMs: number;
  errorMessage: string | null;
  affectedQueries: number;
}

export interface RegressionAlert {
  id: string;
  metricName: string;
  previousValue: number;
  currentValue: number;
  changePercent: number;
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  detectedAt: string;
  isAcknowledged: boolean;
  description: string;
  affectedCollection: string;
}

export interface QueryCoverageMetric {
  category: string;
  totalQueries: number;
  coveredQueries: number;
  coveragePercent: number;
  avgRelevanceScore: number;
  trend: 'Rising' | 'Falling' | 'Stable';
}

export interface QualityTrendPoint {
  date: string;
  relevanceScore: number;
  coveragePercent: number;
  freshnessScore: number;
  consistencyScore: number;
}

export interface QualityDashboard {
  reports: QualityReport[];
  testResults: QualityTestResult[];
  regressionAlerts: RegressionAlert[];
  coverageMetrics: QueryCoverageMetric[];
  trendData: QualityTrendPoint[];
  overallScore: number;
  lastEvaluatedAt: string;
}

// ---------- Service ----------

const REFRESH_INTERVAL_MS = 30_000;
const API_BASE = '/api/geo/quality';

@Injectable({ providedIn: 'root' })
export class QualityService {
  private readonly http = inject(HttpClient);

  // ---------- state signals ----------
  readonly reports = signal<QualityReport[]>([]);
  readonly testResults = signal<QualityTestResult[]>([]);
  readonly regressionAlerts = signal<RegressionAlert[]>([]);
  readonly coverageMetrics = signal<QueryCoverageMetric[]>([]);
  readonly trendData = signal<QualityTrendPoint[]>([]);
  readonly overallScore = signal(0);
  readonly lastEvaluatedAt = signal<string>('');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedReportType = signal<QualityReportType | null>(null);

  // ---------- computed ----------
  readonly failedTests = computed(
    () => this.testResults().filter((t) => t.status === 'Failed' || t.status === 'Error'),
  );

  readonly unacknowledgedAlerts = computed(
    () => this.regressionAlerts().filter((a) => !a.isAcknowledged),
  );

  readonly criticalAlerts = computed(
    () => this.regressionAlerts().filter((a) => a.severity === 'Critical' && !a.isAcknowledged),
  );

  readonly filteredReports = computed(() => {
    const type = this.selectedReportType();
    if (!type) return this.reports();
    return this.reports().filter((r) => r.reportType === type);
  });

  readonly avgRelevanceScore = computed(() => {
    const metrics = this.coverageMetrics();
    if (metrics.length === 0) return 0;
    return metrics.reduce((sum, m) => sum + m.avgRelevanceScore, 0) / metrics.length;
  });

  readonly testPassRate = computed(() => {
    const tests = this.testResults();
    if (tests.length === 0) return 0;
    const passed = tests.filter((t) => t.status === 'Passed').length;
    return Math.round((passed / tests.length) * 100);
  });

  // ---------- polling ----------
  readonly dashboard$: Observable<QualityDashboard> = timer(0, REFRESH_INTERVAL_MS).pipe(
    switchMap(() => this.http.get<QualityDashboard>(`${API_BASE}/dashboard`)),
    tap((d) => this.applyDashboard(d)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  // ---------- commands ----------
  loadDashboard(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http
      .get<QualityDashboard>(`${API_BASE}/dashboard`)
      .pipe(
        tap((d) => this.applyDashboard(d)),
        catchError((err) => {
          this.error.set('Failed to load quality dashboard.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  fetchReports(
    reportType?: QualityReportType,
    limit = 50,
  ): Observable<QualityReport[]> {
    let params = new HttpParams().set('limit', limit.toString());
    if (reportType) params = params.set('reportType', reportType);

    return this.http.get<QualityReport[]>(`${API_BASE}/reports`, { params }).pipe(
      tap((reports) => this.reports.set(reports)),
      catchError((err) => {
        this.error.set('Failed to load quality reports.');
        return throwError(() => err);
      }),
    );
  }

  fetchTestResults(suite?: string): Observable<QualityTestResult[]> {
    let params = new HttpParams();
    if (suite) params = params.set('suite', suite);

    return this.http.get<QualityTestResult[]>(`${API_BASE}/tests`, { params }).pipe(
      tap((results) => this.testResults.set(results)),
      catchError((err) => {
        this.error.set('Failed to load test results.');
        return throwError(() => err);
      }),
    );
  }

  acknowledgeAlert(alertId: string): Observable<void> {
    return this.http.post<void>(`${API_BASE}/alerts/${alertId}/acknowledge`, {}).pipe(
      tap(() => {
        this.regressionAlerts.update((list) =>
          list.map((a) => (a.id === alertId ? { ...a, isAcknowledged: true } : a)),
        );
      }),
      catchError((err) => {
        this.error.set('Failed to acknowledge alert.');
        return throwError(() => err);
      }),
    );
  }

  runQualityTest(collectionId: string): Observable<QualityReport> {
    return this.http.post<QualityReport>(`${API_BASE}/run`, { collectionId }).pipe(
      catchError((err) => {
        this.error.set('Failed to run quality test.');
        return throwError(() => err);
      }),
    );
  }

  setReportTypeFilter(type: QualityReportType | null): void {
    this.selectedReportType.set(type);
  }

  clearError(): void {
    this.error.set(null);
  }

  // ---------- private ----------
  private applyDashboard(d: QualityDashboard): void {
    this.reports.set(d.reports);
    this.testResults.set(d.testResults);
    this.regressionAlerts.set(d.regressionAlerts);
    this.coverageMetrics.set(d.coverageMetrics);
    this.trendData.set(d.trendData);
    this.overallScore.set(d.overallScore);
    this.lastEvaluatedAt.set(d.lastEvaluatedAt);
    this.error.set(null);
  }
}
