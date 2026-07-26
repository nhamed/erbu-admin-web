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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { DriverManagementService, TariffAssignment } from '../driver-management.service';

@Component({
  selector: 'app-driver-tariff',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './driver-tariff.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriverTariffComponent implements OnInit {
  readonly driverId = input.required<string>();

  private readonly svc = inject(DriverManagementService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);

  readonly tariffs = signal<TariffAssignment[]>([]);
  readonly loading = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.svc
      .getTariffs(this.driverId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => {
          this.tariffs.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.snackBar.open('Failed to load tariffs', 'Dismiss', { duration: 5000 });
          this.loading.set(false);
        },
      });
  }

  assignTariff(): void {
    const tariffId = prompt('Enter tariff ID to assign:');
    if (!tariffId) return;

    this.svc
      .assignTariff(this.driverId(), tariffId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Tariff assigned', 'OK', { duration: 3000 });
          this.load();
        },
        error: () => this.snackBar.open('Failed to assign tariff', 'Dismiss', { duration: 5000 }),
      });
  }

  trackByTariffId(_: number, tariff: TariffAssignment): string {
    return tariff.id;
  }
}
