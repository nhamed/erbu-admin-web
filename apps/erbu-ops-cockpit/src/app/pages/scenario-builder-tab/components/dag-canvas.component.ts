import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  ElementRef,
  viewChild,
  OnDestroy,
  effect,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScenarioEdge } from '@erbu-admin-web/shared/models';
import { StepNodeComponent, StepNodeData } from './step-node.component';

export interface EdgePath {
  id: string;
  d: string;
  label: string | null;
  condition: string | null;
  sourceId: string;
  targetId: string;
  labelX: number;
  labelY: number;
  isConditional: boolean;
}

export interface CanvasTransform {
  panX: number;
  panY: number;
  zoom: number;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 72;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.1;

@Component({
  selector: 'app-dag-canvas',
  standalone: true,
  imports: [CommonModule, StepNodeComponent],
  templateUrl: './dag-canvas.component.html',
  styleUrl: './dag-canvas.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DagCanvasComponent implements OnDestroy {
  readonly nodes = input.required<StepNodeData[]>();
  readonly edges = input.required<ScenarioEdge[]>();
  readonly selectedNodeId = input<string | null>(null);
  readonly connectingMode = input(false);

  readonly nodeSelect = output<string>();
  readonly nodeDelete = output<string>();
  readonly nodeMove = output<{ id: string; x: number; y: number }>();
  readonly edgeCreate = output<{ sourceId: string; targetId: string }>();
  readonly canvasClick = output<{ x: number; y: number }>();

  readonly svgRef = viewChild<ElementRef<SVGSVGElement>>('svgCanvas');

  // Canvas transform state
  readonly transform = signal<CanvasTransform>({ panX: 0, panY: 0, zoom: 1 });

  // Drag state
  private draggingNodeId: string | null = null;
  private dragOffsetX = 0;
  private dragOffsetY = 0;
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private panStartPanX = 0;
  private panStartPanY = 0;

  // Edge-drawing state
  readonly isDrawingEdge = signal(false);
  readonly drawEdgeFrom = signal<string | null>(null);
  readonly drawEdgeLine = signal<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // Computed edge paths for SVG rendering
  readonly edgePaths = computed<EdgePath[]>(() => {
    const nodeMap = new Map<string, StepNodeData>();
    for (const n of this.nodes()) {
      nodeMap.set(n.id, n);
    }

    return this.edges()
      .map((edge) => {
        const source = nodeMap.get(edge.sourceNodeId);
        const target = nodeMap.get(edge.targetNodeId);
        if (!source || !target) return null;

        const sx = source.x + NODE_WIDTH / 2;
        const sy = source.y + NODE_HEIGHT;
        const tx = target.x + NODE_WIDTH / 2;
        const ty = target.y;

        // Cubic bezier for smooth curves
        const midY = (sy + ty) / 2;
        const d = `M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`;

        return {
          id: edge.id,
          d,
          label: edge.label,
          condition: edge.condition,
          sourceId: edge.sourceNodeId,
          targetId: edge.targetNodeId,
          labelX: (sx + tx) / 2,
          labelY: (sy + ty) / 2 - 8,
          isConditional: !!edge.condition,
        } satisfies EdgePath;
      })
      .filter((e): e is EdgePath => e !== null);
  });

  readonly transformStyle = computed(() => {
    const t = this.transform();
    return `translate(${t.panX}px, ${t.panY}px) scale(${t.zoom})`;
  });

  readonly zoomPercent = computed(() => Math.round(this.transform().zoom * 100));

  // --- Node events ---

  onNodeSelect(nodeId: string): void {
    if (this.isDrawingEdge() && this.drawEdgeFrom()) {
      const sourceId = this.drawEdgeFrom()!;
      if (sourceId !== nodeId) {
        this.edgeCreate.emit({ sourceId, targetId: nodeId });
      }
      this.isDrawingEdge.set(false);
      this.drawEdgeFrom.set(null);
      this.drawEdgeLine.set(null);
      return;
    }
    this.nodeSelect.emit(nodeId);
  }

  onNodeDelete(nodeId: string): void {
    this.nodeDelete.emit(nodeId);
  }

  onNodeDragStart(event: { id: string; startX: number; startY: number }): void {
    const node = this.nodes().find((n) => n.id === event.id);
    if (!node) return;

    const t = this.transform();
    this.draggingNodeId = event.id;
    this.dragOffsetX = event.startX - (node.x * t.zoom + t.panX);
    this.dragOffsetY = event.startY - (node.y * t.zoom + t.panY);
  }

  // --- Canvas events ---

  onCanvasMouseDown(event: MouseEvent): void {
    // Middle mouse or left + space => pan
    if (event.button === 1 || (event.button === 0 && event.shiftKey)) {
      event.preventDefault();
      this.isPanning = true;
      this.panStartX = event.clientX;
      this.panStartY = event.clientY;
      const t = this.transform();
      this.panStartPanX = t.panX;
      this.panStartPanY = t.panY;
      return;
    }

    // Left click on canvas background => deselect + potentially place
    if (event.button === 0 && !this.draggingNodeId) {
      const t = this.transform();
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      const x = (event.clientX - rect.left - t.panX) / t.zoom;
      const y = (event.clientY - rect.top - t.panY) / t.zoom;
      this.canvasClick.emit({ x, y });
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (this.isPanning) {
      const dx = event.clientX - this.panStartX;
      const dy = event.clientY - this.panStartY;
      this.transform.update((t) => ({
        ...t,
        panX: this.panStartPanX + dx,
        panY: this.panStartPanY + dy,
      }));
      return;
    }

    if (this.draggingNodeId) {
      const t = this.transform();
      const newX = (event.clientX - this.dragOffsetX - t.panX) / t.zoom;
      const newY = (event.clientY - this.dragOffsetY - t.panY) / t.zoom;
      this.nodeMove.emit({
        id: this.draggingNodeId,
        x: Math.round(Math.max(0, newX)),
        y: Math.round(Math.max(0, newY)),
      });
    }

    // Update edge-drawing preview line
    if (this.isDrawingEdge() && this.drawEdgeFrom()) {
      const sourceNode = this.nodes().find((n) => n.id === this.drawEdgeFrom());
      if (sourceNode) {
        const t = this.transform();
        const canvasEl = this.svgRef()?.nativeElement?.parentElement;
        if (canvasEl) {
          const rect = canvasEl.getBoundingClientRect();
          this.drawEdgeLine.set({
            x1: sourceNode.x + NODE_WIDTH / 2,
            y1: sourceNode.y + NODE_HEIGHT,
            x2: (event.clientX - rect.left - t.panX) / t.zoom,
            y2: (event.clientY - rect.top - t.panY) / t.zoom,
          });
        }
      }
    }
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    if (this.draggingNodeId) {
      this.draggingNodeId = null;
    }
    this.isPanning = false;
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    this.transform.update((t) => ({
      ...t,
      zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, t.zoom + delta)),
    }));
  }

  // --- Zoom controls ---

  zoomIn(): void {
    this.transform.update((t) => ({
      ...t,
      zoom: Math.min(MAX_ZOOM, t.zoom + ZOOM_STEP),
    }));
  }

  zoomOut(): void {
    this.transform.update((t) => ({
      ...t,
      zoom: Math.max(MIN_ZOOM, t.zoom - ZOOM_STEP),
    }));
  }

  resetView(): void {
    this.transform.set({ panX: 0, panY: 0, zoom: 1 });
  }

  fitToContent(): void {
    const nodes = this.nodes();
    if (nodes.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + NODE_WIDTH);
      maxY = Math.max(maxY, n.y + NODE_HEIGHT);
    }

    const contentWidth = maxX - minX + 80;
    const contentHeight = maxY - minY + 80;

    const canvasEl = this.svgRef()?.nativeElement?.parentElement;
    if (!canvasEl) return;

    const canvasWidth = canvasEl.clientWidth;
    const canvasHeight = canvasEl.clientHeight;

    const zoom = Math.min(
      canvasWidth / contentWidth,
      canvasHeight / contentHeight,
      1.5,
    );

    this.transform.set({
      panX: (canvasWidth - contentWidth * zoom) / 2 - minX * zoom + 40,
      panY: (canvasHeight - contentHeight * zoom) / 2 - minY * zoom + 40,
      zoom,
    });
  }

  // --- Edge drawing (anchor click) ---

  startEdgeDraw(nodeId: string): void {
    this.isDrawingEdge.set(true);
    this.drawEdgeFrom.set(nodeId);
  }

  cancelEdgeDraw(): void {
    this.isDrawingEdge.set(false);
    this.drawEdgeFrom.set(null);
    this.drawEdgeLine.set(null);
  }

  ngOnDestroy(): void {
    this.draggingNodeId = null;
    this.isPanning = false;
  }
}
