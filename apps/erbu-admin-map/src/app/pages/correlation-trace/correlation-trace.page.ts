import {
  Component,
  ChangeDetectionStrategy,
  OnDestroy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  TraceService,
  TraceSpan,
  TraceSearchResult,
  GanttRow,
  SpanStatus,
} from './trace.service';

@Component({
  selector: 'app-correlation-trace',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './correlation-trace.page.html',
  styleUrl: './correlation-trace.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CorrelationTracePage implements OnDestroy {
  protected readonly svc = inject(TraceService);

  // ---- Search form state ----
  readonly searchCorrelationId = signal('');
  readonly searchServiceName = signal('');
  readonly searchMinDurationMs = signal<number | null>(null);
  readonly searchMaxDurationMs = signal<number | null>(null);
  readonly searchStatus = signal<SpanStatus | ''>('');

  // ---- UI state ----
  readonly activeTab = signal<'timeline' | 'graph' | 'errors'>('timeline');
  readonly spanDetailExpanded = signal(false);

  // ---- Delegate signals from service ----
  readonly loading = this.svc.loading;
  readonly searchLoading = this.svc.searchLoading;
  readonly error = this.svc.error;
  readonly trace = this.svc.trace;
  readonly searchResults = this.svc.searchResults;
  readonly selectedSpan = this.svc.selectedSpan;
  readonly ganttRows = this.svc.ganttRows;
  readonly callGraph = this.svc.callGraph;
  readonly traceSummary = this.svc.traceSummary;
  readonly traceServices = this.svc.traceServices;
  readonly errorSpans = this.svc.errorSpans;

  // ---- Computed ----
  readonly hasTrace = computed(() => this.trace() !== null);
  readonly hasSearchResults = computed(() => this.searchResults().length > 0);
  readonly errorCount = computed(() => this.errorSpans().length);

  readonly spanAttributes = computed(() => {
    const span = this.selectedSpan();
    if (!span) return [];
    return Object.entries(span.attributes).map(([key, value]) => ({ key, value }));
  });

  readonly spanEvents = computed(() => {
    const span = this.selectedSpan();
    if (!span) return [];
    return span.events.map((e) => ({
      name: e.name,
      timestamp: new Date(e.timestampUnixNano / 1_000_000).toISOString(),
      attributes: Object.entries(e.attributes).map(([key, value]) => ({ key, value })),
    }));
  });

  // ---- Actions ----
  onSearch(): void {
    const correlationId = this.searchCorrelationId().trim();
    if (!correlationId) return;

    this.svc.searchTraces({
      correlationId,
      serviceName: this.searchServiceName().trim() || undefined,
      minDurationMs: this.searchMinDurationMs() ?? undefined,
      maxDurationMs: this.searchMaxDurationMs() ?? undefined,
      status: (this.searchStatus() as SpanStatus) || undefined,
      limit: 50,
    });
  }

  onLoadTrace(traceId: string): void {
    this.svc.loadTrace(traceId);
  }

  onLoadByCorrelationId(): void {
    const correlationId = this.searchCorrelationId().trim();
    if (!correlationId) return;
    this.svc.loadTraceByCorrelationId(correlationId);
  }

  onSelectSpan(span: TraceSpan): void {
    this.svc.selectSpan(span);
    this.spanDetailExpanded.set(true);
  }

  onCloseSpanDetail(): void {
    this.svc.selectSpan(null);
    this.spanDetailExpanded.set(false);
  }

  onClearTrace(): void {
    this.svc.clearTrace();
  }

  onClearSearch(): void {
    this.svc.clearSearch();
    this.searchCorrelationId.set('');
    this.searchServiceName.set('');
    this.searchMinDurationMs.set(null);
    this.searchMaxDurationMs.set(null);
    this.searchStatus.set('');
  }

  onDismissError(): void {
    this.svc.clearError();
  }

  setTab(tab: 'timeline' | 'graph' | 'errors'): void {
    this.activeTab.set(tab);
  }

  // ---- Template helpers ----
  spanStatusClass(status: SpanStatus): string {
    switch (status) {
      case 'Ok':
        return 'span-ok';
      case 'Error':
        return 'span-error';
      default:
        return 'span-unset';
    }
  }

  spanKindIcon(kind: string): string {
    switch (kind) {
      case 'Client':
        return 'call_made';
      case 'Server':
        return 'call_received';
      case 'Producer':
        return 'publish';
      case 'Consumer':
        return 'get_app';
      default:
        return 'settings_ethernet';
    }
  }

  formatDuration(ms: number): string {
    if (ms < 1) return '<1ms';
    if (ms < 1000) return `${ms.toFixed(1)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  formatNanoTimestamp(nanos: number): string {
    return new Date(nanos / 1_000_000).toISOString();
  }

  ganttIndent(depth: number): string {
    return `${depth * 20}px`;
  }

  trackBySpanId(_: number, row: GanttRow): string {
    return row.span.spanId;
  }

  trackByTraceId(_: number, result: TraceSearchResult): string {
    return result.traceId;
  }

  trackByKey(_: number, attr: { key: string }): string {
    return attr.key;
  }

  ngOnDestroy(): void {
    this.svc.clearTrace();
    this.svc.clearSearch();
    this.svc.clearError();
  }
}
