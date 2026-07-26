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

export type QuerySyntax = 'simple' | 'lucene' | 'kql';

export interface SearchExplorerRequest {
  query: string;
  syntax: QuerySyntax;
  index: string;
  filters: Record<string, string[]>;
  page: number;
  pageSize: number;
  explain: boolean;
  rankingProfile: string | null;
  highlightFields: string[];
  facetFields: string[];
}

export interface SearchHit {
  id: string;
  index: string;
  score: number;
  source: Record<string, unknown>;
  highlights: Record<string, string[]>;
  explanation: ExplanationNode | null;
}

export interface ExplanationNode {
  description: string;
  value: number;
  details: ExplanationNode[];
}

export interface FacetBucket {
  key: string;
  count: number;
}

export interface FacetResult {
  field: string;
  buckets: FacetBucket[];
  total: number;
}

export interface SearchExplorerResponse {
  hits: SearchHit[];
  totalHits: number;
  tookMs: number;
  maxScore: number;
  facets: FacetResult[];
  suggestions: string[];
  parsedQuery: string;
}

export interface IndexInfo {
  name: string;
  documentCount: number;
  sizeBytes: number;
  fields: IndexFieldInfo[];
}

export interface IndexFieldInfo {
  name: string;
  type: string;
  isSearchable: boolean;
  isFacetable: boolean;
  isSortable: boolean;
}

export interface SavedQuery {
  id: string;
  name: string;
  query: string;
  syntax: QuerySyntax;
  index: string;
  filters: Record<string, string[]>;
  createdAt: string;
  createdBy: string;
}

// ---------- Service ----------

const API_BASE = '/api/geo/search-explorer';

@Injectable({ providedIn: 'root' })
export class SearchExplorerService {
  private readonly http = inject(HttpClient);

  // ---------- state signals ----------
  readonly hits = signal<SearchHit[]>([]);
  readonly totalHits = signal(0);
  readonly tookMs = signal(0);
  readonly maxScore = signal(0);
  readonly facets = signal<FacetResult[]>([]);
  readonly suggestions = signal<string[]>([]);
  readonly parsedQuery = signal('');
  readonly indices = signal<IndexInfo[]>([]);
  readonly savedQueries = signal<SavedQuery[]>([]);
  readonly selectedHit = signal<SearchHit | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // query state
  readonly query = signal('');
  readonly syntax = signal<QuerySyntax>('simple');
  readonly selectedIndex = signal('');
  readonly explainMode = signal(false);
  readonly activeFilters = signal<Record<string, string[]>>({});
  readonly currentPage = signal(1);
  readonly pageSize = signal(20);

  // ---------- computed ----------
  readonly hasResults = computed(() => this.hits().length > 0);
  readonly totalPages = computed(() => Math.ceil(this.totalHits() / this.pageSize()));

  readonly availableFields = computed(() => {
    const idx = this.selectedIndex();
    const index = this.indices().find((i) => i.name === idx);
    return index?.fields ?? [];
  });

  readonly searchableFields = computed(() =>
    this.availableFields().filter((f) => f.isSearchable),
  );

  readonly facetableFields = computed(() =>
    this.availableFields().filter((f) => f.isFacetable),
  );

  readonly activeFilterCount = computed(() => {
    const filters = this.activeFilters();
    return Object.values(filters).reduce((sum, arr) => sum + arr.length, 0);
  });

  // ---------- commands ----------

