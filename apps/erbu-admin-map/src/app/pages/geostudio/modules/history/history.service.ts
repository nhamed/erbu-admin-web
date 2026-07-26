import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  Observable,
  catchError,
  throwError,
  tap,
  finalize,
} from 'rxjs';

// ---------- DTOs ----------

export interface QueryHistoryEntry {
  id: string;
  queryText: string;
  index: string;
  userId: string | null;
  userName: string | null;
  resultCount: number;
  tookMs: number;
  executedAt: string;
  statusCode: number;
  rankingProfile: string | null;
  filters: Record<string, string>;
  source: string;
  correlationId: string | null;
}

export interface HistorySearchParams {
  query: string | null;
  userId: string | null;
  index: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  minLatencyMs: number | null;
  maxLatencyMs: number | null;
  statusCode: number | null;
  page: number;
  pageSize: number;
  sortBy: HistorySortField;
  sortDirection: 'asc' | 'desc';
}

export type HistorySortField = 'executedAt' | 'tookMs' | 'resultCount' | 'queryText';

export interface HistorySearchResponse {
  items: QueryHistoryEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface QueryVolumePoint {
  timestamp: string;
  count: number;
  avgLatencyMs: number;
  errorCount: number;
  p95LatencyMs: number;
}

export interface HistoryStats {
  totalQueries: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  errorRate: number;
  uniqueUsers: number;
  topQueries: TopQueryEntry[];
  queryVolume: QueryVolumePoint[];
  slowQueries: QueryHistoryEntry[];
}

export interface TopQueryEntry {
  queryText: string;
  count: number;
  avgLatencyMs: number;
  avgResultCount: number;
}

export interface HistoryDashboard {
  stats: HistoryStats;
  recentQueries: QueryHistoryEntry[];
  lastUpdatedAt: string;
}

export interface ReplayResult {
  originalEntry: QueryHistoryEntry;
  replayedResultCount: number;
  replayedTookMs: number;
  resultCountDelta: number;
  latencyDelta: number;
  isConsistent: boolean;
}

// ---------- Service ----------

const API_BASE = '/api/geo/history';

@Injectable({ providedIn: 'root' })
export class HistoryService {
  private readonly http = inject(HttpClient);

  // ---------- state signals ----------
  readonly entries = signal<QueryHistoryEntry[]>([]);
  readonly totalEntries = signal(0);
  readonly stats = signal<HistoryStats | null>(null);
  readonly replayResult = signal<ReplayResult | null>(null);
  readonly selectedEntry = signal<QueryHistoryEntry | null>(null);
  readonly loading = signal(false);
  readonly replayLoading = signal(false);
  readonly error = signal<string | null>(null);

  // filter state
  readonly searchQuery = signal('');
  readonly filterUserId = signal<string | null>(null);
  readonly filterIndex = signal<string | null>(null);
  readonly filterDateFrom = signal<string | null>(null);
  readonly filterDateTo = signal<string | null>(null);
  readonly filterMinLatency = signal<number | null>(null);
  readonly filterMaxLatency = signal<number | null>(null);
  readonly currentPage = signal(1);
  readonly pageSize = signal(50);
  readonly sortBy = signal<HistorySortField>('executedAt');
  readonly sortDirection = signal<'asc' | 'desc'>('desc');

  // chart state
  readonly volumeData = signal<QueryVolumePoint[]>([]);
  readonly topQueries = signal<TopQueryEntry[]>([]);
  readonly slowQueries = signal<QueryHistoryEntry[]>([]);

  // ---------- computed ----------
  readonly totalPages = computed(() => Math.ceil(this.totalEntries() / this.pageSize()));

  readonly hasFilters = computed(() =>
    !!(this.searchQuery() || this.filterUserId() || this.filterIndex() ||
       this.filterDateFrom() || this.filterDateTo() ||
       this.filterMinLatency() || this.filterMaxLatency()),
  );

  readonly avgLatency = computed(() => {
    const s = this.stats();
    return s ? s.avgLatencyMs : 0;
  });

  readonly errorRate = computed(() => {
    const s = this.stats();
    return s ? s.errorRate : 0;
  });

  readonly kpiCards = computed(() => {
    const s = this.stats();
    if (!s) return [];
    return [
      { label: 'Total Queries', value: this.formatNumber(s.totalQueries), icon: 'search', cssClass: 'kpi-total' },
      { label: 'Avg Latency', value: s.avgLatencyMs.toFixed(1), icon: 'timer', cssClass: 'kpi-latency', suffix: 'ms' },
      { label: 'P95 Latency', value: s.p95LatencyMs.toFixed(1), icon: 'speed', cssClass: 'kpi-p95', suffix: 'ms' },
      { label: 'P99 Latency', value: s.p99LatencyMs.toFixed(1), icon: 'trending_up', cssClass: 'kpi-p99', suffix: 'ms' },
      { label: 'Error Rate', value: s.errorRate.toFixed(2), icon: 'error_outline', cssClass: s.errorRate > 1 ? 'kpi-error-high' : 'kpi-error-low', suffix: '%' },
      { label: 'Unique Users', value: s.uniqueUsers.toString(), icon: 'people', cssClass: 'kpi-users' },
    ];
  });

