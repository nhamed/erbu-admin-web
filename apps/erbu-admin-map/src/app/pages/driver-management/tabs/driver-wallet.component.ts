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
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  DriverManagementService,
  WalletInfo,
  WalletTransaction,
  WalletTransactionType,
} from '../driver-management.service';

@Component({
  selector: 'app-driver-wallet',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatSnackBarModule,
  ],
  templateUrl: './driver-wallet.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriverWalletComponent implements OnInit {
  readonly driverId = input.required<string>();

  private readonly svc = inject(DriverManagementService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);

  readonly wallet = signal<WalletInfo | null>(null);
  readonly loading = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.svc
      .getWallet(this.driverId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => {
          this.wallet.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.snackBar.open('Failed to load wallet', 'Dismiss', { duration: 5000 });
          this.loading.set(false);
        },
      });
  }

  adjustBalance(): void {
    const amountStr = prompt('Adjustment amount (positive to credit, negative to debit):');
    if (!amountStr) return;
    const amount = parseFloat(amountStr);
    if (isNaN(amount)) {
      this.snackBar.open('Invalid amount', 'Dismiss', { duration: 3000 });
      return;
    }

    const reason = prompt('Reason for adjustment:');
    if (!reason) return;

    this.svc
      .adjustWalletBalance(this.driverId(), amount, reason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Wallet adjusted', 'OK', { duration: 3000 });
          this.load();
        },
        error: () => this.snackBar.open('Failed to adjust wallet', 'Dismiss', { duration: 5000 }),
      });
  }

  txTypeClass(type: WalletTransactionType): string {
    switch (type) {
      case 'Credit': case 'TopUp': case 'Bonus': return 'tx-credit';
      case 'Debit': case 'Withdrawal': return 'tx-debit';
      default: return '';
    }
  }

  txIcon(type: WalletTransactionType): string {
    switch (type) {
      case 'Credit': return 'add_circle';
      case 'Debit': return 'remove_circle';
      case 'TopUp': return 'account_balance_wallet';
      case 'Withdrawal': return 'payments';
      case 'Bonus': return 'card_giftcard';
      default: return 'swap_horiz';
    }
  }

  trackByTxId(_: number, tx: WalletTransaction): string {
    return tx.id;
  }
}
