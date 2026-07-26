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

import { DriverManagementService, MarketplaceEntry, MarketplaceStatus } from '../driver-management.service';

@Component({
  selector: 'app-driver-marketplace',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatProgressSpinnerModule, MatSnackBarModule],
  templateUrl: './driver-marketplace.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriverMarketplaceComponent implements OnInit {
  readonly driverId = input.required<string>();

  private readonly svc = inject(DriverManagementService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);

  readonly entries = signal<MarketplaceEntry[]>([]);
  readonly loading = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.svc
      .getMarketplace(this.driverId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => {
          this.entries.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.snackBar.open('Failed to load marketplace data', 'Dismiss', { duration: 5000 });
          this.loading.set(false);
        },
      });
  }

  statusClass(status: MarketplaceStatus): string {
    switch (status) {
      case 'Available': return 'mp-available';
      case 'OnTrip': return 'mp-on-trip';
      case 'Offline': return 'mp-offline';
      case 'Break': return 'mp-break';
      default: return '';
    }
  }

  trackByEntryId(_: number, entry: MarketplaceEntry): string {
    return entry.id;
  }
}
