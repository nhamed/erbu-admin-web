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
  KycInfo,
  KycDocument,
  KycStatus,
} from '../driver-management.service';

@Component({
  selector: 'app-driver-kyc',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatSnackBarModule,
  ],
  templateUrl: './driver-kyc.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriverKycComponent implements OnInit {
  readonly driverId = input.required<string>();

  private readonly svc = inject(DriverManagementService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);

  readonly kyc = signal<KycInfo | null>(null);
  readonly loading = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.svc
      .getKyc(this.driverId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => {
          this.kyc.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.snackBar.open('Failed to load KYC data', 'Dismiss', { duration: 5000 });
          this.loading.set(false);
        },
      });
  }

  approveKyc(): void {
    this.svc
      .approveKyc(this.driverId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('KYC approved', 'OK', { duration: 3000 });
          this.load();
        },
        error: () => this.snackBar.open('Failed to approve KYC', 'Dismiss', { duration: 5000 }),
      });
  }

  rejectKyc(): void {
    const reason = prompt('Rejection reason:');
    if (!reason) return;

    this.svc
      .rejectKyc(this.driverId(), reason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('KYC rejected', 'OK', { duration: 3000 });
          this.load();
        },
        error: () => this.snackBar.open('Failed to reject KYC', 'Dismiss', { duration: 5000 }),
      });
  }

  requestResubmission(): void {
    const reason = prompt('Reason for resubmission request:');
    if (!reason) return;

    this.svc
      .requestKycResubmission(this.driverId(), reason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Resubmission requested', 'OK', { duration: 3000 });
          this.load();
        },
        error: () => this.snackBar.open('Failed to request resubmission', 'Dismiss', { duration: 5000 }),
      });
  }

  statusClass(status: KycStatus): string {
    switch (status) {
      case 'Approved': return 'kyc-approved';
      case 'Pending': return 'kyc-pending';
      case 'Rejected': return 'kyc-rejected';
      case 'RequiresResubmission': return 'kyc-resubmit';
      default: return '';
    }
  }

  verificationIcon(passed: boolean | null): string {
    if (passed === true) return 'check_circle';
    if (passed === false) return 'cancel';
    return 'help_outline';
  }

  verificationClass(passed: boolean | null): string {
    if (passed === true) return 'check-pass';
    if (passed === false) return 'check-fail';
    return 'check-unknown';
  }

  trackByDocId(_: number, doc: KycDocument): string {
    return doc.id;
  }
}
