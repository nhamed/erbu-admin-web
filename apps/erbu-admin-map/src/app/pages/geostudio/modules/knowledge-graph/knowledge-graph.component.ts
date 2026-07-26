import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  DestroyRef,
  signal,
  computed,
  inject,
  effect,
  PLATFORM_ID,
  ElementRef,
  viewChild,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  KnowledgeGraphService,
  GraphNode,
  GraphEdge,
  EntityType,
  RelationshipType,
  EntitySearchResult,
} from './knowledge-graph.service';

// ---------- Force-directed layout types ----------

interface SimNode {
  id: string;
  label: string;
  entityType: EntityType;
  degree: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;
  fy: number | null;
}

interface SimEdge {
  id: string;
  source: SimNode;
  target: SimNode;
  relationshipType: RelationshipType;
  weight: number;
}

const ENTITY_COLORS: Record<EntityType, string> = {
  Location: '#1890ff',
  Address: '#52c41a',
  Route: '#fa8c16',
  Zone: '#722ed1',
  Landmark: '#eb2f96',
  Region: '#13c2c2',
  POI: '#fadb14',
  Road: '#a0d911',
};

@Component({
  selector: 'app-knowledge-graph',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './knowledge-graph.component.html',
  styleUrl: './knowledge-graph.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KnowledgeGraphComponent implements OnInit, OnDestroy {
  protected readonly svc = inject(KnowledgeGraphService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);

  readonly svgContainer = viewChild<ElementRef<SVGSVGElement>>('graphSvg');

  // ---------- state ----------
  readonly loading = this.svc.loading;
  readonly error = this.svc.error;

  // graph data
  readonly graphData = this.svc.graphData;
  readonly stats = this.svc.stats;
  readonly searchResults = this.svc.searchResults;
  readonly selectedNode = this.svc.selectedNode;
  readonly selectedEdge = this.svc.selectedEdge;
  readonly selectedNodeEdges = this.svc.selectedNodeEdges;
  readonly neighborhood = this.svc.neighborhood;

  // local UI state
  readonly searchText = signal('');
  readonly activeTab = signal<'graph' | 'stats'>('graph');
  readonly filterEntityType = signal<EntityType | ''>('');

  // simulation state
  readonly simNodes = signal<SimNode[]>([]);
  readonly simEdges = signal<SimEdge[]>([]);

  private animationFrame: number | null = null;
  private simulationRunning = false;
  private simulationAlpha = 1;
  private readonly ALPHA_DECAY = 0.005;
  private readonly ALPHA_MIN = 0.01;
  private dragNode: SimNode | null = null;
  readonly svgWidth = 900;
  readonly svgHeight = 600;

  // ---------- computed ----------
  readonly entityTypeOptions = computed(() => this.svc.entityTypes());

  readonly kpiCards = computed(() => {
    const s = this.stats();
    return [
      { label: 'Nodes', value: s.totalNodes, icon: 'hub' },
      { label: 'Edges', value: s.totalEdges, icon: 'share' },
      { label: 'Avg Degree', value: s.avgDegree.toFixed(1), icon: 'device_hub' },
      { label: 'Density', value: (s.density * 100).toFixed(2) + '%', icon: 'grid_on' },
      { label: 'Components', value: s.connectedComponents, icon: 'account_tree' },
    ];
  });

  readonly nodesByTypeList = computed(() => {
    const map = this.stats().nodesByType;
    return Object.entries(map)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  });

  readonly edgesByTypeList = computed(() => {
    const map = this.stats().edgesByType;
    return Object.entries(map)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  });

  readonly filteredNodes = computed(() => {
    const filter = this.filterEntityType();
    const nodes = this.graphData().nodes;
    if (!filter) return nodes;
    return nodes.filter((n) => n.entityType === filter);
  });

  readonly inspectorProperties = computed(() => {
    const node = this.selectedNode();
    if (!node) return [];
    return Object.entries(node.properties).map(([key, value]) => ({
      key,
      value: String(value),
    }));
  });

  readonly edgeInspectorProperties = computed(() => {
    const edge = this.selectedEdge();
    if (!edge) return [];
    return Object.entries(edge.properties).map(([key, value]) => ({
      key,
      value: String(value),
    }));
  });

  constructor() {
    // Rebuild the force simulation whenever graphData changes
    effect(() => {
      const data = this.graphData();
      if (data.nodes.length > 0 && this.activeTab() === 'graph') {
        this.buildSimulation();
      }
    });
  }

  // ---------- lifecycle ----------
  ngOnInit(): void {
    this.svc.loadGraph();
    this.svc.loadStats();
  }

  ngOnDestroy(): void {
    this.stopSimulation();
  }

  // ---------- simulation ----------
  private buildSimulation(): void {
    const data = this.graphData();
    if (data.nodes.length === 0) return;

    const filter = this.filterEntityType();
    let nodes = data.nodes;
    if (filter) {
      nodes = nodes.filter((n) => n.entityType === filter);
    }

    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = data.edges.filter(
      (e) => nodeIds.has(e.sourceId) && nodeIds.has(e.targetId),
    );

    const simNodeMap = new Map<string, SimNode>();
    const simNodes: SimNode[] = nodes.map((n, i) => {
      const angle = (2 * Math.PI * i) / nodes.length;
      const radius = Math.min(this.svgWidth, this.svgHeight) * 0.35;
      const sn: SimNode = {
        id: n.id,
        label: n.label,
        entityType: n.entityType,
        degree: n.degree,
        x: this.svgWidth / 2 + radius * Math.cos(angle) + (Math.random() - 0.5) * 40,
        y: this.svgHeight / 2 + radius * Math.sin(angle) + (Math.random() - 0.5) * 40,
        vx: 0,
        vy: 0,
        fx: null,
        fy: null,
      };
      simNodeMap.set(n.id, sn);
      return sn;
    });

    const simEdges: SimEdge[] = edges
      .map((e) => {
        const source = simNodeMap.get(e.sourceId);
        const target = simNodeMap.get(e.targetId);
        if (!source || !target) return null;
        return {
          id: e.id,
          source,
          target,
          relationshipType: e.relationshipType,
          weight: e.weight,
        };
      })
      .filter((e): e is SimEdge => e !== null);

    this.simNodes.set(simNodes);
    this.simEdges.set(simEdges);
    this.simulationAlpha = 1;
    this.startSimulation();
  }

  private startSimulation(): void {
    if (this.simulationRunning) return;
    this.simulationRunning = true;
    this.tick();
  }

  private stopSimulation(): void {
    this.simulationRunning = false;
    if (this.animationFrame !== null) {
      if (isPlatformBrowser(this.platformId)) {
        cancelAnimationFrame(this.animationFrame);
      }
      this.animationFrame = null;
    }
  }

  private tick(): void {
    if (!this.simulationRunning || this.simulationAlpha < this.ALPHA_MIN) {
      this.simulationRunning = false;
      return;
    }

    const nodes = this.simNodes();
    const edges = this.simEdges();
    const cx = this.svgWidth / 2;
    const cy = this.svgHeight / 2;

    // Repulsive force between all node pairs
    const repulsionStrength = 800;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) dist = 1;
        const force = (repulsionStrength * this.simulationAlpha) / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // Attractive force along edges (spring)
    const springStrength = 0.05;
    const idealLength = 100;
    for (const edge of edges) {
      const dx = edge.target.x - edge.source.x;
      const dy = edge.target.y - edge.source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const displacement = dist - idealLength;
      const force = springStrength * displacement * this.simulationAlpha;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      edge.source.vx += fx;
      edge.source.vy += fy;
      edge.target.vx -= fx;
      edge.target.vy -= fy;
    }

    // Centering force
    const centerForce = 0.01 * this.simulationAlpha;
    for (const node of nodes) {
      node.vx += (cx - node.x) * centerForce;
      node.vy += (cy - node.y) * centerForce;
    }

    // Apply velocities with damping
    const damping = 0.6;
    for (const node of nodes) {
      if (node.fx !== null) {
        node.x = node.fx;
        node.vx = 0;
      } else {
        node.vx *= damping;
        node.x += node.vx;
        node.x = Math.max(20, Math.min(this.svgWidth - 20, node.x));
      }
      if (node.fy !== null) {
        node.y = node.fy;
        node.vy = 0;
      } else {
        node.vy *= damping;
        node.y += node.vy;
        node.y = Math.max(20, Math.min(this.svgHeight - 20, node.y));
      }
    }

    this.simulationAlpha -= this.ALPHA_DECAY;
    // Trigger change detection by re-setting
    this.simNodes.set([...nodes]);

    if (isPlatformBrowser(this.platformId)) {
      this.animationFrame = requestAnimationFrame(() => this.tick());
    }
  }

  // ---------- template actions ----------

  onSearch(): void {
    this.svc.searchEntities(this.searchText());
  }

  onSearchKeyup(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.onSearch();
    }
  }

  onSearchClear(): void {
    this.searchText.set('');
    this.svc.searchEntities('');
  }

  onSelectSearchResult(result: EntitySearchResult): void {
    this.svc.selectNode(result.node);
    this.highlightNodeInGraph(result.node.id);
  }

  onNodeClick(simNode: SimNode): void {
    const node = this.graphData().nodes.find((n) => n.id === simNode.id);
    if (node) {
      this.svc.selectNode(node);
    }
  }

  onEdgeClick(simEdge: SimEdge): void {
    const edge = this.graphData().edges.find((e) => e.id === simEdge.id);
    if (edge) {
      this.svc.selectEdge(edge);
    }
  }

  onCloseInspector(): void {
    this.svc.clearSelection();
  }

  onTabChange(tab: 'graph' | 'stats'): void {
    this.activeTab.set(tab);
    if (tab === 'graph') {
      this.buildSimulation();
    }
  }

  onEntityTypeFilterChange(type: string): void {
    this.filterEntityType.set(type as EntityType | '');
    this.buildSimulation();
  }

  onRefreshGraph(): void {
    this.svc.loadGraph();
    this.svc.loadStats();
  }

  // ---------- drag handlers ----------

  onNodeMouseDown(event: MouseEvent, simNode: SimNode): void {
    event.preventDefault();
    event.stopPropagation();
    this.dragNode = simNode;
    simNode.fx = simNode.x;
    simNode.fy = simNode.y;

    if (isPlatformBrowser(this.platformId)) {
      const onMouseMove = (e: MouseEvent) => {
        if (!this.dragNode) return;
        const svg = this.svgContainer()?.nativeElement;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        this.dragNode.fx = e.clientX - rect.left;
        this.dragNode.fy = e.clientY - rect.top;
        this.simulationAlpha = Math.max(this.simulationAlpha, 0.3);
        if (!this.simulationRunning) {
          this.startSimulation();
        }
      };

      const onMouseUp = () => {
        if (this.dragNode) {
          this.dragNode.fx = null;
          this.dragNode.fy = null;
          this.dragNode = null;
        }
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }
  }

  // ---------- helpers ----------

  nodeColor(entityType: EntityType): string {
    return ENTITY_COLORS[entityType] ?? '#8c8c8c';
  }

  nodeRadius(degree: number): number {
    return Math.max(6, Math.min(20, 6 + degree * 1.5));
  }

  isNodeSelected(nodeId: string): boolean {
    return this.selectedNode()?.id === nodeId;
  }

  isEdgeSelected(edgeId: string): boolean {
    return this.selectedEdge()?.id === edgeId;
  }

  isNodeHighlighted(nodeId: string): boolean {
    const selected = this.selectedNode();
    if (!selected) return false;
    if (selected.id === nodeId) return true;
    return this.selectedNodeEdges().some(
      (e) => e.sourceId === nodeId || e.targetId === nodeId,
    );
  }

  private highlightNodeInGraph(nodeId: string): void {
    // Reheat simulation to settle around the highlighted node
    this.simulationAlpha = Math.max(this.simulationAlpha, 0.3);
    if (!this.simulationRunning) {
      this.startSimulation();
    }
  }

  trackByNodeId(_: number, node: SimNode): string {
    return node.id;
  }

  trackByEdgeId(_: number, edge: SimEdge): string {
    return edge.id;
  }

  trackBySearchResult(_: number, result: EntitySearchResult): string {
    return result.node.id;
  }

  edgeStrokeWidth(weight: number): number {
    return Math.max(1, weight * 2);
  }

  trackByProperty(_: number, prop: { key: string }): string {
    return prop.key;
  }

  trackByType(_: number, item: { type: string }): string {
    return item.type;
  }
}
