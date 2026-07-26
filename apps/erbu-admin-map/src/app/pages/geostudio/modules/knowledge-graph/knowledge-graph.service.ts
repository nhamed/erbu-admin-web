import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  Observable,
  catchError,
  throwError,
  tap,
  finalize,
  map,
} from 'rxjs';

// ---------- DTOs ----------

export type EntityType =
  | 'Location'
  | 'Address'
  | 'Route'
  | 'Zone'
  | 'Landmark'
  | 'Region'
  | 'POI'
  | 'Road';

export type RelationshipType =
  | 'CONTAINS'
  | 'NEAR'
  | 'CONNECTS'
  | 'PART_OF'
  | 'INTERSECTS'
  | 'ADJACENT'
  | 'OVERLAPS'
  | 'SERVES';

export interface GraphNode {
  id: string;
  label: string;
  entityType: EntityType;
  properties: Record<string, string | number | boolean>;
  degree: number;
  createdAt: string;
  updatedAt: string;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: RelationshipType;
  weight: number;
  properties: Record<string, string | number | boolean>;
  createdAt: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  avgDegree: number;
  density: number;
  connectedComponents: number;
  nodesByType: Record<string, number>;
  edgesByType: Record<string, number>;
  lastUpdatedAt: string;
}

export interface EntitySearchResult {
  node: GraphNode;
  matchScore: number;
  connectedNodes: number;
}

export interface EntityNeighborhood {
  center: GraphNode;
  neighbors: GraphNode[];
  edges: GraphEdge[];
  depth: number;
}

// ---------- Service ----------

const API_BASE = '/api/admin/geo/knowledge-graph';

@Injectable({ providedIn: 'root' })
export class KnowledgeGraphService {
  private readonly http = inject(HttpClient);

  // ---------- state signals ----------
  readonly graphData = signal<GraphData>({ nodes: [], edges: [] });
  readonly stats = signal<GraphStats>({
    totalNodes: 0,
    totalEdges: 0,
    avgDegree: 0,
    density: 0,
    connectedComponents: 0,
    nodesByType: {},
    edgesByType: {},
    lastUpdatedAt: '',
  });
  readonly searchResults = signal<EntitySearchResult[]>([]);
  readonly selectedNode = signal<GraphNode | null>(null);
  readonly selectedEdge = signal<GraphEdge | null>(null);
  readonly neighborhood = signal<EntityNeighborhood | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly searchQuery = signal('');

  // ---------- computed ----------
  readonly nodeCount = computed(() => this.graphData().nodes.length);
  readonly edgeCount = computed(() => this.graphData().edges.length);

  readonly entityTypes = computed(() => {
    const types = new Set<EntityType>();
    for (const node of this.graphData().nodes) {
      types.add(node.entityType);
    }
    return Array.from(types).sort();
  });

  readonly relationshipTypes = computed(() => {
    const types = new Set<RelationshipType>();
    for (const edge of this.graphData().edges) {
      types.add(edge.relationshipType);
    }
    return Array.from(types).sort();
  });

  readonly selectedNodeEdges = computed(() => {
    const node = this.selectedNode();
    if (!node) return [];
    return this.graphData().edges.filter(
      (e) => e.sourceId === node.id || e.targetId === node.id,
    );
  });

  // ---------- queries ----------

  /** Fetch the full graph (limited to maxNodes). */
  loadGraph(maxNodes = 200): void {
    this.loading.set(true);
    this.error.set(null);

    const params = new HttpParams().set('maxNodes', maxNodes.toString());

    this.http
      .get<GraphData>(`${API_BASE}/graph`, { params })
      .pipe(
        tap((data) => this.graphData.set(data)),
        catchError((err) => {
          this.error.set('Failed to load knowledge graph data.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  /** Fetch graph stats. */
  loadStats(): void {
    this.http
      .get<GraphStats>(`${API_BASE}/stats`)
      .pipe(
        tap((s) => this.stats.set(s)),
        catchError((err) => {
          this.error.set('Failed to load graph statistics.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  /** Search entities by name/label. */
  searchEntities(query: string, limit = 20): void {
    if (!query.trim()) {
      this.searchResults.set([]);
      return;
    }

    this.searchQuery.set(query);

    const params = new HttpParams()
      .set('q', query)
      .set('limit', limit.toString());

    this.http
      .get<EntitySearchResult[]>(`${API_BASE}/search`, { params })
      .pipe(
        tap((results) => this.searchResults.set(results)),
        catchError((err) => {
          this.error.set('Entity search failed.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  /** Load the neighborhood of a node (1-hop or n-hop). */
  loadNeighborhood(nodeId: string, depth = 1): void {
    this.loading.set(true);

    const params = new HttpParams().set('depth', depth.toString());

    this.http
      .get<EntityNeighborhood>(`${API_BASE}/nodes/${nodeId}/neighborhood`, { params })
      .pipe(
        tap((n) => {
          this.neighborhood.set(n);
          this.selectedNode.set(n.center);
        }),
        catchError((err) => {
          this.error.set('Failed to load entity neighborhood.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  /** Fetch a single node by ID. */
  getNode(nodeId: string): Observable<GraphNode> {
    return this.http.get<GraphNode>(`${API_BASE}/nodes/${nodeId}`).pipe(
      catchError((err) => {
        this.error.set('Failed to load node details.');
        return throwError(() => err);
      }),
    );
  }

  /** Fetch a single edge by ID. */
  getEdge(edgeId: string): Observable<GraphEdge> {
    return this.http.get<GraphEdge>(`${API_BASE}/edges/${edgeId}`).pipe(
      catchError((err) => {
        this.error.set('Failed to load edge details.');
        return throwError(() => err);
      }),
    );
  }

  // ---------- selection ----------

  selectNode(node: GraphNode | null): void {
    this.selectedNode.set(node);
    this.selectedEdge.set(null);
    if (node) {
      this.loadNeighborhood(node.id);
    } else {
      this.neighborhood.set(null);
    }
  }

  selectEdge(edge: GraphEdge | null): void {
    this.selectedEdge.set(edge);
    this.selectedNode.set(null);
    this.neighborhood.set(null);
  }

  clearSelection(): void {
    this.selectedNode.set(null);
    this.selectedEdge.set(null);
    this.neighborhood.set(null);
  }

  clearError(): void {
    this.error.set(null);
  }
}
