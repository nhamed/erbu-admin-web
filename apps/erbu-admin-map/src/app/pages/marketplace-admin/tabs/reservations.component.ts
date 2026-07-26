import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { MarketplaceReservation, ReservationStatus } from '@erbu-admin-web/shared/models';
import { MarketplaceService } from '../marketplace.service';

@Component({
  selector: 'app-reservations-tab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatPaginatorModule,
    MatMenuModule,
    MatSnackBarModule,
  ],
  templateUrl: './reservations.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservationsComponent implements OnInit {
  readonly svc = inject(MarketplaceService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);

  // ── Filter / paging ──────────────────────────────────────────
  readonly page = signal(0);
  readonly pageSize = signal(25);
  readonly statusFilter = signal<ReservationStatus | ''>('');

  readonly statusOptions = Object.values(ReservationStatus);

  // ── Table config ─────────────────────────────────────────────
  readonly displayedColumns: string[] = [
    'riderName',
    'pickupAddress',
    'dropoffAddress',
    'scheduledAt',
    'vehicleType',
    'estimatedFare',
    'status',
    'assignedDriverId',
    'actions',
  ];

  // ── Selected reservation for detail ──────────────────────────
  readonly selectedReservation = signal<MarketplaceReservation | null>(null);

  // ── Lifecycle ────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadData();
  }

  // ── Data loading ─────────────────────────────────────────────
  loadData(): void {
    this.svc.loadReservations(
      this.page() + 1,
      this.pageSize(),
      this.statusFilter() || undefined,
    );
  }

  // ── Filter / page events ─────────────────────────────────────
  onStatusFilterChange(status: ReservationStatus | ''): void {
    this.statusFilter.set(status);
    this.page.set(0);
    this.loadData();
  }

  onPageChange(event: PageEvent): void {
    this.page.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadData();
  }

  // ── Actions ──────────────────────────────────────────────────
  cancelReservation(reservation: MarketplaceReservation): void {
    const reason = prompt('Cancellation reason:');
    if (!reason) return;

    this.svc
      .cancelReservation(reservation.id, reason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Reservation cancelled', 'OK', { duration: 3000 });
          this.loadData();
        },
        error: () =>
          this.snackBar.open('Failed to cancel reservation', 'Dismiss', { duration: 5000 }),
      });
  }

  reassignDriver(reservation: MarketplaceReservation): void {
    const driverId = prompt('Enter driver ID to reassign:');
    if (!driverId) return;

    this.svc
      .reassignReservation(reservation.id, driverId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Reservation reassigned', 'OK', { duration: 3000 });
          this.loadData();
        },
        error: () =>
          this.snackBar.open('Failed to reassign reservation', 'Dismiss', { duration: 5000 }),
      });
  }

  selectReservation(reservation: MarketplaceReservation): void {
    this.selectedReservation.set(reservation);
  }

  closeDetail(): void {
    this.selectedReservation.set(null);
  }

  // ── Helpers ──────────────────────────────────────────────────
  statusClass(status: ReservationStatus): string {
    switch (status) {
      case ReservationStatus.Pending:
        return 'status-pending';
      case ReservationStatus.Confirmed:
      case ReservationStatus.DriverAssigned:
        return 'status-confirmed';
      case ReservationStatus.InProgress:
        return 'status-active';
      case ReservationStatus.Completed:
        return 'status-completed';
      case ReservationStatus.CancelledByRider:
      case ReservationStatus.CancelledBySystem:
        return 'status-cancelled';
      case ReservationStatus.NoShow:
        return 'status-noshow';
      default:
        return '';
    }
  }

  canCancel(reservation: MarketplaceReservation): boolean {
    return (
      reservation.status === ReservationStatus.Pending ||
      reservation.status === ReservationStatus.Confirmed ||
      reservation.status === ReservationStatus.DriverAssigned
    );
  }

  canReassign(reservation: MarketplaceReservation): boolean {
    return (
      reservation.status === ReservationStatus.Confirmed ||
      reservation.status === ReservationStatus.DriverAssigned
    );
  }

  trackById(_: number, reservation: MarketplaceReservation): string {
    return reservation.id;
  }
}
