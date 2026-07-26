import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { AuditScenario, AuditStatus } from '@erbu-admin-web/shared/models';
import { AuditService } from '../audit.service';
import { JsonViewerDialogComponent, JsonViewerDialogData } from '../json-viewer-dialog.component';

@Component({
  selector: 'app-scenario-runs',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatSelectModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatExpansionModule,
    MatBadgeModule,
    MatDialogModule,
    ScrollingModule,
  ],
  templateUrl: './scenario-runs.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      display: block;
      padding: 16px;
    }

    .filters-row {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
      align-items: center;
    }

    .filters-row mat-form-field {
      min-width: 180px;
    }

    .spacer { flex: 1; }

    .scenario-viewport {
      height: calc(100vh - 320px);
      min-height: 400px;
    }

    .scenario-card {
      margin-bottom: 8px;
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 8px;
      overflow: hidden;
    }

    .scenario-header {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      gap: 12px;
      cursor: pointer;
    }

    .scenario-header:hover {
      background: rgba(0, 0, 0, 0.04);
    }

    .scenario-name {
      font-weight: 500;
      font-size: 14px;
      flex: 1;
    }

    .scenario-category {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.54);
    }

    .scenario-meta {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: rgba(0, 0, 0, 0.54);
    }

    .status-chip {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 10px;
      border-radius: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .status-draft { background: #e0e0e0; color: #616161; }
    .status-ready { background: #e3f2fd; color: #1565c0; }
    .status-running { background: #fff3e0; color: #e65100; }
    .status-passed { background: #e8f5e9; color: #2e7d32; }
    .status-failed { background: #ffebee; color: #c62828; }
    .status-blocked { background: #fce4ec; color: #880e4f; }

    .steps-table {
      width: 100%;
    }

    .steps-table th {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.54);
      font-weight: 600;
    }

    .expansion-body {
      padding: 0 16px 16px;
    }

    .outcome-section {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 12px;
      padding: 12px;
      background: rgba(0, 0, 0, 0.02);
      border-radius: 4px;
    }

    .outcome-label {
      font-size: 11px;
      text-transform: uppercase;
      color: rgba(0, 0, 0, 0.54);
      margin-bottom: 4px;
      font-weight: 600;
    }

    .outcome-value {
      font-size: 13px;
    }

    .tags-row {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
      margin-top: 8px;
    }

    .action-buttons {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }

    .empty-state {
      text-align: center;
      padding: 48px;
      color: rgba(0, 0, 0, 0.38);
    }

    .empty-state mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
    }

    .loading-overlay {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 48px;
    }
  `],
})
export class ScenarioRunsComponent implements OnInit {
  private readonly auditService = inject(AuditService);
  private readonly dialog = inject(MatDialog);

  readonly scenarios = signal<AuditScenario[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly expandedScenarioId = signal<string | null>(null);

  readonly categoryFilter = signal<string>('');
  readonly statusFilter = signal<string>('');

  readonly filteredScenarios = computed(() => {
    let list = this.scenarios();
    const cat = this.categoryFilter();
    const st = this.statusFilter();
    if (cat) list = list.filter(s => s.category === cat);
    if (st) list = list.filter(s => s.status === st);
    return list;
  });

  readonly categories = computed(() => {
    const cats = new Set(this.scenarios().map(s => s.category));
    return Array.from(cats).sort();
  });

  readonly statusOptions = Object.values(AuditStatus);

  readonly displayedColumns = ['order', 'action', 'expectedResult', 'actualResult', 'status'];

  ngOnInit(): void {
    this.loadScenarios();
  }

  loadScenarios(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.auditService.getScenarios().subscribe({
      next: data => {
        this.scenarios.set(data);
        this.isLoading.set(false);
      },
      error: err => {
        this.error.set(err?.message ?? 'Failed to load scenarios');
        this.isLoading.set(false);
      },
    });
  }

  toggleExpand(id: string): void {
    this.expandedScenarioId.update(current => current === id ? null : id);
  }

  runScenario(scenario: AuditScenario, event: Event): void {
    event.stopPropagation();
    this.auditService
      .runScenario({ scenarioId: scenario.id, baselineId: scenario.baselineId ?? undefined })
      .subscribe({
        next: updated => {
          this.scenarios.update(list =>
            list.map(s => (s.id === updated.id ? updated : s)),
          );
        },
        error: err => {
          this.error.set(err?.message ?? 'Failed to run scenario');
        },
      });
  }

  viewStepDetails(scenario: AuditScenario): void {
    this.dialog.open(JsonViewerDialogComponent, {
      data: {
        title: `Steps: ${scenario.name}`,
        json: scenario.steps,
      } satisfies JsonViewerDialogData,
      width: '720px',
    });
  }

  getStatusClass(status: AuditStatus): string {
    return 'status-' + status.toLowerCase();
  }
}
