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
import { MatChipsModule } from '@angular/material/chips';
import { DriverVirement, VirementStatus } from '@erbu-admin-web/shared/models';
import {
  PaymentMonitorService,
  VirementsFilter,
} from '../payment-monitor.service';

@Component({
  selector: 'app-driver-virements',
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
  templateUrl: './driver-virements.component.html',
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

      .virements-table {
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

      .cell-iban {
        font-family: 'Roboto Mono', monospace;
        font-size: 11px;
        letter-spacing: 0.5px;
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
      .status-submitted {
        background: #e3f2fd;
        color: #1565c0;
      }
      .status-processing {
        background: #e8eaf6;
        color: #283593;
      }
      .status-completed {
        background: #e8f5e9;
        color: #2e7d32;
      }
      .status-failed {
        background: #ffebee;
        color: #c62828;
      }
      .status-reversed {
        background: #fce4ec;
        color: #880e4f;
      }

      .period-range {
        font-size: 11px;
        color: rgba(0, 0, 0, 0.54);
        white-space: nowrap;
      }

      .commission-deducted {
        font-size: 11px;
        color: rgba(0, 0, 0, 0.54);
      }

      .failure-reason {
        max-width: 180px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: #c62828;
        font-size: 12px;
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
    `,
  ],
})
export class DriverVirementsComponent implements OnInit {
  private readonly svc = inject(PaymentMonitorService);

  // ── State signals ──────────────────────────────────────────
  readonly virements = signal<DriverVirement[]>([]);
  readonly totalCount = signal(0);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  // ── Filter signals ─────────────────────────────────────────
  readonly statusFilter = signal<VirementStatus | ''>('');
  readonly driverSearch = signal('');
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly page = signal(0);
  readonly pageSize = signal(25);

  // ── Filter options ─────────────────────────────────────────
  readonly statusOptions = Object.values(VirementStatus);

  readonly displayedColumns: string[] = [
    'initiatedAt',
    'driverName',
    'amount',
    'status',
    'bankName',
    'iban',
    'reference',
    'period',
    'tripCount',
    'commission',
    'processedAt',
    'failureReason',
  ];

  readonly currentFilter = computed<VirementsFilter>(() => ({
    status: this.statusFilter(),
    driverSearch: this.driverSearch(),
    dateFrom: this.dateFrom(),
    dateTo: this.dateTo(),
    page: this.page(),
    pageSize: this.pageSize(),
  }));

  ngOnInit(): void {
    this.loadVirements();
  }

  loadVirements(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.svc.fetchDriverVirements(this.currentFilter()).subscribe({
      next: (result) => {
        this.virements.set(result.items);
        this.totalCount.set(result.totalCount);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Failed to load driver virements');
        this.isLoading.set(false);
      },
    });
  }

  onFilterChange(): void {
    this.page.set(0);
    this.loadVirements();
  }

  onPageChange(event: PageEvent): void {
    this.page.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadVirements();
  }

  onClearFilters(): void {
    this.statusFilter.set('');
    this.driverSearch.set('');
    this.dateFrom.set('');
    this.dateTo.set('');
    this.page.set(0);
    this.loadVirements();
  }

  getStatusClass(status: VirementStatus): string {
    return 'status-' + status.toLowerCase();
  }

  maskIban(iban: string): string {
    if (!iban || iban.length < 8) return iban;
    return iban.substring(0, 4) + ' **** ' + iban.substring(iban.length - 4);
  }
}
