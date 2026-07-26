import {
  Component,
  ChangeDetectionStrategy,
  input,
  signal,
  inject,
  OnInit,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { DriverManagementService, Invoice, InvoiceStatus } from '../driver-management.service';

@Component({
  selector: 'app-driver-invoices',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    MatSnackBarModule,
  ],
  templateUrl: './driver-invoices.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriverInvoicesComponent implements OnInit {
  readonly driverId = input.required<string>();

  private readonly svc = inject(DriverManagementService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);

  readonly invoices = signal<Invoice[]>([]);
  readonly loading = signal(false);
  readonly totalCount = signal(0);
  readonly page = signal(0);
  readonly pageSize = signal(20);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.svc
      .getInvoices(this.driverId(), this.page() + 1, this.pageSize())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.invoices.set(result.items);
          this.totalCount.set(result.totalCount);
          this.loading.set(false);
        },
        error: () => {
          this.snackBar.open('Failed to load invoices', 'Dismiss', { duration: 5000 });
          this.loading.set(false);
        },
      });
  }

  onPageChange(event: PageEvent): void {
    this.page.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  statusClass(status: InvoiceStatus): string {
    switch (status) {
      case 'Paid': return 'inv-paid';
      case 'Sent': return 'inv-sent';
      case 'Draft': return 'inv-draft';
      case 'Overdue': return 'inv-overdue';
      case 'Voided': return 'inv-voided';
      default: return '';
    }
  }

  trackByInvoiceId(_: number, inv: Invoice): string {
    return inv.id;
  }
}
