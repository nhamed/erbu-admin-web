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
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { DriverManagementService, Payout, PayoutStatus } from '../driver-management.service';

@Component({
  selector: 'app-driver-payouts',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    MatSnackBarModule,
  ],
  templateUrl: './driver-payouts.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriverPayoutsComponent implements OnInit {
  readonly driverId = input.required<string>();

  private readonly svc = inject(DriverManagementService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);

  readonly payouts = signal<Payout[]>([]);
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
      .getPayouts(this.driverId(), this.page() + 1, this.pageSize())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.payouts.set(result.items);
          this.totalCount.set(result.totalCount);
          this.loading.set(false);
        },
        error: () => {
          this.snackBar.open('Failed to load payouts', 'Dismiss', { duration: 5000 });
          this.loading.set(false);
        },
      });
  }

  onPageChange(event: PageEvent): void {
    this.page.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  retryPayout(payout: Payout): void {
    this.svc
      .retryPayout(this.driverId(), payout.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Payout retry initiated', 'OK', { duration: 3000 });
          this.load();
        },
        error: () => this.snackBar.open('Failed to retry payout', 'Dismiss', { duration: 5000 }),
      });
  }

  statusClass(status: PayoutStatus): string {
    switch (status) {
      case 'Completed': return 'payout-completed';
      case 'Pending': return 'payout-pending';
      case 'Failed': return 'payout-failed';
      case 'OnHold': return 'payout-hold';
      default: return '';
    }
  }

  trackByPayoutId(_: number, payout: Payout): string {
    return payout.id;
  }
}
