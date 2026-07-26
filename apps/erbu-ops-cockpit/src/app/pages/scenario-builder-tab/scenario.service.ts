import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError, delay, map } from 'rxjs';
import {
  ScenarioNode,
  ScenarioNodeType,
  ScenarioEdge,
} from '@erbu-admin-web/shared/models';

// ---------- DTOs ----------

export interface Scenario {
  id: string;
  name: string;
  description: string;
  nodes: ScenarioNode[];
  edges: ScenarioEdge[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  version: number;
  tags: string[];
}

export interface ScenarioSummary {
  id: string;
  name: string;
  description: string;
  nodeCount: number;
  edgeCount: number;
  updatedAt: string;
  version: number;
}

export interface ScenarioValidationError {
  nodeId: string | null;
  edgeId: string | null;
  severity: 'error' | 'warning';
  message: string;
  field: string | null;
}

export interface ScenarioValidationResult {
  valid: boolean;
  errors: ScenarioValidationError[];
}

export interface ScenarioRunStatus {
  runId: string;
  scenarioId: string;
  status: ScenarioRunState;
  currentNodeId: string | null;
  completedNodeIds: string[];
  failedNodeIds: string[];
  startedAt: string;
  completedAt: string | null;
  logs: ScenarioRunLog[];
}

export type ScenarioRunState =
  | 'Queued'
  | 'Running'
  | 'Passed'
  | 'Failed'
  | 'Cancelled';

export interface ScenarioRunLog {
  timestamp: string;
  nodeId: string | null;
  level: 'info' | 'warn' | 'error';
  message: string;
}

export interface CreateScenarioRequest {
  name: string;
  description: string;
  tags: string[];
}

export interface UpdateScenarioRequest {
  name?: string;
  description?: string;
  nodes: ScenarioNode[];
  edges: ScenarioEdge[];
  tags?: string[];
}

export interface YamlImportResult {
  scenario: Scenario;
  warnings: string[];
}

// ---------- Service ----------

const API_BASE = '/api/ops/scenarios';

@Injectable({ providedIn: 'root' })
export class ScenarioService {
  private readonly http = inject(HttpClient);

  // ---- CRUD ----

  list(): Observable<ScenarioSummary[]> {
    return this.http.get<ScenarioSummary[]>(API_BASE);
  }

  getById(id: string): Observable<Scenario> {
    return this.http.get<Scenario>(
      `${API_BASE}/${encodeURIComponent(id)}`,
    );
  }

  create(request: CreateScenarioRequest): Observable<Scenario> {
    return this.http.post<Scenario>(API_BASE, request);
  }

