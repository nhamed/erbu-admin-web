import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
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
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSliderModule } from '@angular/material/slider';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { DemandLiquidity, LiquidityTrend } from '@erbu-admin-web/shared/models';
import { MarketplaceService, SurgeAdjustment } from '../marketplace.service';

const AUTO_REFRESH_MS = 20_000;

@Component({
  selector: 'app-demand-liquidity-tab',
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
    MatInputModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSliderModule,
    MatDialogModule,
    MatSnackBarModule,
  ],
  templateUrl: './demand-liquidity.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DemandLiquidityComponent implements OnInit, OnDestroy {
  readonly svc = inject(MarketplaceService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  // ── Filters ──────────────────────────────────────────────────
  readonly trendFilter = signal<LiquidityTrend | ''>('');
  readonly trendOptions = Object.values(LiquidityTrend);

  // ── Surge adjustment form ────────────────────────────────────
  readonly adjustingZone = signal<DemandLiquidity | null>(null);
  readonly surgeValue = signal(1.0);
  readonly surgeReason = signal('');
  readonly adjusting = signal(false);

  // ── Filtered zones ───────────────────────────────────────────
  readonly filteredZones = computed(() => {
    const zones = this.svc.liquidityZones();
    const trend = this.trendFilter();
    if (!trend) return zones;
    return zones.filter(z => z.trend === trend);
  });

  // ── Average S/D ratio display ────────────────────────────────
  readonly avgRatioDisplay = computed(() => {
    const avg = this.svc.avgSupplyDemandRatio();
    return avg === 0 ? '--' : avg.toFixed(2);
  });

  // ── Table config ─────────────────────────────────────────────
  readonly displayedColumns: string[] = [
    'zoneName',
    'activeDrivers',
    'activeRiders',
    'pendingRequests',
    'supplyDemandRatio',
    'surgeMultiplier',
    'averageWaitTimeSeconds',
    'trend',
    'actions',
  ];

  // ── Lifecycle ────────────────────────────────────────────────
  ngOnInit(): void {
    this.svc.loadLiquidity();
    this.refreshTimer = setInterval(() => this.svc.loadLiquidity(), AUTO_REFRESH_MS);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // ── Filter events ────────────────────────────────────────────
  onTrendFilterChange(value: LiquidityTrend | ''): void {
    this.trendFilter.set(value);
  }

  // ── Surge adjustment ─────────────────────────────────────────
  openSurgeAdjust(zone: DemandLiquidity): void {
    this.adjustingZone.set(zone);
    this.surgeValue.set(zone.surgeMultiplier);
    this.surgeReason.set('');
  }

  closeSurgeAdjust(): void {
    this.adjustingZone.set(null);
  }

  submitSurgeAdjust(): void {
    const zone = this.adjustingZone();
    if (!zone) return;

    const adjustment: SurgeAdjustment = {
      zoneId: zone.zoneId,
      surgeMultiplier: this.surgeValue(),
      reason: this.surgeReason(),
    };

    this.adjusting.set(true);
    this.svc
      .adjustSurge(adjustment)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.adjusting.set(false);
          this.adjustingZone.set(null);
          this.snackBar.open(
            `Surge for ${zone.zoneName} set to ${adjustment.surgeMultiplier}x`,
            'OK',
            { duration: 3000 },
          );
          this.svc.loadLiquidity();
        },
        error: () => {
          this.adjusting.set(false);
          this.snackBar.open('Failed to adjust surge', 'Dismiss', { duration: 5000 });
        },
      });
  }

  // ── Helpers ──────────────────────────────────────────────────
  trendClass(trend: LiquidityTrend): string {
    switch (trend) {
      case LiquidityTrend.Surplus:
        return 'trend-surplus';
      case LiquidityTrend.Balanced:
        return 'trend-balanced';
      case LiquidityTrend.Deficit:
        return 'trend-deficit';
      case LiquidityTrend.CriticalDeficit:
        return 'trend-critical';
      default:
        return '';
    }
  }

  trendIcon(trend: LiquidityTrend): string {
    switch (trend) {
      case LiquidityTrend.Surplus:
        return 'trending_up';
      case LiquidityTrend.Balanced:
        return 'trending_flat';
      case LiquidityTrend.Deficit:
        return 'trending_down';
      case LiquidityTrend.CriticalDeficit:
        return 'warning';
      default:
        return 'help';
    }
  }

  formatWaitTime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }

  trackByZoneId(_: number, zone: DemandLiquidity): string {
    return zone.zoneId;
  }
}
