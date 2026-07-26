import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  E2ETestRun,
  E2EPlatform,
  SmokeStatus,
  CoverageReport,
} from '@erbu-admin-web/shared/models';

// ---------- DTOs ----------

export interface E2ELaunchRequest {
  suiteIds: string[];
  deviceIds: string[];
  environment: string;
  testFilter: string;
  parallelCount: number;
  platform: E2EPlatform;
  tags: string[];
  retryFailedCount: number;
  recordVideo: boolean;
  captureScreenshots: boolean;
}

export interface E2ETestSuite {
  id: string;
  name: string;
  description: string;
  platform: E2EPlatform;
  testCount: number;
  avgDurationSeconds: number;
  lastStatus: SmokeStatus | null;
  lastRunAt: string | null;
  tags: string[];
}

export interface E2ELogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  testName: string;
  message: string;
  deviceId: string;
}

export interface E2EResultsSummary {
  runId: string;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationSeconds: number;
  passRate: number;
  coverageImpact: CoverageImpact | null;
  regressions: E2ERegression[];
}

export interface CoverageImpact {
  before: number;
  after: number;
  delta: number;
  newlyCoveredFiles: string[];
  lostCoverageFiles: string[];
}

export interface E2ERegression {
  testName: string;
  previousStatus: SmokeStatus;
  currentStatus: SmokeStatus;
  firstFailedAt: string;
  failureCount: number;
}

export interface E2ESuitesPage {
  items: E2ETestSuite[];
  total: number;
}

// ---------- Service ----------

const API_BASE = '/api/ops/e2e';

@Injectable({ providedIn: 'root' })
export class E2EService {
  private readonly http = inject(HttpClient);

  /** List all available E2E test suites. */
  listSuites(
    platform?: E2EPlatform,
    search?: string,
  ): Observable<E2ESuitesPage> {
    let params = new HttpParams();
    if (platform) {
      params = params.set('platform', platform);
    }
    if (search) {
      params = params.set('search', search);
    }
    return this.http.get<E2ESuitesPage>(`${API_BASE}/suites`, { params });
  }

  /** Launch a new E2E test run. */
  launchTests(request: E2ELaunchRequest): Observable<E2ETestRun> {
    return this.http.post<E2ETestRun>(`${API_BASE}/launch`, request);
  }

  /** Get a specific test run by ID. */
  getRun(runId: string): Observable<E2ETestRun> {
    return this.http.get<E2ETestRun>(
      `${API_BASE}/runs/${encodeURIComponent(runId)}`,
    );
  }

  /** Get recent test runs. */
  getResults(limit = 50): Observable<E2ETestRun[]> {
    return this.http.get<E2ETestRun[]>(`${API_BASE}/runs`, {
      params: { limit },
    });
  }

  /** Get live log stream for an active run. */
  getLogs(runId: string, offset = 0): Observable<E2ELogEntry[]> {
    return this.http.get<E2ELogEntry[]>(
      `${API_BASE}/runs/${encodeURIComponent(runId)}/logs`,
      { params: { offset } },
    );
  }

  /** Get results summary with coverage impact and regressions. */
  getResultsSummary(runId: string): Observable<E2EResultsSummary> {
    return this.http.get<E2EResultsSummary>(
      `${API_BASE}/runs/${encodeURIComponent(runId)}/summary`,
    );
  }

  /** Get latest coverage report. */
  getCoverage(): Observable<CoverageReport> {
    return this.http.get<CoverageReport>(`${API_BASE}/coverage`);
  }

  /** Abort a running test. */
  abortRun(runId: string): Observable<void> {
    return this.http.post<void>(
      `${API_BASE}/runs/${encodeURIComponent(runId)}/abort`,
      null,
    );
  }

  /** Get regression history. */
  getRegressions(days = 30): Observable<E2ERegression[]> {
    return this.http.get<E2ERegression[]>(`${API_BASE}/regressions`, {
      params: { days },
    });
  }
}