  update(id: string, request: UpdateScenarioRequest): Observable<Scenario> {
    return this.http.put<Scenario>(
      `${API_BASE}/${encodeURIComponent(id)}`,
      request,
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(
      `${API_BASE}/${encodeURIComponent(id)}`,
    );
  }

  // ---- Validation ----

  validate(scenario: Scenario): ScenarioValidationResult {
    const errors: ScenarioValidationError[] = [];

    // Must have at least one node
    if (scenario.nodes.length === 0) {
      errors.push({
        nodeId: null,
        edgeId: null,
        severity: 'error',
        message: 'Scenario must contain at least one step node.',
        field: null,
      });
    }

    // Must have exactly one entry point
    const entryPoints = scenario.nodes.filter((n) => n.isEntryPoint);
    if (entryPoints.length === 0) {
      errors.push({
        nodeId: null,
        edgeId: null,
        severity: 'error',
        message: 'Scenario must have exactly one entry point.',
        field: 'isEntryPoint',
      });
    } else if (entryPoints.length > 1) {
      for (const ep of entryPoints.slice(1)) {
        errors.push({
          nodeId: ep.id,
          edgeId: null,
          severity: 'error',
          message: `Duplicate entry point: "${ep.label}".`,
          field: 'isEntryPoint',
        });
      }
    }

    // Must have at least one terminal
    const terminals = scenario.nodes.filter((n) => n.isTerminal);
    if (terminals.length === 0) {
      errors.push({
        nodeId: null,
        edgeId: null,
        severity: 'warning',
        message: 'Scenario has no terminal node. Execution may not terminate.',
        field: 'isTerminal',
      });
    }

    // Every node must have a label
    for (const node of scenario.nodes) {
      if (!node.label.trim()) {
        errors.push({
          nodeId: node.id,
          edgeId: null,
          severity: 'error',
          message: 'Node label must not be empty.',
          field: 'label',
        });
      }
    }

    // Edge references must be valid
    const nodeIds = new Set(scenario.nodes.map((n) => n.id));
    for (const edge of scenario.edges) {
      if (!nodeIds.has(edge.sourceNodeId)) {
        errors.push({
          nodeId: null,
          edgeId: edge.id,
          severity: 'error',
          message: `Edge source "${edge.sourceNodeId}" does not exist.`,
          field: 'sourceNodeId',
        });
      }
      if (!nodeIds.has(edge.targetNodeId)) {
        errors.push({
          nodeId: null,
          edgeId: edge.id,
          severity: 'error',
          message: `Edge target "${edge.targetNodeId}" does not exist.`,
          field: 'targetNodeId',
        });
      }
    }

    // Detect orphan nodes (no incoming or outgoing edges, excluding entry/terminal)
    for (const node of scenario.nodes) {
      if (node.isEntryPoint) continue;
      const hasIncoming = scenario.edges.some(
        (e) => e.targetNodeId === node.id,
      );
      if (!hasIncoming) {
        errors.push({
          nodeId: node.id,
          edgeId: null,
          severity: 'warning',
          message: `Node "${node.label}" has no incoming edges and is not an entry point.`,
          field: null,
        });
      }
    }

    return { valid: errors.filter((e) => e.severity === 'error').length === 0, errors };
  }

  // ---- Run ----

  run(scenarioId: string): Observable<ScenarioRunStatus> {
    return this.http.post<ScenarioRunStatus>(
      `${API_BASE}/${encodeURIComponent(scenarioId)}/run`,
      null,
    );
  }

  getRunStatus(scenarioId: string, runId: string): Observable<ScenarioRunStatus> {
    return this.http.get<ScenarioRunStatus>(
      `${API_BASE}/${encodeURIComponent(scenarioId)}/runs/${encodeURIComponent(runId)}`,
    );
  }

  cancelRun(scenarioId: string, runId: string): Observable<void> {
    return this.http.post<void>(
      `${API_BASE}/${encodeURIComponent(scenarioId)}/runs/${encodeURIComponent(runId)}/cancel`,
      null,
    );
  }

  // ---- YAML import / export ----

  exportYaml(scenario: Scenario): string {
    const yamlLines: string[] = [];
    yamlLines.push(`# Scenario: ${scenario.name}`);
    yamlLines.push(`name: "${this.escapeYaml(scenario.name)}"`);
    yamlLines.push(`description: "${this.escapeYaml(scenario.description)}"`);
    yamlLines.push(`version: ${scenario.version}`);

    if (scenario.tags.length > 0) {
      yamlLines.push('tags:');
      for (const tag of scenario.tags) {
        yamlLines.push(`  - "${this.escapeYaml(tag)}"`);
      }
    }

    yamlLines.push('');
    yamlLines.push('nodes:');
    for (const node of scenario.nodes) {
      yamlLines.push(`  - id: "${node.id}"`);
      yamlLines.push(`    label: "${this.escapeYaml(node.label)}"`);
      yamlLines.push(`    type: ${node.type}`);
      yamlLines.push(`    x: ${node.x}`);
      yamlLines.push(`    y: ${node.y}`);
      yamlLines.push(`    isEntryPoint: ${node.isEntryPoint}`);
      yamlLines.push(`    isTerminal: ${node.isTerminal}`);
      if (Object.keys(node.config).length > 0) {
        yamlLines.push(`    config:`);
        for (const [key, val] of Object.entries(node.config)) {
          yamlLines.push(`      ${key}: "${this.escapeYaml(String(val))}"`);
        }
      }
    }

    yamlLines.push('');
    yamlLines.push('edges:');
    for (const edge of scenario.edges) {
      yamlLines.push(`  - id: "${edge.id}"`);
      yamlLines.push(`    source: "${edge.sourceNodeId}"`);
      yamlLines.push(`    target: "${edge.targetNodeId}"`);
      yamlLines.push(`    order: ${edge.order}`);
      if (edge.label) {
        yamlLines.push(`    label: "${this.escapeYaml(edge.label)}"`);
      }
      if (edge.condition) {
        yamlLines.push(`    condition: "${this.escapeYaml(edge.condition)}"`);
      }
    }

    return yamlLines.join('\n') + '\n';
  }

  importYaml(yaml: string): Observable<YamlImportResult> {
    return this.http.post<YamlImportResult>(`${API_BASE}/import-yaml`, {
      yaml,
    });
  }

  /**
   * Client-side YAML parser for simple scenario YAML format.
   * For production use, the server-side import is preferred.
   */
  parseYamlLocally(yaml: string): { scenario: Partial<Scenario>; warnings: string[] } {
    const warnings: string[] = [];
    const lines = yaml.split('\n');
    const scenario: Partial<Scenario> = {
      nodes: [],
      edges: [],
      tags: [],
    };

    let section: 'root' | 'tags' | 'nodes' | 'edges' | 'config' = 'root';
    let currentNode: Partial<ScenarioNode> | null = null;
    let currentEdge: Partial<ScenarioEdge> | null = null;
    let currentConfig: Record<string, unknown> = {};

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();
      const trimmed = line.trim();

      // Skip comments and blank lines
      if (!trimmed || trimmed.startsWith('#')) continue;

      // Top-level section headers
      if (trimmed === 'nodes:') {
        this.flushNode(currentNode, currentConfig, scenario);
        currentNode = null;
        currentConfig = {};
        section = 'nodes';
        continue;
      }
      if (trimmed === 'edges:') {
        this.flushNode(currentNode, currentConfig, scenario);
        this.flushEdge(currentEdge, scenario);
        currentNode = null;
        currentEdge = null;
        currentConfig = {};
        section = 'edges';
        continue;
      }
      if (trimmed === 'tags:') {
        section = 'tags';
        continue;
      }
      if (trimmed === 'config:') {
        section = 'config';
        continue;
      }

      const kvMatch = trimmed.match(/^(\w+):\s*(.*)$/);

      if (section === 'root' && kvMatch) {
        const [, key, val] = kvMatch;
        const unquoted = this.unquoteYaml(val);
        if (key === 'name') scenario.name = unquoted;
        else if (key === 'description') scenario.description = unquoted;
        else if (key === 'version') scenario.version = parseInt(unquoted, 10) || 1;
        continue;
      }

      if (section === 'tags' && trimmed.startsWith('- ')) {
        scenario.tags!.push(this.unquoteYaml(trimmed.slice(2).trim()));
        continue;
      }

      if (section === 'nodes') {
        if (trimmed.startsWith('- id:')) {
          this.flushNode(currentNode, currentConfig, scenario);
          currentConfig = {};
          currentNode = { id: this.unquoteYaml(trimmed.replace('- id:', '').trim()) };
          continue;
        }
        if (currentNode && kvMatch) {
          const [, key, val] = kvMatch;
          const unquoted = this.unquoteYaml(val);
          if (key === 'label') currentNode.label = unquoted;
          else if (key === 'type') currentNode.type = unquoted as ScenarioNodeType;
          else if (key === 'x') currentNode.x = parseFloat(unquoted) || 0;
          else if (key === 'y') currentNode.y = parseFloat(unquoted) || 0;
          else if (key === 'isEntryPoint') currentNode.isEntryPoint = unquoted === 'true';
          else if (key === 'isTerminal') currentNode.isTerminal = unquoted === 'true';
          else if (key === 'config') {
            section = 'config';
          } else if (line.startsWith('      ')) {
            currentConfig[key] = unquoted;
          }
        }
        continue;
      }

      if (section === 'config' && currentNode) {
        if (kvMatch) {
          const [, key, val] = kvMatch;
          // Detect if we've left the config sub-block
          if (!line.startsWith('      ') && key !== 'config') {
            section = 'nodes';
            // Re-process this line as a node field
            const unquoted = this.unquoteYaml(val);
            if (key === 'label') currentNode.label = unquoted;
            else if (key === 'type') currentNode.type = unquoted as ScenarioNodeType;
            else if (key === 'x') currentNode.x = parseFloat(unquoted) || 0;
            else if (key === 'y') currentNode.y = parseFloat(unquoted) || 0;
            else if (key === 'isEntryPoint') currentNode.isEntryPoint = unquoted === 'true';
            else if (key === 'isTerminal') currentNode.isTerminal = unquoted === 'true';
          } else {
            currentConfig[kvMatch[1]] = this.unquoteYaml(kvMatch[2]);
          }
        }
        continue;
      }

      if (section === 'edges') {
        if (trimmed.startsWith('- id:')) {
          this.flushEdge(currentEdge, scenario);
          currentEdge = { id: this.unquoteYaml(trimmed.replace('- id:', '').trim()) };
          continue;
        }
        if (currentEdge && kvMatch) {
          const [, key, val] = kvMatch;
          const unquoted = this.unquoteYaml(val);
          if (key === 'source') currentEdge.sourceNodeId = unquoted;
          else if (key === 'target') currentEdge.targetNodeId = unquoted;
          else if (key === 'label') currentEdge.label = unquoted;
          else if (key === 'condition') currentEdge.condition = unquoted;
          else if (key === 'order') currentEdge.order = parseInt(unquoted, 10) || 0;
        }
        continue;
      }
    }

    // Flush remaining
    this.flushNode(currentNode, currentConfig, scenario);
    this.flushEdge(currentEdge, scenario);

    if (!scenario.name) {
      warnings.push('No scenario name found in YAML.');
    }

    return { scenario, warnings };
  }

