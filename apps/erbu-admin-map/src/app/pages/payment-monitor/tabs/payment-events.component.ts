import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
  output,
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
import { MatChipsModule } from '@angular/material/chips';
import {
  PaymentEvent,
  PaymentEventType,
  PaymentStatus,
} from '@erbu-admin-web/shared/models';
import {
  PaymentMonitorService,
  PaymentEventsFilter,
} from '../payment-monitor.service';

@Component({
  selector: 'app-payment-events',
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
    MatChipsModule,
  ],
  templateUrl: './payment-events.component.html',
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

      .events-table {
        width: 100%;
      }

      .cell-mono {
        font-family: 'Roboto Mono', monospace;
        font-size: 12px;
      }

      .cell-amount {
        font-family: 'Roboto Mono', monospace;
        font-weight: 500;
        text-align: right;
      }

      .status-chip {
        font-size: 11px;
        font-weight: 600;
        padding: 2px 10px;
        border-radius: 12px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        display: inline-block;
      }

      .status-pending {
        background: #fff3e0;
        color: #e65100;
      }
      .status-processing {
        background: #e3f2fd;
        color: #1565c0;
      }
      .status-completed {
        background: #e8f5e9;
        color: #2e7d32;
      }
      .status-failed {
        background: #ffebee;
        color: #c62828;
      }
      .status-refunded {
        background: #f3e5f5;
        color: #6a1b9a;
      }
      .status-disputed {
        background: #fce4ec;
        color: #880e4f;
      }
      .status-cancelled {
        background: #e0e0e0;
        color: #616161;
      }

      .type-chip {
        font-size: 11px;
        padding: 2px 8px;
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.06);
        color: rgba(0, 0, 0, 0.7);
      }

      .failure-reason {
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
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
export class PaymentEventsComponent implements OnInit {
  private readonly svc = inject(PaymentMonitorService);

  /** Emitted when user drills down into a specific payment event. */
  readonly selectEvent = output<PaymentEvent>();

  // ── State signals ──────────────────────────────────────────
  readonly events = signal<PaymentEvent[]>([]);
  readonly totalCount = signal(0);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  // ── Filter signals ─────────────────────────────────────────
  readonly typeFilter = signal<PaymentEventType | ''>('');
  readonly statusFilter = signal<PaymentStatus | ''>('');
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly driverSearch = signal('');
  readonly page = signal(0);
  readonly pageSize = signal(25);

  // ── Filter options ─────────────────────────────────────────
  readonly typeOptions = Object.values(PaymentEventType);
  readonly statusOptions = Object.values(PaymentStatus);

  readonly displayedColumns: string[] = [
    'processedAt',
    'type',
    'amount',
    'paymentMethod',
    'status',
    'gatewayProvider',
    'gatewayTransactionId',
    'failureReason',
  ];

  readonly currentFilter = computed<PaymentEventsFilter>(() => ({
    type: this.typeFilter(),
    status: this.statusFilter(),
    dateFrom: this.dateFrom(),
    dateTo: this.dateTo(),
    driverSearch: this.driverSearch(),
    page: this.page(),
    pageSize: this.pageSize(),
  }));

  ngOnInit(): void {
    this.loadEvents();
  }

  loadEvents(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.svc.fetchPaymentEvents(this.currentFilter()).subscribe({
      next: (result) => {
        this.events.set(result.items);
        this.totalCount.set(result.totalCount);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Failed to load payment events');
        this.isLoading.set(false);
      },
    });
  }

  onFilterChange(): void {
    this.page.set(0);
    this.loadEvents();
  }

  onPageChange(event: PageEvent): void {
    this.page.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadEvents();
  }

  onClearFilters(): void {
    this.typeFilter.set('');
    this.statusFilter.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.driverSearch.set('');
    this.page.set(0);
    this.loadEvents();
  }

  onRowClick(event: PaymentEvent): void {
    this.selectEvent.emit(event);
  }

  getStatusClass(status: PaymentStatus): string {
    return 'status-' + status.toLowerCase();
  }
}
