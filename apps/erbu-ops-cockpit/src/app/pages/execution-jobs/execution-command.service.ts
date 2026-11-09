import { HttpClient } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable } from 'rxjs';

export const EXECUTION_COMMAND_API_URL = new InjectionToken<string>('EXECUTION_COMMAND_API_URL', {
  providedIn: 'root',
  factory: () => '/api/audit/execution-jobs',
});

export type ExecutionOperation =
  | 'E2E_RUN'
  | 'FACTORY_RUN'
  | 'MAESTRO_RUN'
  | 'PERF_RUN'
  | 'RESILIENCE_RUN'
  | 'STRYKER_RUN'
  | 'PACT_VERIFY'
  | 'BASELINE_VERIFY';

export interface ExecutionJobCreateRequest {
  requestId: string;
  operation: ExecutionOperation;
  arguments: Record<string, unknown>;
  requestedEnvironment: string;
}

export interface ExecutionJob {
  jobId: string;
  requestId: string;
  operation: ExecutionOperation;
  arguments: Record<string, unknown>;
  status: string;
  requestedBy: string;
  requestedEnvironment: string;
  createdAt: string;
  updatedAt: string;
  progress: Record<string, unknown> | null;
  refusal: string | null;
}

@Injectable({ providedIn: 'root' })
export class ExecutionCommandService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(EXECUTION_COMMAND_API_URL);

  create(request: ExecutionJobCreateRequest): Observable<ExecutionJob> {
    return this.http.post<ExecutionJob>(this.baseUrl, request);
  }

  get(jobId: string): Observable<ExecutionJob> {
    return this.http.get<ExecutionJob>(`${this.baseUrl}/${encodeURIComponent(jobId)}`);
  }

  cancel(jobId: string): Observable<void> {
    return this.http.post<void>(`${this.baseUrl}/${encodeURIComponent(jobId)}/cancel`, {});
  }
}
