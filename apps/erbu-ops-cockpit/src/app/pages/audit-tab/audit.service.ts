import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AuditScenario,
  AuditBaseline,
  AuditDiscrepancy,
  AuditCaptureConfig,
  AuditMissionControlStatus,
  BaselineComparison,
  BaselineDriftPoint,
} from '@erbu-admin-web/shared/models';

export interface RunScenarioRequest {
  scenarioId: string;
  baselineId?: string;
  captureMode?: string;
}

export interface UpdateCaptureConfigRequest {
  mode: string;
  isEnabled: boolean;
  filterPattern: string;
  scheduleExpression: string | null;
  retentionDays: number;
  maxSnapshotsPerRun: number;
  captureHeaders: boolean;
  capturePayloads: boolean;
  captureTimings: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/cockpit/audit';

  getScenarios(category?: string, status?: string): Observable<AuditScenario[]> {
    let params = new HttpParams();
    if (category) params = params.set('category', category);
    if (status) params = params.set('status', status);
    return this.http.get<AuditScenario[]>(`${this.baseUrl}/scenarios`, { params });
  }

  getScenarioById(id: string): Observable<AuditScenario> {
    return this.http.get<AuditScenario>(`${this.baseUrl}/scenarios/${id}`);
  }

  runScenario(request: RunScenarioRequest): Observable<AuditScenario> {
    return this.http.post<AuditScenario>(`${this.baseUrl}/scenarios/run`, request);
  }

  getDiscrepancies(scenarioId?: string, severity?: string): Observable<AuditDiscrepancy[]> {
    let params = new HttpParams();
    if (scenarioId) params = params.set('scenarioId', scenarioId);
    if (severity) params = params.set('severity', severity);
    return this.http.get<AuditDiscrepancy[]>(`${this.baseUrl}/discrepancies`, { params });
  }

  resolveDiscrepancy(id: string): Observable<AuditDiscrepancy> {
    return this.http.post<AuditDiscrepancy>(`${this.baseUrl}/discrepancies/${id}/resolve`, {});
  }

  getBaselines(scenarioId?: string): Observable<AuditBaseline[]> {
    let params = new HttpParams();
    if (scenarioId) params = params.set('scenarioId', scenarioId);
    return this.http.get<AuditBaseline[]>(`${this.baseUrl}/baselines`, { params });
  }

  getBaselineById(id: string): Observable<AuditBaseline> {
    return this.http.get<AuditBaseline>(`${this.baseUrl}/baselines/${id}`);
  }

  compareBaseline(baselineId: string): Observable<BaselineComparison> {
    return this.http.post<BaselineComparison>(
      `${this.baseUrl}/baselines/${baselineId}/compare`,
      {},
    );
  }

  getBaselineDriftHistory(
    baselineId: string,
    fromDate?: string,
    toDate?: string,
  ): Observable<BaselineDriftPoint[]> {
    let params = new HttpParams();
    if (fromDate) params = params.set('from', fromDate);
    if (toDate) params = params.set('to', toDate);
    return this.http.get<BaselineDriftPoint[]>(
      `${this.baseUrl}/baselines/${baselineId}/drift-history`,
      { params },
    );
  }

  getCaptureConfig(): Observable<AuditCaptureConfig[]> {
    return this.http.get<AuditCaptureConfig[]>(`${this.baseUrl}/capture-config`);
  }

  updateCaptureConfig(id: string, request: UpdateCaptureConfigRequest): Observable<AuditCaptureConfig> {
    return this.http.put<AuditCaptureConfig>(`${this.baseUrl}/capture-config/${id}`, request);
  }

  getMissionControlStatus(): Observable<AuditMissionControlStatus> {
    return this.http.get<AuditMissionControlStatus>(`${this.baseUrl}/mission-control`);
  }
}
