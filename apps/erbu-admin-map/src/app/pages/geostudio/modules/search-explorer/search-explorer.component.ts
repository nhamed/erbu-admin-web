import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  SearchExplorerService,
  SearchHit,
  FacetResult,
  FacetBucket,
  ExplanationNode,
  IndexInfo,
  SavedQuery,
  QuerySyntax,
} from './search-explorer.service';

@Component({
  selector: 'app-search-explorer',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './search-explorer.component.html',
  styleUrl: './search-explorer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchExplorerComponent implements OnInit, OnDestroy {
  private readonly svc = inject(SearchExplorerService);
  private readonly destroyRef = inject(DestroyRef);

  // ---------- delegated from service ----------
  readonly loading = this.svc.loading;
  readonly error = this.svc.error;
  readonly hits = this.svc.hits;
  readonly totalHits = this.svc.totalHits;
  readonly tookMs = this.svc.tookMs;
  readonly maxScore = this.svc.maxScore;
  readonly facets = this.svc.facets;
  readonly suggestions = this.svc.suggestions;
  readonly parsedQuery = this.svc.parsedQuery;
  readonly indices = this.svc.indices;
  readonly savedQueries = this.svc.savedQueries;
  readonly selectedHit = this.svc.selectedHit;
  readonly hasResults = this.svc.hasResults;
  readonly totalPages = this.svc.totalPages;
  readonly currentPage = this.svc.currentPage;
  readonly explainMode = this.svc.explainMode;
  readonly activeFilters = this.svc.activeFilters;
  readonly activeFilterCount = this.svc.activeFilterCount;
  readonly searchableFields = this.svc.searchableFields;
  readonly facetableFields = this.svc.facetableFields;

  // ---------- local UI state ----------
  readonly queryInput = signal('');
  readonly selectedSyntax = signal<QuerySyntax>('simple');
  readonly selectedIndex = signal('');
  readonly showSavedQueries = signal(false);
  readonly saveQueryName = signal('');
  readonly showSaveDialog = signal(false);
  readonly showExplanation = signal(false);

  readonly syntaxOptions: { value: QuerySyntax; label: string }[] = [
    { value: 'simple', label: 'Simple' },
    { value: 'lucene', label: 'Lucene' },
    { value: 'kql', label: 'KQL' },
  ];

  // ---------- computed ----------
  readonly resultSummary = computed(() => {
    if (!this.hasResults()) return '';
    return `${this.totalHits()} results in ${this.tookMs()}ms`;
  });

  readonly pageRange = computed(() => {
    const total = this.totalPages();
    const current = this.currentPage();
    const range: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    return range;
  });

  readonly activeFilterEntries = computed(() => {
    const filters = this.activeFilters();
    const entries: { field: string; value: string }[] = [];
    for (const [field, values] of Object.entries(filters)) {
      for (const value of values) {
        entries.push({ field, value });
      }
    }
    return entries;
  });

  readonly selectedHitFields = computed(() => {
    const hit = this.selectedHit();
    if (!hit) return [];
    return Object.entries(hit.source).map(([key, value]) => ({
      key,
      value: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value),
    }));
  });

  readonly selectedHitHighlights = computed(() => {
    const hit = this.selectedHit();
    if (!hit) return [];
    return Object.entries(hit.highlights).map(([field, fragments]) => ({
      field,
      fragments,
    }));
  });

  // ---------- lifecycle ----------
  ngOnInit(): void {
    this.svc.loadIndices();
    this.svc.loadSavedQueries();
  }

  ngOnDestroy(): void {
    this.svc.clearResults();
    this.svc.clearError();
  }

  // ---------- actions ----------
  onSearch(): void {
    const q = this.queryInput().trim();
    if (!q) return;
    this.svc.setQuery(q);
    this.svc.setSyntax(this.selectedSyntax());
    if (this.selectedIndex()) {
      this.svc.setIndex(this.selectedIndex());
    }
    this.svc.executeSearch();
  }

  onQueryKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.onSearch();
    }
  }

  onSyntaxChange(syntax: string): void {
    this.selectedSyntax.set(syntax as QuerySyntax);
  }

  onIndexChange(index: string): void {
    this.selectedIndex.set(index);
    this.svc.setIndex(index);
  }

  onToggleExplain(): void {
    this.svc.toggleExplain();
  }

  onSelectHit(hit: SearchHit): void {
    this.svc.selectHit(hit);
    this.showExplanation.set(false);
  }

  onCloseDetail(): void {
    this.svc.selectHit(null);
  }

  onToggleExplanation(): void {
    this.showExplanation.update((v) => !v);
  }

  onFacetClick(field: string, value: string): void {
    const filters = this.activeFilters();
    const existing = filters[field] ?? [];
    if (existing.includes(value)) {
      this.svc.removeFilter(field, value);
    } else {
      this.svc.addFilter(field, value);
    }
    this.svc.executeSearch();
  }

  onRemoveFilter(field: string, value: string): void {
    this.svc.removeFilter(field, value);
    this.svc.executeSearch();
  }

  onClearFilters(): void {
    this.svc.clearFilters();
    this.svc.executeSearch();
  }

  onPageChange(page: number): void {
    this.svc.goToPage(page);
  }

  onSuggestionClick(suggestion: string): void {
    this.queryInput.set(suggestion);
    this.svc.setQuery(suggestion);
    this.svc.executeSearch();
  }

  // saved queries
  onToggleSavedQueries(): void {
    this.showSavedQueries.update((v) => !v);
  }

  onApplySavedQuery(saved: SavedQuery): void {
    this.queryInput.set(saved.query);
    this.selectedSyntax.set(saved.syntax);
    this.selectedIndex.set(saved.index);
    this.svc.applySavedQuery(saved);
    this.showSavedQueries.set(false);
  }

  onOpenSaveDialog(): void {
    this.saveQueryName.set('');
    this.showSaveDialog.set(true);
  }

  onSaveQuery(): void {
    const name = this.saveQueryName().trim();
    if (!name) return;
    this.svc.saveQuery(name)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.showSaveDialog.set(false));
  }

  onCancelSave(): void {
    this.showSaveDialog.set(false);
  }

  onDeleteSavedQuery(queryId: string): void {
    this.svc.deleteSavedQuery(queryId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();
  }

  onDismissError(): void {
    this.svc.clearError();
  }

  onClearResults(): void {
    this.svc.clearResults();
    this.queryInput.set('');
  }

  // ---------- template helpers ----------
  scorePercent(score: number): number {
    const max = this.maxScore();
    if (max <= 0) return 0;
    return Math.round((score / max) * 100);
  }

  scoreClass(score: number): string {
    const pct = this.scorePercent(score);
    if (pct >= 80) return 'score-high';
    if (pct >= 50) return 'score-medium';
    return 'score-low';
  }

  isFacetActive(field: string, value: string): boolean {
    const filters = this.activeFilters();
    return (filters[field] ?? []).includes(value);
  }

  trackByHitId(_: number, hit: SearchHit): string {
    return hit.id;
  }

  trackByFacetField(_: number, facet: FacetResult): string {
    return facet.field;
  }

  trackByBucketKey(_: number, bucket: FacetBucket): string {
    return bucket.key;
  }

  trackBySavedId(_: number, saved: SavedQuery): string {
    return saved.id;
  }

  trackByFieldKey(_: number, entry: { key: string }): string {
    return entry.key;
  }
}