  /** Execute a search query. */
  executeSearch(): void {
    const q = this.query().trim();
    if (!q) return;

    this.loading.set(true);
    this.error.set(null);

    const request: SearchExplorerRequest = {
      query: q,
      syntax: this.syntax(),
      index: this.selectedIndex(),
      filters: this.activeFilters(),
      page: this.currentPage(),
      pageSize: this.pageSize(),
      explain: this.explainMode(),
      rankingProfile: null,
      highlightFields: this.searchableFields().map((f) => f.name),
      facetFields: this.facetableFields().map((f) => f.name),
    };

    this.http
      .post<SearchExplorerResponse>(`${API_BASE}/search`, request)
      .pipe(
        tap((res) => this.applySearchResults(res)),
        catchError((err) => {
          this.error.set('Search query failed.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  /** Load available indices. */
  loadIndices(): void {
    this.http
      .get<IndexInfo[]>(`${API_BASE}/indices`)
      .pipe(
        tap((indices) => {
          this.indices.set(indices);
          if (indices.length > 0 && !this.selectedIndex()) {
            this.selectedIndex.set(indices[0].name);
          }
        }),
        catchError((err) => {
          this.error.set('Failed to load indices.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  /** Load saved queries. */
  loadSavedQueries(): void {
    this.http
      .get<SavedQuery[]>(`${API_BASE}/saved-queries`)
      .pipe(
        tap((queries) => this.savedQueries.set(queries)),
        catchError((err) => {
          this.error.set('Failed to load saved queries.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  /** Save the current query. */
  saveQuery(name: string): Observable<SavedQuery> {
    const payload = {
      name,
      query: this.query(),
      syntax: this.syntax(),
      index: this.selectedIndex(),
      filters: this.activeFilters(),
    };

    return this.http.post<SavedQuery>(`${API_BASE}/saved-queries`, payload).pipe(
      tap((saved) => {
        this.savedQueries.update((list) => [saved, ...list]);
      }),
      catchError((err) => {
        this.error.set('Failed to save query.');
        return throwError(() => err);
      }),
    );
  }

  /** Delete a saved query. */
  deleteSavedQuery(queryId: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/saved-queries/${queryId}`).pipe(
      tap(() => {
        this.savedQueries.update((list) => list.filter((q) => q.id !== queryId));
      }),
      catchError((err) => {
        this.error.set('Failed to delete saved query.');
        return throwError(() => err);
      }),
    );
  }

  /** Load a saved query into the explorer. */
  applySavedQuery(saved: SavedQuery): void {
    this.query.set(saved.query);
    this.syntax.set(saved.syntax);
    this.selectedIndex.set(saved.index);
    this.activeFilters.set(saved.filters);
    this.currentPage.set(1);
    this.executeSearch();
  }

  // ---------- filter management ----------

  addFilter(field: string, value: string): void {
    this.activeFilters.update((filters) => {
      const existing = filters[field] ?? [];
      if (existing.includes(value)) return filters;
      return { ...filters, [field]: [...existing, value] };
    });
  }

  removeFilter(field: string, value: string): void {
    this.activeFilters.update((filters) => {
      const existing = filters[field] ?? [];
      const updated = existing.filter((v) => v !== value);
      if (updated.length === 0) {
        const { [field]: _, ...rest } = filters;
        return rest;
      }
      return { ...filters, [field]: updated };
    });
  }

  clearFilters(): void {
    this.activeFilters.set({});
  }

  // ---------- pagination ----------

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.executeSearch();
  }

  // ---------- selection ----------

  selectHit(hit: SearchHit | null): void {
    this.selectedHit.set(hit);
  }

  // ---------- state management ----------

  setQuery(q: string): void {
    this.query.set(q);
  }

  setSyntax(syntax: QuerySyntax): void {
    this.syntax.set(syntax);
  }

  setIndex(index: string): void {
    this.selectedIndex.set(index);
    this.activeFilters.set({});
    this.currentPage.set(1);
  }

  toggleExplain(): void {
    this.explainMode.update((v) => !v);
  }

  clearResults(): void {
    this.hits.set([]);
    this.totalHits.set(0);
    this.tookMs.set(0);
    this.maxScore.set(0);
    this.facets.set([]);
    this.suggestions.set([]);
    this.parsedQuery.set('');
    this.selectedHit.set(null);
  }

  clearError(): void {
    this.error.set(null);
  }

  // ---------- private ----------
  private applySearchResults(res: SearchExplorerResponse): void {
    this.hits.set(res.hits);
    this.totalHits.set(res.totalHits);
    this.tookMs.set(res.tookMs);
    this.maxScore.set(res.maxScore);
    this.facets.set(res.facets);
    this.suggestions.set(res.suggestions);
    this.parsedQuery.set(res.parsedQuery);
    this.error.set(null);
  }
}
