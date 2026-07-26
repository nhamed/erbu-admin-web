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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { DriverManagementService, DriverCreation, OnboardingStep } from '../driver-management.service';

@Component({
  selector: 'app-driver-creation',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
  ],
  templateUrl: './driver-creation.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriverCreationComponent implements OnInit {
  readonly driverId = input.required<string>();

  private readonly svc = inject(DriverManagementService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);

  readonly creation = signal<DriverCreation | null>(null);
  readonly loading = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.svc
      .getCreationInfo(this.driverId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => {
          this.creation.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.snackBar.open('Failed to load creation info', 'Dismiss', { duration: 5000 });
          this.loading.set(false);
        },
      });
  }

  stepIcon(step: OnboardingStep): string {
    switch (step.status) {
      case 'Completed': return 'check_circle';
      case 'Pending': return 'radio_button_unchecked';
      case 'Skipped': return 'skip_next';
      default: return 'help_outline';
    }
  }

  stepClass(step: OnboardingStep): string {
    switch (step.status) {
      case 'Completed': return 'step-completed';
      case 'Pending': return 'step-pending';
      case 'Skipped': return 'step-skipped';
      default: return '';
    }
  }

  trackByStepName(_: number, step: OnboardingStep): string {
    return step.name;
  }
}