  // ---------- Private helpers ----------

  private flushNode(
    node: Partial<ScenarioNode> | null,
    config: Record<string, unknown>,
    scenario: Partial<Scenario>,
  ): void {
    if (!node || !node.id) return;
    const full: ScenarioNode = {
      id: node.id,
      scenarioId: scenario.id ?? '',
      type: node.type ?? ScenarioNodeType.Action,
      label: node.label ?? 'Untitled',
      x: node.x ?? 0,
      y: node.y ?? 0,
      config: Object.keys(config).length > 0 ? { ...config } : {},
      isEntryPoint: node.isEntryPoint ?? false,
      isTerminal: node.isTerminal ?? false,
      status: null,
    };
    scenario.nodes!.push(full);
  }

  private flushEdge(
    edge: Partial<ScenarioEdge> | null,
    scenario: Partial<Scenario>,
  ): void {
    if (!edge || !edge.id) return;
    const full: ScenarioEdge = {
      id: edge.id,
      scenarioId: scenario.id ?? '',
      sourceNodeId: edge.sourceNodeId ?? '',
      targetNodeId: edge.targetNodeId ?? '',
      label: edge.label ?? null,
      condition: edge.condition ?? null,
      order: edge.order ?? 0,
    };
    scenario.edges!.push(full);
  }

  private escapeYaml(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  private unquoteYaml(value: string): string {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    }
    return trimmed;
  }
}
