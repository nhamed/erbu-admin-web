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
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  DriverManagementService,
  VehicleInfo,
  VehicleDocument,
} from '../driver-management.service';

@Component({
  selector: 'app-driver-vehicle',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatSnackBarModule,
  ],
  templateUrl: './driver-vehicle.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriverVehicleComponent implements OnInit {
  readonly driverId = input.required<string>();

  private readonly svc = inject(DriverManagementService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);

  readonly vehicle = signal<VehicleInfo | null>(null);
  readonly loading = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.svc
      .getVehicle(this.driverId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => {
          this.vehicle.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.snackBar.open('Failed to load vehicle data', 'Dismiss', { duration: 5000 });
          this.loading.set(false);
        },
      });
  }

  isExpiringSoon(dateStr: string): boolean {
    const expiry = new Date(dateStr);
    const now = new Date();
    const daysUntil = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntil <= 30 && daysUntil > 0;
  }

  isExpired(dateStr: string): boolean {
    return new Date(dateStr) < new Date();
  }

  expiryClass(dateStr: string): string {
    if (this.isExpired(dateStr)) return 'expiry-expired';
    if (this.isExpiringSoon(dateStr)) return 'expiry-warning';
    return 'expiry-ok';
  }

  trackByDocId(_: number, doc: VehicleDocument): string {
    return doc.id;
  }
}
