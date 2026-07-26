import {
  Component,
  ChangeDetectionStrategy,
  input,
  signal,
  inject,
  OnInit,
  DestroyRef,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  DriverManagementService,
  DriverCompliance,
  ComplianceDocument,
  ComplianceStatus,
} from '../driver-management.service';

@Component({
  selector: 'app-driver-compliance',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './driver-compliance.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriverComplianceComponent implements OnInit {
  readonly driverId = input.required<string>();

  private readonly svc = inject(DriverManagementService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);

  readonly compliance = signal<DriverCompliance | null>(null);
  readonly loading = signal(false);

  constructor() {
    effect(() => {
      const id = this.driverId();
      if (id) this.load(id);
    });
  }

  ngOnInit(): void {
    this.load(this.driverId());
  }

  load(driverId: string): void {
    this.loading.set(true);
    this.svc
      .getCompliance(driverId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => {
          this.compliance.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.snackBar.open('Failed to load compliance data', 'Dismiss', { duration: 5000 });
          this.loading.set(false);
        },
      });
  }

  approveDocument(doc: ComplianceDocument): void {
    this.svc
      .approveComplianceDocument(this.driverId(), doc.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Document approved', 'OK', { duration: 3000 });
          this.load(this.driverId());
        },
        error: () => this.snackBar.open('Failed to approve document', 'Dismiss', { duration: 5000 }),
      });
  }

  rejectDocument(doc: ComplianceDocument): void {
    const reason = prompt('Rejection reason:');
    if (!reason) return;

    this.svc
      .rejectComplianceDocument(this.driverId(), doc.id, reason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Document rejected', 'OK', { duration: 3000 });
          this.load(this.driverId());
        },
        error: () => this.snackBar.open('Failed to reject document', 'Dismiss', { duration: 5000 }),
      });
  }

  statusClass(status: ComplianceStatus): string {
    switch (status) {
      case 'Compliant': return 'compliance-ok';
      case 'NonCompliant': return 'compliance-fail';
      case 'PendingReview': return 'compliance-pending';
      case 'Expired': return 'compliance-expired';
      default: return '';
    }
  }

  trackByDocId(_: number, doc: ComplianceDocument): string {
    return doc.id;
  }
}
