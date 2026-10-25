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
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { AuditDiscrepancy, DiscrepancySeverity } from '@erbu-admin-web/shared/models';
import { AuditService } from '../audit.service';
import { JsonViewerDialogComponent, JsonViewerDialogData } from '../json-viewer-dialog.component';

@Component({
  selector: 'app-discrepancies',
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
    MatDialogModule,
    ScrollingModule,
  ],
  templateUrl: './discrepancies.component.html',
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

    .spacer { flex: 1; }

    .summary-bar {
      display: flex;
      gap: 24px;
      margin-bottom: 16px;
      padding: 12px 16px;
      background: rgba(0, 0, 0, 0.02);
      border-radius: 8px;
    }

    .summary-item {
      text-align: center;
    }

    .summary-value {
      font-size: 24px;
      font-weight: 600;
    }

    .summary-label {
      font-size: 11px;
      color: rgba(0, 0, 0, 0.54);
      text-transform: uppercase;
    }

    .severity-critical .summary-value { color: #c62828; }
    .severity-high .summary-value { color: #e65100; }
    .severity-medium .summary-value { color: #f9a825; }
    .severity-low .summary-value { color: #2e7d32; }

    .discrepancy-viewport {
      height: calc(100vh - 380px);
      min-height: 350px;
    }

    .discrepancy-card {
      display: flex;
      flex-direction: column;
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 8px;
      transition: box-shadow 0.2s;
    }

    .discrepancy-card:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .discrepancy-card.resolved {
      opacity: 0.6;
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }

    .field-name {
      font-weight: 500;
      font-size: 14px;
      flex: 1;
    }

    .scenario-ref {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.54);
    }

    .severity-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 10px;
      border-radius: 12px;
      text-transform: uppercase;
    }

    .sev-critical { background: #ffebee; color: #c62828; }
    .sev-high { background: #fff3e0; color: #e65100; }
    .sev-medium { background: #fffde7; color: #f57f17; }
    .sev-low { background: #e8f5e9; color: #2e7d32; }

    .values-comparison {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin: 8px 0;
      padding: 8px 12px;
      background: rgba(0, 0, 0, 0.02);
      border-radius: 4px;
      font-size: 13px;
    }

    .value-label {
      font-size: 11px;
      color: rgba(0, 0, 0, 0.54);
      text-transform: uppercase;
      font-weight: 600;
    }

    .value-expected { color: #2e7d32; }
    .value-actual { color: #c62828; }

    .fix-suggestion {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-top: 8px;
      padding: 8px 12px;
      background: #e3f2fd;
      border-radius: 4px;
      font-size: 13px;
    }

    .fix-suggestion mat-icon {
      color: #1565c0;
      font-size: 18px;
      width: 18px;
      height: 18px;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .card-actions {
      display: flex;
      gap: 8px;
      margin-top: 8px;
      justify-content: flex-end;
    }

    .resolved-badge {
      font-size: 12px;
      color: #2e7d32;
      display: flex;
      align-items: center;
      gap: 4px;
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
      padding: 48px;
    }
  `],
})
export class DiscrepanciesComponent implements OnInit {
  private readonly auditService = inject(AuditService);
  private readonly dialog = inject(MatDialog);

  readonly discrepancies = signal<AuditDiscrepancy[]>([]);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  readonly severityFilter = signal<string>('');
  readonly showResolved = signal(false);
  readonly actionReason = signal('');

  readonly severityOptions = Object.values(DiscrepancySeverity);

  readonly filteredDiscrepancies = computed(() => {
    let list = this.discrepancies();
    const sev = this.severityFilter();
    if (sev) list = list.filter(d => d.severity === sev);
    if (!this.showResolved()) list = list.filter(d => !d.resolvedAt);
    return list;
  });

  readonly countBySeverity = computed(() => {
    const open = this.discrepancies().filter(d => !d.resolvedAt);
    return {
      critical: open.filter(d => d.severity === DiscrepancySeverity.Critical).length,
      high: open.filter(d => d.severity === DiscrepancySeverity.High).length,
      medium: open.filter(d => d.severity === DiscrepancySeverity.Medium).length,
      low: open.filter(d => d.severity === DiscrepancySeverity.Low).length,
    };
  });

  ngOnInit(): void {
    this.loadDiscrepancies();
  }

  loadDiscrepancies(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.auditService.getDiscrepancies().subscribe({
      next: data => {
        this.discrepancies.set(data);
        this.isLoading.set(false);
      },
      error: err => {
        this.error.set(err?.message ?? 'Impossible de charger les divergences');
        this.isLoading.set(false);
      },
    });
  }

  resolveDiscrepancy(d: AuditDiscrepancy): void {
    const reason = this.actionReason().trim();
    if (!reason) return;
    this.auditService.resolveDiscrepancy(d.id, reason).subscribe({
      next: updated => {
        this.discrepancies.update(list =>
          list.map(item => (item.id === updated.id ? updated : item)),
        );
      },
      error: err => {
        this.error.set(err?.message ?? 'Impossible de résoudre la divergence');
      },
    });
  }

  viewSnapshot(d: AuditDiscrepancy): void {
    if (!d.snapshotJson) return;
    this.dialog.open(JsonViewerDialogComponent, {
      data: {
        title: `Snapshot: ${d.field}`,
        json: d.snapshotJson,
      } satisfies JsonViewerDialogData,
      width: '720px',
    });
  }

  getSeverityClass(severity: DiscrepancySeverity): string {
    return 'sev-' + severity.toLowerCase();
  }
}
