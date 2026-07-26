import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  CollectionsService,
  Collection,
  CollectionDetail,
  CollectionStatus,
  FieldMapping,
  SampleDocument,
} from './collections.service';

@Component({
  selector: 'app-collections',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './collections.component.html',
  styleUrl: './collections.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionsComponent implements OnInit {
  protected readonly svc = inject(CollectionsService);

  // ---------- state from service ----------
  readonly loading = this.svc.loading;
  readonly error = this.svc.error;
  readonly collections = this.svc.filteredCollections;
  readonly selectedCollection = this.svc.selectedCollection;
  readonly summary = this.svc.summary;
  readonly totalItems = this.svc.totalItems;
  readonly currentPage = this.svc.currentPage;
  readonly pageSize = this.svc.pageSize;
  readonly totalPages = this.svc.totalPages;
  readonly statusBreakdown = this.svc.statusBreakdown;
  readonly schemaFields = this.svc.schemaFields;
  readonly fieldCardinality = this.svc.fieldCardinality;
  readonly filterStatus = this.svc.filterStatus;

  // local UI state
  readonly searchText = signal('');
  readonly activeDetailTab = signal<'schema' | 'stats' | 'documents'>('schema');
  readonly showDeleteConfirm = signal(false);
  readonly expandedDocId = signal<string | null>(null);

  readonly statusOptions: CollectionStatus[] = ['Active', 'Building', 'Disabled', 'Error'];

  // ---------- computed ----------
  readonly kpiCards = computed(() => {
    const s = this.summary();
    return [
      { label: 'Collections', value: s.totalCollections, icon: 'collections_bookmark' },
      { label: 'Documents', value: this.formatNumber(s.totalDocuments), icon: 'description' },
      { label: 'Storage', value: this.formatBytes(s.totalStorageBytes), icon: 'storage' },
      { label: 'Active', value: s.activeCount, icon: 'check_circle', cssClass: 'kpi-active' },
      { label: 'Building', value: s.buildingCount, icon: 'build', cssClass: 'kpi-building' },
      { label: 'Errors', value: s.errorCount, icon: 'error', cssClass: 'kpi-error' },
    ];
  });

  readonly collectionDetail = computed(() => {
    const detail = this.selectedCollection();
    if (!detail) return null;
    return {
      ...detail,
      storageSizeFormatted: this.formatBytes(detail.collection.storageSizeBytes),
      indexSizeFormatted: this.formatBytes(detail.stats.indexSizeBytes),
      avgDocSizeFormatted: this.formatBytes(detail.stats.avgDocumentSizeBytes),
    };
  });

  readonly sampleDocs = computed(() => {
    const detail = this.selectedCollection();
    if (!detail) return [];
    return detail.sampleDocuments;
  });

  // ---------- lifecycle ----------
  ngOnInit(): void {
    this.svc.loadSummary();
    this.svc.loadCollections();
  }

  // ---------- template actions ----------

  onSearch(): void {
    this.svc.setSearchQuery(this.searchText());
    this.svc.loadCollections();
  }

  onSearchKeyup(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.onSearch();
    }
  }

  onSearchClear(): void {
    this.searchText.set('');
    this.svc.setSearchQuery('');
    this.svc.loadCollections();
  }

  onStatusChange(status: string): void {
    this.svc.setStatusFilter((status as CollectionStatus) || null);
    this.svc.loadCollections();
  }

  onSelectCollection(collection: Collection): void {
    this.svc.selectCollection(collection);
    this.activeDetailTab.set('schema');
    this.showDeleteConfirm.set(false);
  }

  onCloseDetail(): void {
    this.svc.clearSelection();
    this.showDeleteConfirm.set(false);
  }

  onDetailTabChange(tab: 'schema' | 'stats' | 'documents'): void {
    this.activeDetailTab.set(tab);
  }

  onDeleteRequest(): void {
    this.showDeleteConfirm.set(true);
  }

  onDeleteCancel(): void {
    this.showDeleteConfirm.set(false);
  }

  onDeleteConfirm(): void {
    const detail = this.selectedCollection();
    if (!detail) return;
    this.svc.deleteCollection(detail.collection.id).subscribe();
    this.showDeleteConfirm.set(false);
  }

  onToggleDoc(docId: string): void {
    this.expandedDocId.set(
      this.expandedDocId() === docId ? null : docId,
    );
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.svc.loadCollections(page, this.pageSize());
  }

  onRefresh(): void {
    this.svc.loadSummary();
    this.svc.loadCollections(this.currentPage(), this.pageSize());
    const detail = this.selectedCollection();
    if (detail) {
      this.svc.loadCollectionDetail(detail.collection.id);
    }
  }

  // ---------- helpers ----------

  statusClass(status: CollectionStatus): string {
    switch (status) {
      case 'Active': return 'status-active';
      case 'Building': return 'status-building';
      case 'Disabled': return 'status-disabled';
      case 'Error': return 'status-error';
      default: return '';
    }
  }

  formatNumber(value: number): string {
    if (value >= 1_000_000) return (value / 1_000_000).toFixed(1) + 'M';
    if (value >= 1_000) return (value / 1_000).toFixed(1) + 'K';
    return value.toString();
  }

  formatBytes(bytes: number): string {
    if (bytes >= 1_073_741_824) return (bytes / 1_073_741_824).toFixed(1) + ' GB';
    if (bytes >= 1_048_576) return (bytes / 1_048_576).toFixed(1) + ' MB';
    if (bytes >= 1_024) return (bytes / 1_024).toFixed(1) + ' KB';
    return bytes + ' B';
  }

  formatDocFields(fields: Record<string, unknown>): string {
    return JSON.stringify(fields, null, 2);
  }

  fieldTypeIcon(indexed: boolean, stored: boolean): string {
    if (indexed && stored) return 'check_circle';
    if (indexed) return 'search';
    if (stored) return 'save';
    return 'remove_circle_outline';
  }

  trackByCollectionId(_: number, collection: Collection): string {
    return collection.id;
  }

  trackByFieldName(_: number, field: FieldMapping): string {
    return field.name;
  }

  trackByDocId(_: number, doc: SampleDocument): string {
    return doc.id;
  }

  cardinalityPercent(cardinality: number, docCount: number): number {
    return Math.min(100, (cardinality / docCount) * 100);
  }

  trackByCardinality(_: number, item: { field: string }): string {
    return item.field;
  }
}
