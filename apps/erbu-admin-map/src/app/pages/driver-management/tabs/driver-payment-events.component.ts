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

import { DriverManagementService, PaymentEvent, PaymentEventType } from '../driver-management.service';

@Component({
  selector: 'app-driver-payment-events',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    MatSnackBarModule,
  ],
  templateUrl: './driver-payment-events.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriverPaymentEventsComponent implements OnInit {
  readonly driverId = input.required<string>();

  private readonly svc = inject(DriverManagementService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);

  readonly events = signal<PaymentEvent[]>([]);
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
      .getPaymentEvents(this.driverId(), this.page() + 1, this.pageSize())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.events.set(result.items);
          this.totalCount.set(result.totalCount);
          this.loading.set(false);
        },
        error: () => {
          this.snackBar.open('Failed to load payment events', 'Dismiss', { duration: 5000 });
          this.loading.set(false);
        },
      });
  }

  onPageChange(event: PageEvent): void {
    this.page.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  typeIcon(type: PaymentEventType): string {
    switch (type) {
      case 'Charge': return 'payment';
      case 'Refund': return 'undo';
      case 'Payout': return 'account_balance';
      case 'Adjustment': return 'tune';
      case 'Fee': return 'receipt';
      default: return 'swap_horiz';
    }
  }

  typeClass(type: PaymentEventType): string {
    switch (type) {
      case 'Charge': return 'pe-charge';
      case 'Refund': return 'pe-refund';
      case 'Payout': return 'pe-payout';
      case 'Adjustment': return 'pe-adjustment';
      case 'Fee': return 'pe-fee';
      default: return '';
    }
  }

  trackByEventId(_: number, event: PaymentEvent): string {
    return event.id;
  }
}
