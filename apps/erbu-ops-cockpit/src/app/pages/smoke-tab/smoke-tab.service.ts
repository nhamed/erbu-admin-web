import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SmokeResult } from '@erbu-admin-web/shared/models';
import { Environment } from '@erbu-admin-web/shared/data-access';

const SMOKE_API = '/api/v1/cockpit/smoke';

@Injectable({ providedIn: 'root' })
export class SmokeTabService {
  private readonly http = inject(HttpClient);
  private readonly environment = inject<Environment>('ENVIRONMENT' as never);

  private url(path: string): string {
    return `${this.environment.gatewayUrl}${SMOKE_API}${path}`;
  }

  /** Trigger a full smoke-test run across all registered services. */
  runAll(): Observable<SmokeResult> {
    return this.http.post<SmokeResult>(this.url('/run'), null);
  }

  /** Get latest smoke results for every service. */
  getResults(): Observable<SmokeResult[]> {
    return this.http.get<SmokeResult[]>(this.url('/results'));
  }

  /** Get historical smoke runs (most-recent first). */
  getHistory(limit = 50): Observable<SmokeResult[]> {
    return this.http.get<SmokeResult[]>(this.url('/history'), {
      params: { limit },
    });
  }
}
