import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject, debounceTime, distinctUntilChanged, switchMap, catchError, of, tap, shareReplay } from 'rxjs';
import { toObservable } from '@angular/core/rxjs-interop';
import { Environment } from '@erbu-admin-web/shared/data-access';

// ---------- DTOs ----------

export interface SearchResult {
  id: string;
  moduleId: string;
  moduleName: string;
  moduleIcon: string;
  title: string;
  description: string;
  route: string;
  relevanceScore: number;
  highlights: string[];
  entityType: string;
  metadata: Record<string, string>;
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  tookMs: number;
  suggestions: string[];
}

export interface RecentSearch {
  query: string;
  timestamp: number;
  resultCount: number;
}

const RECENT_SEARCHES_KEY = 'geo_studio_recent_searches';
const MAX_RECENT_SEARCHES = 10;

@Injectable({ providedIn: 'root' })
export class SearchAdminService {
  private readonly http = inject(HttpClient);
  private readonly env = inject<Environment>('ENVIRONMENT' as never);

  private readonly searchSubject = new Subject<string>();

  // ---------- State ----------
  readonly query = signal('');
  readonly loading = signal(false);
  readonly results = signal<SearchResult[]>([]);
  readonly totalCount = signal(0);
  readonly suggestions = signal<string[]>([]);
  readonly recentSearches = signal<RecentSearch[]>(this.loadRecentSearches());

  readonly hasResults = computed(() => this.results().length > 0);

  // ---------- Autocomplete stream ----------
  readonly autocomplete$ = this.searchSubject.pipe(
    debounceTime(250),
    distinctUntilChanged(),
    switchMap((q) => {
      if (!q || q.length < 2) {
        this.results.set([]);
        this.totalCount.set(0);
        this.suggestions.set([]);
        return of(null);
      }
      this.loading.set(true);
      return this.searchModules(q).pipe(
        tap((res) => {
          if (res) {
            this.results.set(res.results);
            this.totalCount.set(res.totalCount);
            this.suggestions.set(res.suggestions);
            this.addRecentSearch(q, res.totalCount);
          }
          this.loading.set(false);
        }),
        catchError(() => {
          this.loading.set(false);
          return of(null);
        }),
      );
    }),
    shareReplay(1),
  );

  // ---------- Public API ----------

  search(query: string): void {
    this.query.set(query);
    this.searchSubject.next(query);
  }

  searchModules(query: string, page = 0, pageSize = 20): Observable<SearchResponse> {
    const params = new HttpParams()
      .set('q', query)
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    return this.http.get<SearchResponse>(
      `${this.env.gatewayUrl}/api/geo-search/admin/search`,
      { params },
    );
  }

  clearSearch(): void {
    this.query.set('');
    this.results.set([]);
    this.totalCount.set(0);
    this.suggestions.set([]);
  }

  clearRecentSearches(): void {
    this.recentSearches.set([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  }

  // ---------- Internal ----------

  private addRecentSearch(query: string, resultCount: number): void {
    const recent = this.recentSearches().filter((r) => r.query !== query);
    recent.unshift({ query, timestamp: Date.now(), resultCount });
    const trimmed = recent.slice(0, MAX_RECENT_SEARCHES);
    this.recentSearches.set(trimmed);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(trimmed));
  }

  private loadRecentSearches(): RecentSearch[] {
    try {
      const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}
