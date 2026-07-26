import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ScenarioNode,
  ScenarioNodeType,
  ScenarioEdge,
} from '@erbu-admin-web/shared/models';
import { DagCanvasComponent } from './components/dag-canvas.component';
import { StepNodeData } from './components/step-node.component';
import {
  ScenarioService,
  Scenario,
  ScenarioValidationResult,
  ScenarioValidationError,
  ScenarioRunStatus,
} from './scenario.service';
import { Subscription, interval, switchMap, takeWhile } from 'rxjs';

// ---------- Helper to generate unique IDs ----------
let _idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++_idCounter}`;
}

@Component({
  selector: 'app-scenario-builder-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, DagCanvasComponent],
  templateUrl: './scenario-builder-tab.page.html',
  styleUrl: './scenario-builder-tab.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScenarioBuilderTabPage implements OnInit, OnDestroy {
  private readonly scenarioService = inject(ScenarioService);
  private runPollSub: Subscription | null = null;

  // ---------- Scenario list ----------
  readonly scenarios = signal<Scenario[]>([]);
  readonly activeScenarioId = signal<string | null>(null);

  // ---------- Active scenario working copy ----------
  readonly scenarioName = signal('Untitled Scenario');
  readonly scenarioDescription = signal('');
  readonly scenarioTags = signal<string[]>([]);
  readonly nodes = signal<ScenarioNode[]>([]);
  readonly edges = signal<ScenarioEdge[]>([]);
  readonly scenarioVersion = signal(1);
  readonly isDirty = signal(false);

  // ---------- Selection / panel ----------
  readonly selectedNodeId = signal<string | null>(null);
  readonly selectedNode = computed(() => {
    const id = this.selectedNodeId();
    if (!id) return null;
    return this.nodes().find((n) => n.id === id) ?? null;
  });

  // Configuration panel editable fields
  readonly editLabel = signal('');
  readonly editType = signal<ScenarioNodeType>(ScenarioNodeType.Action);
  readonly editIsEntry = signal(false);
  readonly editIsTerminal = signal(false);
  readonly editConfigJson = signal('{}');

  // ---------- Validation ----------
  readonly validationResult = signal<ScenarioValidationResult | null>(null);
  readonly errorNodeIds = computed(() => {
    const result = this.validationResult();
    if (!result) return new Set<string>();
    const ids = new Set<string>();
    for (const err of result.errors) {
      if (err.nodeId) ids.add(err.nodeId);
    }
    return ids;
  });

  // ---------- Run state ----------
  readonly runStatus = signal<ScenarioRunStatus | null>(null);
  readonly isRunning = computed(
    () => this.runStatus()?.status === 'Running' || this.runStatus()?.status === 'Queued',
  );

  // ---------- YAML panel ----------
  readonly showYamlPanel = signal(false);
  readonly yamlContent = signal('');
  readonly yamlImportWarnings = signal<string[]>([]);

  // ---------- Node palette ----------
  readonly nodeTypes: { type: ScenarioNodeType; label: string; icon: string }[] = [
    { type: ScenarioNodeType.Action, label: 'Action', icon: 'play_arrow' },
    { type: ScenarioNodeType.Condition, label: 'Condition', icon: 'call_split' },
    { type: ScenarioNodeType.Wait, label: 'Wait', icon: 'hourglass_empty' },
    { type: ScenarioNodeType.Assert, label: 'Assert', icon: 'check_circle' },
    { type: ScenarioNodeType.Loop, label: 'Loop', icon: 'loop' },
    { type: ScenarioNodeType.Parallel, label: 'Parallel', icon: 'view_column' },
    { type: ScenarioNodeType.SubScenario, label: 'Sub-scenario', icon: 'account_tree' },
  ];

  // ---------- Mapped view data for canvas ----------
  readonly stepNodes = computed<StepNodeData[]>(() => {
    const errorIds = this.errorNodeIds();
    const run = this.runStatus();
    return this.nodes().map((n) => ({
      id: n.id,
      label: n.label,
      type: n.type,
      x: n.x,
      y: n.y,
      isEntryPoint: n.isEntryPoint,
      isTerminal: n.isTerminal,
      status: this.getNodeRunStatus(n.id, run),
      hasError: errorIds.has(n.id),
    }));
  });

  // ---------- Loading / error ----------
  readonly loading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  // ---------- Connect mode ----------
  readonly connectMode = signal(false);

  ngOnInit(): void {
    this.loadScenarios();
  }

  ngOnDestroy(): void {
    this.runPollSub?.unsubscribe();
  }

  // ===== Scenario CRUD =====

  loadScenarios(): void {
    this.loading.set(true);
    this.scenarioService.list().subscribe({
      next: (summaries) => {
        // Convert summaries to minimal Scenario shells
        this.scenarios.set(
          summaries.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
            nodes: [],
            edges: [],
            createdAt: '',
            updatedAt: s.updatedAt,
            createdBy: '',
            version: s.version,
            tags: [],
          })),
        );
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set('Failed to load scenarios.');
        this.loading.set(false);
        console.error('ScenarioBuilder: load error', err);
      },
    });
  }

  openScenario(id: string): void {
    this.loading.set(true);
    this.scenarioService.getById(id).subscribe({
      next: (scenario) => {
        this.setActiveScenario(scenario);
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set('Failed to open scenario.');
        this.loading.set(false);
        console.error('ScenarioBuilder: open error', err);
      },
    });
  }

  newScenario(): void {
    this.activeScenarioId.set(null);
    this.scenarioName.set('Untitled Scenario');
    this.scenarioDescription.set('');
    this.scenarioTags.set([]);
    this.nodes.set([]);
    this.edges.set([]);
    this.scenarioVersion.set(1);
    this.selectedNodeId.set(null);
    this.validationResult.set(null);
    this.runStatus.set(null);
    this.isDirty.set(false);
    this.errorMessage.set(null);
  }

  saveScenario(): void {
    const id = this.activeScenarioId();
    this.loading.set(true);

    if (id) {
      this.scenarioService
        .update(id, {
          name: this.scenarioName(),
          description: this.scenarioDescription(),
          nodes: this.nodes(),
          edges: this.edges(),
          tags: this.scenarioTags(),
        })
        .subscribe({
          next: (saved) => {
            this.setActiveScenario(saved);
            this.isDirty.set(false);
            this.loading.set(false);
          },
          error: (err) => {
            this.errorMessage.set('Failed to save scenario.');
            this.loading.set(false);
            console.error('ScenarioBuilder: save error', err);
          },
        });
    } else {
      this.scenarioService
        .create({
          name: this.scenarioName(),
          description: this.scenarioDescription(),
          tags: this.scenarioTags(),
        })
        .subscribe({
          next: (created) => {
            // Update with nodes/edges
            this.scenarioService
              .update(created.id, {
                nodes: this.nodes(),
                edges: this.edges(),
              })
              .subscribe({
                next: (saved) => {
                  this.setActiveScenario(saved);
                  this.isDirty.set(false);
                  this.loading.set(false);
                  this.loadScenarios();
                },
                error: (err) => {
                  this.errorMessage.set('Created but failed to save graph.');
                  this.loading.set(false);
                  console.error('ScenarioBuilder: update after create error', err);
                },
              });
          },
          error: (err) => {
            this.errorMessage.set('Failed to create scenario.');
            this.loading.set(false);
            console.error('ScenarioBuilder: create error', err);
          },
        });
    }
  }

  deleteScenario(): void {
    const id = this.activeScenarioId();
    if (!id) return;
    if (!confirm('Delete this scenario permanently?')) return;

    this.scenarioService.delete(id).subscribe({
      next: () => {
        this.newScenario();
        this.loadScenarios();
      },
      error: (err) => {
        this.errorMessage.set('Failed to delete scenario.');
        console.error('ScenarioBuilder: delete error', err);
      },
    });
  }

  // ===== Node operations =====

  addNode(type: ScenarioNodeType, x?: number, y?: number): void {
    const isFirst = this.nodes().length === 0;
    const node: ScenarioNode = {
      id: nextId('node'),
      scenarioId: this.activeScenarioId() ?? '',
      type,
      label: `${type} step`,
      x: x ?? 100 + this.nodes().length * 40,
      y: y ?? 100 + this.nodes().length * 100,
      config: {},
      isEntryPoint: isFirst,
      isTerminal: false,
      status: null,
    };
    this.nodes.update((ns) => [...ns, node]);
    this.selectedNodeId.set(node.id);
    this.syncEditPanel(node);
    this.isDirty.set(true);
    this.clearValidation();
  }

  deleteNode(nodeId: string): void {
    this.nodes.update((ns) => ns.filter((n) => n.id !== nodeId));
    this.edges.update((es) =>
      es.filter((e) => e.sourceNodeId !== nodeId && e.targetNodeId !== nodeId),
    );
    if (this.selectedNodeId() === nodeId) {
      this.selectedNodeId.set(null);
    }
    this.isDirty.set(true);
    this.clearValidation();
  }

  moveNode(event: { id: string; x: number; y: number }): void {
    this.nodes.update((ns) =>
      ns.map((n) =>
        n.id === event.id ? { ...n, x: event.x, y: event.y } : n,
      ),
    );
    this.isDirty.set(true);
  }

  selectNode(nodeId: string): void {
    this.selectedNodeId.set(nodeId);
    const node = this.nodes().find((n) => n.id === nodeId);
    if (node) {
      this.syncEditPanel(node);
    }
  }

  deselectNode(): void {
    this.selectedNodeId.set(null);
  }

  onCanvasClick(event: { x: number; y: number }): void {
    this.selectedNodeId.set(null);
  }

  // ===== Node config panel =====

  applyNodeConfig(): void {
    const id = this.selectedNodeId();
    if (!id) return;

    let config: Record<string, unknown> = {};
    try {
      config = JSON.parse(this.editConfigJson());
    } catch {
      this.errorMessage.set('Invalid JSON in config field.');
      return;
    }

    this.nodes.update((ns) =>
      ns.map((n) =>
        n.id === id
          ? {
              ...n,
              label: this.editLabel(),
              type: this.editType(),
              isEntryPoint: this.editIsEntry(),
              isTerminal: this.editIsTerminal(),
              config,
            }
          : n,
      ),
    );

    // If setting as entry point, clear others
    if (this.editIsEntry()) {
      this.nodes.update((ns) =>
        ns.map((n) =>
          n.id !== id && n.isEntryPoint ? { ...n, isEntryPoint: false } : n,
        ),
      );
    }

    this.isDirty.set(true);
    this.errorMessage.set(null);
    this.clearValidation();
  }

  // ===== Edge operations =====

  addEdge(event: { sourceId: string; targetId: string }): void {
    // Prevent duplicates
    const exists = this.edges().some(
      (e) =>
        e.sourceNodeId === event.sourceId &&
        e.targetNodeId === event.targetId,
    );
    if (exists) return;

    const edge: ScenarioEdge = {
      id: nextId('edge'),
      scenarioId: this.activeScenarioId() ?? '',
      sourceNodeId: event.sourceId,
      targetNodeId: event.targetId,
      label: null,
      condition: null,
      order: this.edges().length,
    };
    this.edges.update((es) => [...es, edge]);
    this.isDirty.set(true);
    this.connectMode.set(false);
    this.clearValidation();
  }

  toggleConnectMode(): void {
    this.connectMode.update((v) => !v);
  }

  // ===== Validation =====

  validateScenario(): void {
    const scenario = this.buildScenarioObject();
    const result = this.scenarioService.validate(scenario);
    this.validationResult.set(result);
  }

  clearValidation(): void {
    this.validationResult.set(null);
  }

  // ===== Run =====

  runScenario(): void {
    const id = this.activeScenarioId();
    if (!id) {
      this.errorMessage.set('Save the scenario before running.');
      return;
    }

    // Validate first
    this.validateScenario();
    if (this.validationResult() && !this.validationResult()!.valid) {
      this.errorMessage.set('Fix validation errors before running.');
      return;
    }

    this.errorMessage.set(null);
    this.scenarioService.run(id).subscribe({
      next: (status) => {
        this.runStatus.set(status);
        this.pollRunStatus(id, status.runId);
      },
      error: (err) => {
        this.errorMessage.set('Failed to start scenario run.');
        console.error('ScenarioBuilder: run error', err);
      },
    });
  }

  cancelRun(): void {
    const id = this.activeScenarioId();
    const runId = this.runStatus()?.runId;
    if (!id || !runId) return;

    this.scenarioService.cancelRun(id, runId).subscribe({
      next: () => {
        this.runPollSub?.unsubscribe();
        this.runStatus.update((s) =>
          s ? { ...s, status: 'Cancelled' } : null,
        );
      },
      error: (err) => {
        this.errorMessage.set('Failed to cancel run.');
        console.error('ScenarioBuilder: cancel error', err);
      },
    });
  }

  // ===== YAML =====

  toggleYamlPanel(): void {
    this.showYamlPanel.update((v) => !v);
    if (this.showYamlPanel()) {
      this.exportToYaml();
    }
  }

  exportToYaml(): void {
    const scenario = this.buildScenarioObject();
    this.yamlContent.set(this.scenarioService.exportYaml(scenario));
    this.yamlImportWarnings.set([]);
  }

  importFromYaml(): void {
    const yaml = this.yamlContent();
    if (!yaml.trim()) {
      this.errorMessage.set('YAML content is empty.');
      return;
    }

    const { scenario, warnings } = this.scenarioService.parseYamlLocally(yaml);
    this.yamlImportWarnings.set(warnings);

    if (scenario.name) this.scenarioName.set(scenario.name);
    if (scenario.description) this.scenarioDescription.set(scenario.description);
    if (scenario.tags) this.scenarioTags.set(scenario.tags);
    if (scenario.nodes) this.nodes.set(scenario.nodes);
    if (scenario.edges) this.edges.set(scenario.edges);
    if (scenario.version) this.scenarioVersion.set(scenario.version);

    this.isDirty.set(true);
    this.selectedNodeId.set(null);
    this.clearValidation();
    this.errorMessage.set(null);
  }

  downloadYaml(): void {
    this.exportToYaml();
    const blob = new Blob([this.yamlContent()], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.scenarioName().replace(/\s+/g, '_').toLowerCase()}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  uploadYaml(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      this.yamlContent.set(reader.result as string);
      this.importFromYaml();
    };
    reader.readAsText(file);
    input.value = '';
  }

  // ===== Dismiss error =====

  dismissError(): void {
    this.errorMessage.set(null);
  }

  // ===== Expose ScenarioNodeType for template =====
  readonly ScenarioNodeType = ScenarioNodeType;

  // ===== Private helpers =====

  private setActiveScenario(scenario: Scenario): void {
    this.activeScenarioId.set(scenario.id);
    this.scenarioName.set(scenario.name);
    this.scenarioDescription.set(scenario.description);
    this.scenarioTags.set([...scenario.tags]);
    this.nodes.set([...scenario.nodes]);
    this.edges.set([...scenario.edges]);
    this.scenarioVersion.set(scenario.version);
    this.selectedNodeId.set(null);
    this.validationResult.set(null);
    this.runStatus.set(null);
    this.isDirty.set(false);
    this.errorMessage.set(null);
  }

  private syncEditPanel(node: ScenarioNode): void {
    this.editLabel.set(node.label);
    this.editType.set(node.type);
    this.editIsEntry.set(node.isEntryPoint);
    this.editIsTerminal.set(node.isTerminal);
    this.editConfigJson.set(JSON.stringify(node.config, null, 2));
  }

  private buildScenarioObject(): Scenario {
    return {
      id: this.activeScenarioId() ?? '',
      name: this.scenarioName(),
      description: this.scenarioDescription(),
      nodes: this.nodes(),
      edges: this.edges(),
      createdAt: '',
      updatedAt: new Date().toISOString(),
      createdBy: '',
      version: this.scenarioVersion(),
      tags: this.scenarioTags(),
    };
  }

  private getNodeRunStatus(
    nodeId: string,
    run: ScenarioRunStatus | null,
  ): StepNodeData['status'] {
    if (!run) return null;
    if (run.currentNodeId === nodeId) return 'running';
    if (run.completedNodeIds.includes(nodeId)) return 'passed';
    if (run.failedNodeIds.includes(nodeId)) return 'failed';
    return 'idle';
  }

  private pollRunStatus(scenarioId: string, runId: string): void {
    this.runPollSub?.unsubscribe();
    this.runPollSub = interval(2000)
      .pipe(
        switchMap(() => this.scenarioService.getRunStatus(scenarioId, runId)),
        takeWhile(
          (status) => status.status === 'Running' || status.status === 'Queued',
          true,
        ),
      )
      .subscribe({
        next: (status) => {
          this.runStatus.set(status);
        },
        error: (err) => {
          this.errorMessage.set('Lost connection to run status.');
          console.error('ScenarioBuilder: poll error', err);
        },
      });
  }
}
