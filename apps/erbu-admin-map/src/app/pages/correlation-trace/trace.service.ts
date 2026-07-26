import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, tap, throwError, finalize, map } from 'rxjs';

// ---------- DTOs ----------

export type SpanKind = 'Client' | 'Server' | 'Internal' | 'Producer' | 'Consumer';
export type SpanStatus = 'Ok' | 'Error' | 'Unset';

export interface TraceSpan {
  spanId: string;
  parentSpanId: string | null;
  operationName: string;
  serviceName: string;
  spanKind: SpanKind;
  status: SpanStatus;
  startTimeUnixNano: number;
  endTimeUnixNano: number;
  durationMs: number;
  attributes: Record<string, string>;
  events: SpanEvent[];
  statusMessage: string | null;
  httpMethod: string | null;
  httpStatusCode: number | null;
  httpUrl: string | null;
}

export interface SpanEvent {
  name: string;
  timestampUnixNano: number;
  attributes: Record<string, string>;
}

export interface TraceResult {
  traceId: string;
  rootServiceName: string;
  rootOperationName: string;
  startTimeUnixNano: number;
  durationMs: number;
  spanCount: number;
  serviceCount: number;
  errorCount: number;
  spans: TraceSpan[];
}

export interface TraceSearchResult {
  traceId: string;
  rootServiceName: string;
  rootOperationName: string;
  startTimeUnixNano: number;
  durationMs: number;
  spanCount: number;
  serviceCount: number;
  errorCount: number;
}

export interface TraceSearchResponse {
  traces: TraceSearchResult[];
  total: number;
}

export interface ServiceNode {
  name: string;
  spanCount: number;
  errorCount: number;
  avgDurationMs: number;
}

export interface ServiceEdge {
  source: string;
  target: string;
  callCount: number;
  errorCount: number;
  avgDurationMs: number;
}

export interface ServiceCallGraph {
  nodes: ServiceNode[];
  edges: ServiceEdge[];
}

export interface TraceSearchParams {
  correlationId?: string;
  serviceName?: string;
  operationName?: string;
  minDurationMs?: number;
  maxDurationMs?: number;
  status?: SpanStatus;
  fromTimestamp?: string;
  toTimestamp?: string;
  limit?: number;
}

// ---------- Gantt row (computed client-side) ----------

export interface GanttRow {
  span: TraceSpan;
  depth: number;
  offsetPercent: number;
  widthPercent: number;
}

// ---------- Service ----------

const API_BASE = '/api/ops/traces';

@Injectable({ providedIn: 'root' })
export class TraceService {
  private readonly http = inject(HttpClient);

  // ---- State signals ----
  readonly loading = signal(false);
  readonly searchLoading = signal(false);
  readonly error = signal<string | null>(null);

  readonly trace = signal<TraceResult | null>(null);
  readonly searchResults = signal<TraceSearchResult[]>([]);
  readonly searchTotal = signal(0);
  readonly selectedSpan = signal<TraceSpan | null>(null);
  readonly callGraph = signal<ServiceCallGraph | null>(null);

  // ---- Computed: Gantt rows ----
  readonly ganttRows = computed<GanttRow[]>(() => {
    const t = this.trace();
    if (!t || t.spans.length === 0) return [];

    const traceStart = Math.min(...t.spans.map((s) => s.startTimeUnixNano));
    const traceEnd = Math.max(...t.spans.map((s) => s.endTimeUnixNano));
    const totalDuration = traceEnd - traceStart;
    if (totalDuration <= 0) return [];

    // Build parent->children map
    const childrenMap = new Map<string | null, TraceSpan[]>();
    for (const span of t.spans) {
      const parentId = span.parentSpanId ?? null;
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      childrenMap.get(parentId)!.push(span);
    }

    // Sort children by start time within each group
    for (const children of childrenMap.values()) {
      children.sort((a, b) => a.startTimeUnixNano - b.startTimeUnixNano);
    }

    // DFS to build ordered rows
    const rows: GanttRow[] = [];
    const visited = new Set<string>();

    const walk = (parentId: string | null, depth: number): void => {
      const children = childrenMap.get(parentId) ?? [];
      for (const span of children) {
        if (visited.has(span.spanId)) continue;
        visited.add(span.spanId);

        const offsetPercent =
          ((span.startTimeUnixNano - traceStart) / totalDuration) * 100;
        const widthPercent = Math.max(
          (span.durationMs / (totalDuration / 1_000_000)) * 100,
          0.3,
        );

        rows.push({ span, depth, offsetPercent, widthPercent });
        walk(span.spanId, depth + 1);
      }
    };

    // Find root spans (no parent or parent not in this trace)
    const spanIds = new Set(t.spans.map((s) => s.spanId));
    const roots = t.spans.filter(
      (s) => !s.parentSpanId || !spanIds.has(s.parentSpanId),
    );
    roots.sort((a, b) => a.startTimeUnixNano - b.startTimeUnixNano);

    for (const root of roots) {
      if (visited.has(root.spanId)) continue;
      visited.add(root.spanId);

      const offsetPercent =
        ((root.startTimeUnixNano - traceStart) / totalDuration) * 100;
      const widthPercent = Math.max(
        (root.durationMs / (totalDuration / 1_000_000)) * 100,
        0.3,
      );

      rows.push({ span: root, depth: 0, offsetPercent, widthPercent });
      walk(root.spanId, 1);
    }

    return rows;
  });

  // ---- Computed: unique services in current trace ----
  readonly traceServices = computed(() => {
    const t = this.trace();
    if (!t) return [];
    const serviceSet = new Set(t.spans.map((s) => s.serviceName));
    return Array.from(serviceSet).sort();
  });

