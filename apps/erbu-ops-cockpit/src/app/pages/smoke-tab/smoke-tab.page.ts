import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { StatusPillComponent, KpiCardComponent } from '@erbu-admin-web/shared/ui';
import { SmokeResult, SmokeStatus } from '@erbu-admin-web/shared/models';
import { SmokeTabService } from './smoke-tab.service';

const AUTO_REFRESH_MS = 30_000;

@Component({
  selector: 'app-smoke-tab',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    StatusPillComponent,
    KpiCardComponent,
  ],
  templateUrl: './smoke-tab.page.html',
  styleUrl: './smoke-tab.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SmokeTabPage implements OnInit, OnDestroy {
  private readonly smokeService = inject(SmokeTabService);
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  // ── State signals ──────────────────────────────────────────
  readonly results = signal<SmokeResult[]>([]);
  readonly loading = signal(false);
  readonly running = signal(false);
  readonly lastRefreshed = signal<Date | null>(null);

  // ── Computed KPIs ──────────────────────────────────────────
  readonly totalServices = computed(() => this.results().length);

  readonly healthyCount = computed(
    () => this.results().filter(r => r.status === SmokeStatus.Passed).length,
  );

  readonly unhealthyCount = computed(
    () => this.results().filter(r => r.status === SmokeStatus.Failed).length,
  );

  readonly avgLatency = computed(() => {
    const rows = this.results();
    if (rows.length === 0) return 0;
    const total = rows.reduce((sum, r) => sum + r.durationSeconds, 0);
    return total / rows.length;
  });

  readonly avgLatencyDisplay = computed(() => {
    const avg = this.avgLatency();
    return avg === 0 ? '--' : `${avg.toFixed(1)}s`;
  });

  // ── Table config ───────────────────────────────────────────
  readonly displayedColumns: string[] = [
    'suiteName',
    'status',
    'passRate',
    'duration',
    'startedAt',
    'environment',
    'triggeredBy',
  ];

  // ── Lifecycle ──────────────────────────────────────────────
  ngOnInit(): void {
    this.loadResults();
    this.refreshTimer = setInterval(() => this.loadResults(), AUTO_REFRESH_MS);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // ── Actions ────────────────────────────────────────────────
  onRunAll(): void {
    this.running.set(true);
    this.smokeService.runAll().subscribe({
      next: () => {
        this.running.set(false);
        this.loadResults();
      },
      error: () => {
        this.running.set(false);
      },
    });
  }

  // ── Private ────────────────────────────────────────────────
  private loadResults(): void {
    this.loading.set(true);
    this.smokeService.getResults().subscribe({
      next: (data) => {
        this.results.set(data);
        this.lastRefreshed.set(new Date());
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }
}
