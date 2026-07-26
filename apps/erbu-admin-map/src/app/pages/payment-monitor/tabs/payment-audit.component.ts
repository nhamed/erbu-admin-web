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
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { PaymentAudit } from '@erbu-admin-web/shared/models';
import { PaymentMonitorService, AuditFilter } from '../payment-monitor.service';

@Component({
  selector: 'app-payment-audit',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatPaginatorModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatExpansionModule,
    MatChipsModule,
  ],
  templateUrl: './payment-audit.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      :host {
        display: block;
        padding: 16px;
      }

      .filters-row {
        display: flex;
        gap: 12px;
        margin-bottom: 16px;
        align-items: center;
        flex-wrap: wrap;
      }

      .filters-row mat-form-field {
        min-width: 160px;
      }

      .spacer {
        flex: 1;
      }

      .audit-table {
        width: 100%;
      }

      .cell-mono {
        font-family: 'Roboto Mono', monospace;
        font-size: 12px;
      }

      .action-chip {
        font-size: 11px;
        font-weight: 600;
        padding: 2px 10px;
        border-radius: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        display: inline-block;
      }

      .action-create {
        background: #e8f5e9;
        color: #2e7d32;
      }
      .action-update {
        background: #e3f2fd;
        color: #1565c0;
      }
      .action-delete {
        background: #ffebee;
        color: #c62828;
      }
      .action-refund {
        background: #f3e5f5;
        color: #6a1b9a;
      }
      .action-default {
        background: #e0e0e0;
        color: #616161;
      }

      .auto-badge {
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 4px;
        background: #fff8e1;
        color: #f57f17;
        margin-left: 4px;
      }

      .expanded-detail {
        padding: 16px;
        background: rgba(0, 0, 0, 0.02);
        border-radius: 4px;
        margin: 8px 0;
      }

      .state-diff {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }

      .state-column h4 {
        font-size: 12px;
        text-transform: uppercase;
        color: rgba(0, 0, 0, 0.54);
        margin: 0 0 8px;
        font-weight: 600;
      }

      .state-json {
        font-family: 'Roboto Mono', monospace;
        font-size: 11px;
        background: rgba(0, 0, 0, 0.04);
        padding: 8px;
        border-radius: 4px;
        overflow: auto;
        max-height: 200px;
        white-space: pre-wrap;
        word-break: break-all;
      }

      .meta-row {
        display: flex;
        gap: 24px;
        margin-top: 12px;
        font-size: 12px;
        color: rgba(0, 0, 0, 0.54);
      }

      .meta-row strong {
        color: rgba(0, 0, 0, 0.7);
      }

      .loading-overlay {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 48px;
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

      .clickable-row {
        cursor: pointer;
      }

      .clickable-row:hover {
        background: rgba(0, 0, 0, 0.04);
      }
    `,
  ],
})
export class PaymentAuditComponent implements OnInit {
  private readonly svc = inject(PaymentMonitorService);

  // ── State signals ──────────────────────────────────────────
  readonly entries = signal<PaymentAudit[]>([]);
  readonly totalCount = signal(0);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly expandedId = signal<string | null>(null);

  // ── Filter signals ─────────────────────────────────────────
  readonly entityTypeFilter = signal('');
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly page = signal(0);
  readonly pageSize = signal(25);

  // ── Entity type options ────────────────────────────────────
  readonly entityTypes = [
    'PaymentEvent',
    'DriverVirement',
    'Refund',
    'Chargeback',
    'PayoutConfig',
  ];

  readonly displayedColumns: string[] = [
    'performedAt',
    'action',
    'entityType',
    'entityId',
    'performedBy',
    'reason',
  ];

  readonly currentFilter = computed<AuditFilter>(() => ({
    entityType: this.entityTypeFilter(),
    dateFrom: this.dateFrom(),
    dateTo: this.dateTo(),
    page: this.page(),
    pageSize: this.pageSize(),
  }));

  ngOnInit(): void {
    this.loadAudit();
  }

  loadAudit(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.svc.fetchAuditLog(this.currentFilter()).subscribe({
      next: (result) => {
        this.entries.set(result.items);
        this.totalCount.set(result.totalCount);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Failed to load audit log');
        this.isLoading.set(false);
      },
    });
  }

  onFilterChange(): void {
    this.page.set(0);
    this.loadAudit();
  }

  onPageChange(event: PageEvent): void {
    this.page.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadAudit();
  }

  onClearFilters(): void {
    this.entityTypeFilter.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.page.set(0);
    this.loadAudit();
  }

  toggleExpand(id: string): void {
    this.expandedId.update((current) => (current === id ? null : id));
  }

  getActionClass(action: string): string {
    const lower = action.toLowerCase();
    if (lower.includes('create') || lower.includes('add'))
      return 'action-create';
    if (lower.includes('update') || lower.includes('modify'))
      return 'action-update';
    if (lower.includes('delete') || lower.includes('remove'))
      return 'action-delete';
    if (lower.includes('refund')) return 'action-refund';
    return 'action-default';
  }

  formatJson(obj: Record<string, unknown>): string {
    try {
      return JSON.stringify(obj, null, 2);
    } catch {
      return '{}';
    }
  }
}
