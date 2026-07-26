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

export type FieldType =
  | 'String'
  | 'Int32'
  | 'Int64'
  | 'Float32'
  | 'Float64'
  | 'Boolean'
  | 'DateTime'
  | 'GeoPoint'
  | 'Vector'
  | 'Json'
  | 'Array';

export type CollectionStatus = 'Active' | 'Building' | 'Disabled' | 'Error';

export interface FieldMapping {
  name: string;
  fieldType: FieldType;
  indexed: boolean;
  stored: boolean;
  required: boolean;
  multiValued: boolean;
  dimensions: number | null;
  defaultValue: string | null;
  analyzer: string | null;
}

export interface CollectionSchema {
  fields: FieldMapping[];
  primaryKey: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionStats {
  documentCount: number;
  storageSizeBytes: number;
  indexSizeBytes: number;
  avgDocumentSizeBytes: number;
  lastDocumentAt: string;
  fieldCardinality: Record<string, number>;
}

export interface SampleDocument {
  id: string;
  fields: Record<string, unknown>;
  score: number | null;
  indexedAt: string;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  status: CollectionStatus;
  documentCount: number;
  storageSizeBytes: number;
  shardCount: number;
  replicaCount: number;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

export interface CollectionDetail {
  collection: Collection;
  schema: CollectionSchema;
  stats: CollectionStats;
  sampleDocuments: SampleDocument[];
}

export interface CollectionListResponse {
  items: Collection[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CreateCollectionRequest {
  name: string;
  description: string;
  shardCount: number;
  replicaCount: number;
  fields: FieldMapping[];
  primaryKey: string;
}

export interface CollectionSummary {
  totalCollections: number;
  totalDocuments: number;
  totalStorageBytes: number;
  activeCount: number;
  buildingCount: number;
  disabledCount: number;
  errorCount: number;
}

// ---------- Service ----------

const API_BASE = '/api/admin/geo/collections';

@Injectable({ providedIn: 'root' })
export class CollectionsService {
  private readonly http = inject(HttpClient);

  // ---------- state signals ----------
  readonly collections = signal<Collection[]>([]);
  readonly selectedCollection = signal<CollectionDetail | null>(null);
  readonly summary = signal<CollectionSummary>({
    totalCollections: 0,
    totalDocuments: 0,
    totalStorageBytes: 0,
    activeCount: 0,
    buildingCount: 0,
    disabledCount: 0,
    errorCount: 0,
  });
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly totalItems = signal(0);
  readonly currentPage = signal(1);
  readonly pageSize = signal(25);

  // filters
  readonly filterStatus = signal<CollectionStatus | null>(null);
  readonly searchQuery = signal('');

  // ---------- computed ----------
  readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.totalItems() / this.pageSize())),
  );

  readonly filteredCollections = computed(() => {
    let result = this.collections();
    const status = this.filterStatus();
    const query = this.searchQuery().toLowerCase();

    if (status) {
      result = result.filter((c) => c.status === status);
    }
    if (query) {
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.description.toLowerCase().includes(query),
      );
    }
    return result;
  });

  readonly statusBreakdown = computed(() => {
    const s = this.summary();
    return [
      { status: 'Active' as CollectionStatus, count: s.activeCount, cssClass: 'status-active' },
      { status: 'Building' as CollectionStatus, count: s.buildingCount, cssClass: 'status-building' },
      { status: 'Disabled' as CollectionStatus, count: s.disabledCount, cssClass: 'status-disabled' },
      { status: 'Error' as CollectionStatus, count: s.errorCount, cssClass: 'status-error' },
    ];
  });

  readonly schemaFields = computed(() => {
    const detail = this.selectedCollection();
    if (!detail) return [];
    return detail.schema.fields;
  });

  readonly fieldCardinality = computed(() => {
    const detail = this.selectedCollection();
    if (!detail) return [];
    return Object.entries(detail.stats.fieldCardinality)
      .map(([field, cardinality]) => ({ field, cardinality }))
      .sort((a, b) => b.cardinality - a.cardinality);
  });

  // ---------- queries ----------

  /** Load the collection list. */
  loadCollections(page = 1, pageSize = 25): void {
    this.loading.set(true);
    this.error.set(null);
    this.currentPage.set(page);
    this.pageSize.set(pageSize);

    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    const status = this.filterStatus();
    if (status) params = params.set('status', status);

    const query = this.searchQuery();
    if (query) params = params.set('q', query);

    this.http
      .get<CollectionListResponse>(`${API_BASE}`, { params })
      .pipe(
        tap((res) => {
          this.collections.set(res.items);
          this.totalItems.set(res.total);
        }),
        catchError((err) => {
          this.error.set('Failed to load collections.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  /** Load the collections summary. */
  loadSummary(): void {
    this.http
      .get<CollectionSummary>(`${API_BASE}/summary`)
      .pipe(
        tap((s) => this.summary.set(s)),
        catchError((err) => {
          this.error.set('Failed to load collections summary.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  /** Load details for a specific collection. */
  loadCollectionDetail(collectionId: string): void {
    this.loading.set(true);

    this.http
      .get<CollectionDetail>(`${API_BASE}/${collectionId}`)
      .pipe(
        tap((detail) => this.selectedCollection.set(detail)),
        catchError((err) => {
          this.error.set('Failed to load collection details.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  /** Create a new collection. */
  createCollection(request: CreateCollectionRequest): Observable<Collection> {
    return this.http.post<Collection>(`${API_BASE}`, request).pipe(
      tap(() => {
        this.loadCollections(this.currentPage(), this.pageSize());
        this.loadSummary();
      }),
      catchError((err) => {
        this.error.set('Failed to create collection.');
        return throwError(() => err);
      }),
    );
  }

  /** Delete a collection. */
  deleteCollection(collectionId: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/${collectionId}`).pipe(
      tap(() => {
        this.selectedCollection.set(null);
        this.loadCollections(this.currentPage(), this.pageSize());
        this.loadSummary();
      }),
      catchError((err) => {
        this.error.set('Failed to delete collection.');
        return throwError(() => err);
      }),
    );
  }

  // ---------- selection ----------

  selectCollection(collection: Collection): void {
    this.loadCollectionDetail(collection.id);
  }

  clearSelection(): void {
    this.selectedCollection.set(null);
  }

  // ---------- filter actions ----------

  setStatusFilter(status: CollectionStatus | null): void {
    this.filterStatus.set(status);
  }

  setSearchQuery(query: string): void {
    this.searchQuery.set(query);
  }

  clearError(): void {
    this.error.set(null);
  }
}