  // ---- Computed: error spans ----
  readonly errorSpans = computed(() => {
    const t = this.trace();
    if (!t) return [];
    return t.spans.filter((s) => s.status === 'Error');
  });

  // ---- Computed: trace summary ----
  readonly traceSummary = computed(() => {
    const t = this.trace();
    if (!t) return null;
    return {
      traceId: t.traceId,
      rootService: t.rootServiceName,
      rootOperation: t.rootOperationName,
      totalDurationMs: t.durationMs,
      spanCount: t.spanCount,
      serviceCount: t.serviceCount,
      errorCount: t.errorCount,
      startTime: new Date(t.startTimeUnixNano / 1_000_000).toISOString(),
    };
  });

  // ---- Search traces ----
  searchTraces(params: TraceSearchParams): void {
    this.searchLoading.set(true);
    this.error.set(null);

    let httpParams = new HttpParams();
    if (params.correlationId) httpParams = httpParams.set('correlationId', params.correlationId);
    if (params.serviceName) httpParams = httpParams.set('serviceName', params.serviceName);
    if (params.operationName) httpParams = httpParams.set('operationName', params.operationName);
    if (params.minDurationMs != null) httpParams = httpParams.set('minDurationMs', params.minDurationMs.toString());
    if (params.maxDurationMs != null) httpParams = httpParams.set('maxDurationMs', params.maxDurationMs.toString());
    if (params.status) httpParams = httpParams.set('status', params.status);
    if (params.fromTimestamp) httpParams = httpParams.set('from', params.fromTimestamp);
    if (params.toTimestamp) httpParams = httpParams.set('to', params.toTimestamp);
    if (params.limit != null) httpParams = httpParams.set('limit', params.limit.toString());

    this.http
      .get<TraceSearchResponse>(`${API_BASE}/search`, { params: httpParams })
      .pipe(
        tap((res) => {
          this.searchResults.set(res.traces);
          this.searchTotal.set(res.total);
        }),
        catchError((err) => {
          this.error.set('Failed to search traces.');
          return throwError(() => err);
        }),
        finalize(() => this.searchLoading.set(false)),
      )
      .subscribe();
  }

  // ---- Fetch single trace by ID ----
  loadTrace(traceId: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.selectedSpan.set(null);

    this.http
      .get<TraceResult>(`${API_BASE}/${traceId}`)
      .pipe(
        tap((result) => {
          this.trace.set(result);
          this.buildCallGraph(result);
        }),
        catchError((err) => {
          this.error.set(`Failed to load trace ${traceId}.`);
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  // ---- Fetch trace by correlation ID ----
  loadTraceByCorrelationId(correlationId: string): void {
    this.loading.set(true);
    this.error.set(null);
    this.selectedSpan.set(null);

    this.http
      .get<TraceResult>(`${API_BASE}/by-correlation/${encodeURIComponent(correlationId)}`)
      .pipe(
        tap((result) => {
          this.trace.set(result);
          this.buildCallGraph(result);
        }),
        catchError((err) => {
          this.error.set(`Failed to load trace for correlation ID ${correlationId}.`);
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  // ---- Select span ----
  selectSpan(span: TraceSpan | null): void {
    this.selectedSpan.set(span);
  }

  // ---- Clear ----
  clearTrace(): void {
    this.trace.set(null);
    this.selectedSpan.set(null);
    this.callGraph.set(null);
  }

  clearSearch(): void {
    this.searchResults.set([]);
    this.searchTotal.set(0);
  }

  clearError(): void {
    this.error.set(null);
  }

  // ---- Private: build service call graph from spans ----
  private buildCallGraph(trace: TraceResult): void {
    const spanMap = new Map<string, TraceSpan>();
    for (const span of trace.spans) {
      spanMap.set(span.spanId, span);
    }

    // Aggregate per-service stats
    const nodeMap = new Map<string, ServiceNode>();
    for (const span of trace.spans) {
      const existing = nodeMap.get(span.serviceName);
      if (existing) {
        existing.spanCount++;
        if (span.status === 'Error') existing.errorCount++;
        existing.avgDurationMs =
          (existing.avgDurationMs * (existing.spanCount - 1) + span.durationMs) /
          existing.spanCount;
      } else {
        nodeMap.set(span.serviceName, {
          name: span.serviceName,
          spanCount: 1,
          errorCount: span.status === 'Error' ? 1 : 0,
          avgDurationMs: span.durationMs,
        });
      }
    }

    // Build edges from parent->child relationships where service differs
    const edgeKey = (src: string, tgt: string) => `${src}::${tgt}`;
    const edgeMap = new Map<string, ServiceEdge>();

    for (const span of trace.spans) {
      if (!span.parentSpanId) continue;
      const parent = spanMap.get(span.parentSpanId);
      if (!parent || parent.serviceName === span.serviceName) continue;

      const key = edgeKey(parent.serviceName, span.serviceName);
      const existing = edgeMap.get(key);
      if (existing) {
        existing.callCount++;
        if (span.status === 'Error') existing.errorCount++;
        existing.avgDurationMs =
          (existing.avgDurationMs * (existing.callCount - 1) + span.durationMs) /
          existing.callCount;
      } else {
        edgeMap.set(key, {
          source: parent.serviceName,
          target: span.serviceName,
          callCount: 1,
          errorCount: span.status === 'Error' ? 1 : 0,
          avgDurationMs: span.durationMs,
        });
      }
    }

    this.callGraph.set({
      nodes: Array.from(nodeMap.values()),
      edges: Array.from(edgeMap.values()),
    });
  }
}
