import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
  viewChild,
  ElementRef,
  afterNextRender,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';

echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);
import {
  AuditBaseline,
  BaselineComparison,
  BaselineDriftPoint,
  DriftedField,
} from '@erbu-admin-web/shared/models';
import { AuditService } from '../audit.service';
import { JsonViewerDialogComponent, JsonViewerDialogData } from '../json-viewer-dialog.component';

@Component({
  selector: 'app-baselines',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatChipsModule,
    MatDialogModule,
    ScrollingModule,
    NgxEchartsDirective,
  ],
  providers: [provideEchartsCore({ echarts })],
  templateUrl: './baselines.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      display: block;
      padding: 16px;
    }

    .toolbar {
      display: flex;
      gap: 16px;
      align-items: center;
      margin-bottom: 16px;
    }

    .toolbar .spacer { flex: 1; }

    .chart-container {
      height: 320px;
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 8px;
      margin-bottom: 24px;
      padding: 8px;
    }

    .baselines-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 12px;
    }

    .baseline-card {
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 8px;
      padding: 16px;
      transition: box-shadow 0.2s;
    }

    .baseline-card:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .baseline-card.active {
      border-color: #1565c0;
      border-width: 2px;
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }

    .baseline-name {
      font-weight: 500;
      font-size: 14px;
      flex: 1;
    }

    .version-badge {
      font-size: 11px;
      background: #e3f2fd;
      color: #1565c0;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 600;
    }

    .active-badge {
      font-size: 11px;
      background: #e8f5e9;
      color: #2e7d32;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 600;
    }

    .baseline-meta {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.54);
      margin-bottom: 8px;
    }

    .checksum {
      font-family: 'Cascadia Code', 'Consolas', monospace;
      font-size: 11px;
      color: rgba(0, 0, 0, 0.38);
      word-break: break-all;
    }

    .card-actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }

    .comparison-section {
      margin-top: 24px;
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 8px;
      padding: 16px;
    }

    .comparison-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      font-size: 16px;
      font-weight: 500;
    }

    .drift-summary {
      display: flex;
      gap: 24px;
      padding: 12px;
      background: rgba(0, 0, 0, 0.02);
      border-radius: 4px;
      margin-bottom: 12px;
    }

    .drift-stat {
      text-align: center;
    }

    .drift-stat-value {
      font-size: 24px;
      font-weight: 600;
    }

    .drift-stat-label {
      font-size: 11px;
      color: rgba(0, 0, 0, 0.54);
      text-transform: uppercase;
    }

    .drift-ok { color: #2e7d32; }
    .drift-warn { color: #f9a825; }
    .drift-bad { color: #c62828; }

    .drifted-fields-list {
      max-height: 300px;
      overflow-y: auto;
    }

    .drifted-field {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr auto;
      gap: 8px;
      padding: 8px 12px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      font-size: 13px;
      align-items: center;
    }

    .drifted-field:last-child {
      border-bottom: none;
    }

    .field-path {
      font-family: 'Cascadia Code', 'Consolas', monospace;
      font-size: 12px;
      font-weight: 500;
    }

    .field-baseline { color: #2e7d32; }
    .field-current { color: #c62828; }

    .magnitude-bar {
      width: 40px;
      height: 6px;
      background: #e0e0e0;
      border-radius: 3px;
      overflow: hidden;
    }

    .magnitude-fill {
      height: 100%;
      border-radius: 3px;
      background: #f44336;
    }

    .loading-overlay {
      display: flex;
      justify-content: center;
      padding: 48px;
    }

    .empty-state {
      text-align: center;
      padding: 48px;
      color: rgba(0, 0, 0, 0.38);
    }

    .empty-state mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
    }
  `],
})
export class BaselinesComponent implements OnInit {
  private readonly auditService = inject(AuditService);
  private readonly dialog = inject(MatDialog);

  readonly baselines = signal<AuditBaseline[]>([]);
  readonly driftHistory = signal<BaselineDriftPoint[]>([]);
  readonly comparison = signal<BaselineComparison | null>(null);
  readonly selectedBaselineId = signal<string | null>(null);
  readonly isLoading = signal(false);
  readonly isComparing = signal(false);
  readonly error = signal<string | null>(null);

  readonly chartOptions = computed<EChartsOption>(() => {
    const points = this.driftHistory();
    if (points.length === 0) {
      return {};
    }

    // Group by baseline name
    const groups = new Map<string, BaselineDriftPoint[]>();
    for (const p of points) {
      const list = groups.get(p.baselineName) ?? [];
      list.push(p);
      groups.set(p.baselineName, list);
    }

    const series: EChartsOption['series'] = [];
    for (const [name, pts] of groups) {
      series.push({
        name,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: pts.map(p => [p.timestamp, p.driftPercent]),
        areaStyle: { opacity: 0.1 },
      });
    }

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const list = params as Array<{
            seriesName: string;
            data: [string, number];
            color: string;
          }>;
          if (!Array.isArray(list) || list.length === 0) return '';
          const date = new Date(list[0].data[0]).toLocaleString();
          const lines = list.map(
            item =>
              `<span style="color:${item.color}">●</span> ${item.seriesName}: ${item.data[1].toFixed(2)}%`,
          );
          return `${date}<br/>${lines.join('<br/>')}`;
        },
      },
      legend: { top: 8 },
      grid: { top: 40, right: 16, bottom: 32, left: 48 },
      xAxis: {
        type: 'time',
        axisLabel: { fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        name: 'Drift %',
        axisLabel: {
          formatter: (val: number) => `${val}%`,
          fontSize: 11,
        },
        min: 0,
      },
      series,
    };
  });

  ngOnInit(): void {
    this.loadBaselines();
  }

  loadBaselines(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.auditService.getBaselines().subscribe({
      next: data => {
        this.baselines.set(data);
        this.isLoading.set(false);
        // Load drift history for the active baseline
        const active = data.find(b => b.isActive);
        if (active) {
          this.loadDriftHistory(active.id);
        }
      },
      error: err => {
        this.error.set(err?.message ?? 'Failed to load baselines');
        this.isLoading.set(false);
      },
    });
  }

  loadDriftHistory(baselineId: string): void {
    this.selectedBaselineId.set(baselineId);
    this.auditService.getBaselineDriftHistory(baselineId).subscribe({
      next: data => this.driftHistory.set(data),
      error: () => this.driftHistory.set([]),
    });
  }

  compareBaseline(baseline: AuditBaseline): void {
    this.isComparing.set(true);
    this.auditService.compareBaseline(baseline.id).subscribe({
      next: data => {
        this.comparison.set(data);
        this.isComparing.set(false);
      },
      error: err => {
        this.error.set(err?.message ?? 'Comparison failed');
        this.isComparing.set(false);
      },
    });
  }

  viewSnapshotData(baseline: AuditBaseline): void {
    this.dialog.open(JsonViewerDialogComponent, {
      data: {
        title: `Baseline: ${baseline.name} v${baseline.version}`,
        json: baseline.snapshotData,
      } satisfies JsonViewerDialogData,
      width: '720px',
    });
  }

  getDriftClass(percent: number): string {
    if (percent <= 5) return 'drift-ok';
    if (percent <= 20) return 'drift-warn';
    return 'drift-bad';
  }
}
