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

export type FeatureDataType =
  | 'Float32'
  | 'Float64'
  | 'Int32'
  | 'Int64'
  | 'String'
  | 'Boolean'
  | 'Vector'
  | 'Embedding';

export type FreshnessStatus = 'Fresh' | 'Stale' | 'Expired' | 'Unknown';

export interface Feature {
  id: string;
  name: string;
  group: string;
  dataType: FeatureDataType;
  dimensions: number | null;
  description: string;
  source: string;
  freshnessStatus: FreshnessStatus;
  lastComputedAt: string;
  ttlSeconds: number;
  rowCount: number;
  nullPercentage: number;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  version: number;
}

export interface FeatureStats {
  featureId: string;
  mean: number | null;
  median: number | null;
  stdDev: number | null;
  min: number | null;
  max: number | null;
  p25: number | null;
  p75: number | null;
  p95: number | null;
  p99: number | null;
  distinctCount: number;
  nullCount: number;
  totalCount: number;
  histogram: HistogramBucket[];
}

export interface HistogramBucket {
  bucketStart: number;
  bucketEnd: number;
  count: number;
}

export interface FeatureImportance {
  featureId: string;
  featureName: string;
  importance: number;
  rank: number;
}

export interface FeatureGroup {
  name: string;
  featureCount: number;
  totalRows: number;
  lastUpdatedAt: string;
}

export interface FeatureStoreSummary {
  totalFeatures: number;
  totalGroups: number;
  freshCount: number;
  staleCount: number;
  expiredCount: number;
  totalRows: number;
  avgNullPercentage: number;
  importanceRanking: FeatureImportance[];
  groups: FeatureGroup[];
}

export interface FeatureListResponse {
  items: Feature[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------- Service ----------

const API_BASE = '/api/admin/geo/feature-store';

@Injectable({ providedIn: 'root' })
export class FeatureStoreService {
  private readonly http = inject(HttpClient);

  // ---------- state signals ----------
  readonly features = signal<Feature[]>([]);
  readonly selectedFeature = signal<Feature | null>(null);
  readonly featureStats = signal<FeatureStats | null>(null);
  readonly summary = signal<FeatureStoreSummary>({
    totalFeatures: 0,
    totalGroups: 0,
    freshCount: 0,
    staleCount: 0,
    expiredCount: 0,
    totalRows: 0,
    avgNullPercentage: 0,
    importanceRanking: [],
    groups: [],
  });
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly totalItems = signal(0);
  readonly currentPage = signal(1);
  readonly pageSize = signal(25);

  // filters
  readonly filterGroup = signal<string | null>(null);
  readonly filterFreshness = signal<FreshnessStatus | null>(null);
  readonly searchQuery = signal('');

  // ---------- computed ----------
  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalItems() / this.pageSize())),
  );

  readonly groups = computed(() =>
    this.summary().groups.map((g) => g.name).sort(),
  );

  readonly freshnessBreakdown = computed(() => {
    const s = this.summary();
    return [
      { status: 'Fresh' as FreshnessStatus, count: s.freshCount, cssClass: 'freshness-fresh' },
      { status: 'Stale' as FreshnessStatus, count: s.staleCount, cssClass: 'freshness-stale' },
      { status: 'Expired' as FreshnessStatus, count: s.expiredCount, cssClass: 'freshness-expired' },
    ];
  });

  readonly filteredFeatures = computed(() => {
    let result = this.features();
    const group = this.filterGroup();
    const freshness = this.filterFreshness();
    const query = this.searchQuery().toLowerCase();

    if (group) {
      result = result.filter((f) => f.group === group);
    }
    if (freshness) {
      result = result.filter((f) => f.freshnessStatus === freshness);
    }
    if (query) {
      result = result.filter(
        (f) =>
          f.name.toLowerCase().includes(query) ||
          f.description.toLowerCase().includes(query) ||
          f.group.toLowerCase().includes(query),
      );
    }
    return result;
  });

  // ---------- queries ----------

  /** Load feature list with pagination. */
  loadFeatures(page = 1, pageSize = 25): void {
    this.loading.set(true);
    this.error.set(null);
    this.currentPage.set(page);
    this.pageSize.set(pageSize);

    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    const group = this.filterGroup();
    if (group) params = params.set('group', group);

    const freshness = this.filterFreshness();
    if (freshness) params = params.set('freshness', freshness);

    const query = this.searchQuery();
    if (query) params = params.set('q', query);

    this.http
      .get<FeatureListResponse>(`${API_BASE}/features`, { params })
      .pipe(
        tap((res) => {
          this.features.set(res.items);
          this.totalItems.set(res.total);
        }),
        catchError((err) => {
          this.error.set('Failed to load features.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  /** Load the feature store summary. */
  loadSummary(): void {
    this.http
      .get<FeatureStoreSummary>(`${API_BASE}/summary`)
      .pipe(
        tap((s) => this.summary.set(s)),
        catchError((err) => {
          this.error.set('Failed to load feature store summary.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  /** Load stats for a single feature. */
  loadFeatureStats(featureId: string): void {
    this.http
      .get<FeatureStats>(`${API_BASE}/features/${featureId}/stats`)
      .pipe(
        tap((s) => this.featureStats.set(s)),
        catchError((err) => {
          this.error.set('Failed to load feature statistics.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  /** Get a single feature by ID. */
  getFeature(featureId: string): Observable<Feature> {
    return this.http.get<Feature>(`${API_BASE}/features/${featureId}`).pipe(
      catchError((err) => {
        this.error.set('Failed to load feature details.');
        return throwError(() => err);
      }),
    );
  }

  // ---------- selection ----------

  selectFeature(feature: Feature | null): void {
    this.selectedFeature.set(feature);
    this.featureStats.set(null);
    if (feature) {
      this.loadFeatureStats(feature.id);
    }
  }

  // ---------- filter actions ----------

  setGroupFilter(group: string | null): void {
    this.filterGroup.set(group);
  }

  setFreshnessFilter(freshness: FreshnessStatus | null): void {
    this.filterFreshness.set(freshness);
  }

  setSearchQuery(query: string): void {
    this.searchQuery.set(query);
  }

  clearError(): void {
    this.error.set(null);
  }
}
