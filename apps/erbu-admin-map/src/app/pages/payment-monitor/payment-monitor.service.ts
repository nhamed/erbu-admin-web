import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, timer, switchMap, shareReplay, map } from 'rxjs';
import {
  PaymentEvent,
  PaymentEventType,
  PaymentStatus,
  PaymentMonitor,
  PaymentAudit,
  DriverVirement,
  VirementStatus,
} from '@erbu-admin-web/shared/models';

// ---------- DTOs ----------

export interface PaymentKpi {
  totalVolume: number;
  totalVolumeChange: number;
  pendingCount: number;
  pendingCountChange: number;
  failedCount: number;
  failedCountChange: number;
  successRate: number;
  successRateChange: number;
  currency: string;
}

export interface PaymentVolumePoint {
  timestamp: string;
  volume: number;
  count: number;
  failureRate: number;
}

export interface PaymentDashboard {
  kpi: PaymentKpi;
  monitor: PaymentMonitor;
  volumeHistory: PaymentVolumePoint[];
}

export interface PaymentEventsFilter {
  type?: PaymentEventType | '';
  status?: PaymentStatus | '';
  dateFrom?: string;
  dateTo?: string;
  driverSearch?: string;
  page: number;
  pageSize: number;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface AuditFilter {
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
}

export interface VirementsFilter {
  status?: VirementStatus | '';
  driverSearch?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
}

// ---------- Service ----------

const REFRESH_INTERVAL_MS = 15_000;
const API_BASE = '/api/ops/payment-monitor';

@Injectable({ providedIn: 'root' })
export class PaymentMonitorService {
  private readonly http = inject(HttpClient);

  /**
   * Polls the payment-monitor dashboard endpoint every 15 seconds.
   * Subscribers share a single HTTP stream (shareReplay).
   */
  readonly dashboard$: Observable<PaymentDashboard> = timer(
    0,
    REFRESH_INTERVAL_MS,
  ).pipe(
    switchMap(() => this.http.get<any>(`${API_BASE}/dashboard`)),
    map(raw => this.mapDashboard(raw)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  private mapDashboard(raw: any): PaymentDashboard {
    if (raw.kpi) return raw;
    const h = raw.periods?.lastHour ?? {};
    const d = raw.periods?.last24h ?? {};
    return {
      kpi: {
        totalVolume: raw.totals?.captured ?? 0,
        totalVolumeChange: 0,
        pendingCount: h.byStatus?.['Pending'] ?? 0,
        pendingCountChange: 0,
        failedCount: h.byStatus?.['Failed'] ?? 0,
        failedCountChange: 0,
        successRate: (d.successRate ?? 1) * 100,
        successRateChange: 0,
        currency: 'TND',
      },
      monitor: {
        activeAlerts: raw.activeAlerts ?? 0,
        pipelineHealth: raw.pipelineHealth ?? 'Unknown',
        lastUpdated: raw.timestamp ?? new Date().toISOString(),
      } as any,
      volumeHistory: [],
    };
  }

  /** Fetch KPI only. */
  fetchKpi(): Observable<PaymentKpi> {
    return this.dashboard$.pipe(map((d) => d.kpi));
  }

  /** Fetch payment events with filters and pagination. */
  fetchPaymentEvents(
    filter: PaymentEventsFilter,
  ): Observable<PagedResult<PaymentEvent>> {
    let params = new HttpParams()
      .set('page', filter.page)
      .set('pageSize', filter.pageSize);
    if (filter.type) params = params.set('type', filter.type);
    if (filter.status) params = params.set('status', filter.status);
    if (filter.dateFrom) params = params.set('dateFrom', filter.dateFrom);
    if (filter.dateTo) params = params.set('dateTo', filter.dateTo);
    if (filter.driverSearch)
      params = params.set('driverSearch', filter.driverSearch);

    return this.http.get<PagedResult<PaymentEvent>>(`${API_BASE}/events`, {
      params,
    });
  }

  /** Fetch a single payment event by ID. */
  fetchPaymentEventById(id: string): Observable<PaymentEvent> {
    return this.http.get<PaymentEvent>(`${API_BASE}/events/${id}`);
  }

  /** Fetch audit log entries with filters and pagination. */
  fetchAuditLog(filter: AuditFilter): Observable<PagedResult<PaymentAudit>> {
    let params = new HttpParams()
      .set('page', filter.page)
      .set('pageSize', filter.pageSize);
    if (filter.entityType) params = params.set('entityType', filter.entityType);
    if (filter.dateFrom) params = params.set('dateFrom', filter.dateFrom);
    if (filter.dateTo) params = params.set('dateTo', filter.dateTo);

    return this.http.get<PagedResult<PaymentAudit>>(`${API_BASE}/audit`, {
      params,
    });
  }

  /** Fetch driver virements with filters and pagination. */
  fetchDriverVirements(
    filter: VirementsFilter,
  ): Observable<PagedResult<DriverVirement>> {
    let params = new HttpParams()
      .set('page', filter.page)
      .set('pageSize', filter.pageSize);
    if (filter.status) params = params.set('status', filter.status);
    if (filter.driverSearch)
      params = params.set('driverSearch', filter.driverSearch);
    if (filter.dateFrom) params = params.set('dateFrom', filter.dateFrom);
    if (filter.dateTo) params = params.set('dateTo', filter.dateTo);

    return this.http.get<PagedResult<DriverVirement>>(
      `${API_BASE}/virements`,
      { params },
    );
  }

  /** Fetch volume history for custom date range. */
  fetchVolumeHistory(
    from: string,
    to: string,
  ): Observable<PaymentVolumePoint[]> {
    return this.http.get<PaymentVolumePoint[]>(`${API_BASE}/volume`, {
      params: { from, to },
    });
  }
}
