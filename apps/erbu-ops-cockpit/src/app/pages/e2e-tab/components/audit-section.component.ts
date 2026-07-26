import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { SmokeStatus } from '@erbu-admin-web/shared/models';
import { CoverageImpact, E2ERegression } from '../e2e.service';

@Component({
  selector: 'app-e2e-audit-section',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatProgressBarModule,
    MatDividerModule,
  ],
  templateUrl: './audit-section.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class E2EAuditSectionComponent {
  // ── Inputs ─────────────────────────────────────────────────
  readonly coverageImpact = input<CoverageImpact | null>(null);
  readonly regressions = input<E2ERegression[]>([]);
  readonly totalTests = input<number>(0);
  readonly passedTests = input<number>(0);
  readonly failedTests = input<number>(0);

  // ── Computed ───────────────────────────────────────────────
  readonly passRate = computed(() => {
    const total = this.totalTests();
    if (total === 0) return 0;
    return Math.round((this.passedTests() / total) * 100);
  });

  readonly coverageDeltaClass = computed(() => {
    const impact = this.coverageImpact();
    if (!impact) return 'neutral';
    if (impact.delta > 0) return 'positive';
    if (impact.delta < 0) return 'negative';
    return 'neutral';
  });

  readonly coverageDeltaIcon = computed(() => {
    const impact = this.coverageImpact();
    if (!impact) return 'remove';
    if (impact.delta > 0) return 'trending_up';
    if (impact.delta < 0) return 'trending_down';
    return 'trending_flat';
  });

  readonly activeRegressions = computed(() =>
    this.regressions().filter(
      (r) => r.currentStatus === SmokeStatus.Failed,
    ),
  );

  readonly regressionColumns: string[] = [
    'testName',
    'previousStatus',
    'currentStatus',
    'firstFailedAt',
    'failureCount',
  ];

  // ── Helpers ────────────────────────────────────────────────
  statusClass(status: SmokeStatus): string {
    switch (status) {
      case SmokeStatus.Passed:
        return 'status-passed';
      case SmokeStatus.Failed:
        return 'status-failed';
      case SmokeStatus.Running:
        return 'status-running';
      default:
        return 'status-default';
    }
  }
}
