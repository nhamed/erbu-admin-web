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

import { DriverManagementService, DriverTrip, TripStatus } from '../driver-management.service';

@Component({
  selector: 'app-driver-trips',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatPaginatorModule,
    MatSnackBarModule,
  ],
  templateUrl: './driver-trips.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriverTripsComponent implements OnInit {
  readonly driverId = input.required<string>();

  private readonly svc = inject(DriverManagementService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);

  readonly trips = signal<DriverTrip[]>([]);
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
      .getTrips(this.driverId(), this.page() + 1, this.pageSize())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.trips.set(result.items);
          this.totalCount.set(result.totalCount);
          this.loading.set(false);
        },
        error: () => {
          this.snackBar.open('Failed to load trips', 'Dismiss', { duration: 5000 });
          this.loading.set(false);
        },
      });
  }

  onPageChange(event: PageEvent): void {
    this.page.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.load();
  }

  statusClass(status: TripStatus): string {
    switch (status) {
      case 'Completed': return 'trip-completed';
      case 'InProgress': return 'trip-active';
      case 'Cancelled': return 'trip-cancelled';
      case 'Disputed': return 'trip-disputed';
      default: return '';
    }
  }

  trackByTripId(_: number, trip: DriverTrip): string {
    return trip.id;
  }
}