  // ---------- commands ----------

  /** Load the history dashboard (stats + recent). */
  loadDashboard(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http
      .get<HistoryDashboard>(`${API_BASE}/dashboard`)
      .pipe(
        tap((d) => {
          this.stats.set(d.stats);
          this.entries.set(d.recentQueries);
          this.totalEntries.set(d.stats.totalQueries);
          this.volumeData.set(d.stats.queryVolume);
          this.topQueries.set(d.stats.topQueries);
          this.slowQueries.set(d.stats.slowQueries);
        }),
        catchError((err) => {
          this.error.set('Failed to load history dashboard.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  /** Search history entries with current filters. */
  searchHistory(): void {
    this.loading.set(true);
    this.error.set(null);

    let params = new HttpParams()
      .set('page', this.currentPage().toString())
      .set('pageSize', this.pageSize().toString())
      .set('sortBy', this.sortBy())
      .set('sortDirection', this.sortDirection());

    const q = this.searchQuery().trim();
    if (q) params = params.set('query', q);
    if (this.filterUserId()) params = params.set('userId', this.filterUserId()!);
    if (this.filterIndex()) params = params.set('index', this.filterIndex()!);
    if (this.filterDateFrom()) params = params.set('dateFrom', this.filterDateFrom()!);
    if (this.filterDateTo()) params = params.set('dateTo', this.filterDateTo()!);
    if (this.filterMinLatency() !== null) params = params.set('minLatencyMs', this.filterMinLatency()!.toString());
    if (this.filterMaxLatency() !== null) params = params.set('maxLatencyMs', this.filterMaxLatency()!.toString());

    this.http
      .get<HistorySearchResponse>(`${API_BASE}/search`, { params })
      .pipe(
        tap((res) => {
          this.entries.set(res.items);
          this.totalEntries.set(res.total);
        }),
        catchError((err) => {
          this.error.set('Failed to search history.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  /** Replay a historical query. */
  replayQuery(entryId: string): void {
    this.replayLoading.set(true);
    this.replayResult.set(null);

    this.http
      .post<ReplayResult>(`${API_BASE}/replay/${entryId}`, {})
      .pipe(
        tap((res) => this.replayResult.set(res)),
        catchError((err) => {
          this.error.set('Failed to replay query.');
          return throwError(() => err);
        }),
        finalize(() => this.replayLoading.set(false)),
      )
      .subscribe();
  }

  /** Fetch query volume chart data for a date range. */
  loadVolumeData(from: string, to: string, granularity: string = 'hour'): void {
    const params = new HttpParams()
      .set('from', from)
      .set('to', to)
      .set('granularity', granularity);

    this.http
      .get<QueryVolumePoint[]>(`${API_BASE}/volume`, { params })
      .pipe(
        tap((data) => this.volumeData.set(data)),
        catchError((err) => {
          this.error.set('Failed to load volume data.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  // ---------- filter management ----------

  setSearchQuery(q: string): void {
    this.searchQuery.set(q);
  }

  setFilterUserId(userId: string | null): void {
    this.filterUserId.set(userId);
  }

  setFilterIndex(index: string | null): void {
    this.filterIndex.set(index);
  }

  setDateRange(from: string | null, to: string | null): void {
    this.filterDateFrom.set(from);
    this.filterDateTo.set(to);
  }

  setLatencyRange(min: number | null, max: number | null): void {
    this.filterMinLatency.set(min);
    this.filterMaxLatency.set(max);
  }

  setSortBy(field: HistorySortField): void {
    if (this.sortBy() === field) {
      this.sortDirection.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortBy.set(field);
      this.sortDirection.set('desc');
    }
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.searchHistory();
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.filterUserId.set(null);
    this.filterIndex.set(null);
    this.filterDateFrom.set(null);
    this.filterDateTo.set(null);
    this.filterMinLatency.set(null);
    this.filterMaxLatency.set(null);
    this.currentPage.set(1);
  }

  selectEntry(entry: QueryHistoryEntry | null): void {
    this.selectedEntry.set(entry);
    this.replayResult.set(null);
  }

  clearError(): void {
    this.error.set(null);
  }

  // ---------- private ----------
  private formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  }
}
