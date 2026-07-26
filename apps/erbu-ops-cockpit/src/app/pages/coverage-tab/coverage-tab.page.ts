import {
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import * as echarts from 'echarts/core';
import { LineChart, PieChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { EChartsOption } from 'echarts';

echarts.use([LineChart, PieChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);

import {
  CoverageService,
  CoverageFileNode,
  CoverageThreshold,
  CoverageThresholdUpdate,
  CoverageMatrixEntry,
  CoverageTrendPoint,
} from './coverage.service';

@Component({
  selector: 'app-coverage-tab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatExpansionModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatChipsModule,
    MatTabsModule,
    MatDividerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatMenuModule,
    NgxEchartsDirective,
  ],
  providers: [provideEchartsCore({ echarts })],
  templateUrl: './coverage-tab.page.html',
  styleUrl: './coverage-tab.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CoverageTabPage implements OnInit {
  readonly coverageService = inject(CoverageService);
  private readonly snackBar = inject(MatSnackBar);

  // -- Local UI state --
  readonly trendDays = signal(30);
  readonly expandedNodes = signal<Set<string>>(new Set());
  readonly editingThreshold = signal<CoverageThreshold | null>(null);
  readonly matrixDisplayedColumns = signal([
    'serviceName',
    'unit',
    'integration',
    'e2e',
    'smoke',
    'overall',
  ]);
  readonly selectedProject = signal<string>('');

  // -- Chart options (computed from service signals) --

  readonly lineDonutOption = computed<EChartsOption>(() => {
    const ov = this.coverageService.overview();
    if (!ov) return {};
    return this.buildDonutOption(
      'Line Coverage',
      ov.lineCoveragePercent,
      ov.coveredLines,
      ov.totalLines,
    );
  });

  readonly branchDonutOption = computed<EChartsOption>(() => {
    const ov = this.coverageService.overview();
    if (!ov) return {};
    return this.buildDonutOption(
      'Branch Coverage',
      ov.branchCoveragePercent,
      ov.coveredBranches,
      ov.totalBranches,
    );
  });

  readonly functionDonutOption = computed<EChartsOption>(() => {
    const ov = this.coverageService.overview();
    if (!ov) return {};
    return this.buildDonutOption(
      'Function Coverage',
      ov.functionCoveragePercent,
      ov.coveredFunctions,
      ov.totalFunctions,
    );
  });

  readonly trendChartOption = computed<EChartsOption>(() => {
    const points = this.coverageService.trend();
    if (!points.length) return {};
    return this.buildTrendOption(points);
  });

  // -- Helpers for template --

  readonly matrixData = computed(() => this.coverageService.matrix());
  readonly fileTreeData = computed(() => this.coverageService.fileTree());

  ngOnInit(): void {
    this.coverageService.loadDashboard();
  }

  // -- Donut chart builder --

  private buildDonutOption(
    title: string,
    percent: number,
    covered: number,
    total: number,
  ): EChartsOption {
    const uncovered = total - covered;
    const color = this.getCoverageColor(percent);
    return {
      title: {
        text: `${percent.toFixed(1)}%`,
        left: 'center',
        top: 'center',
        textStyle: {
          fontSize: 22,
          fontWeight: 'bold',
          color,
        },
      },
      tooltip: {
        trigger: 'item',
        formatter: `${title}<br/>Covered: ${covered}/${total}`,
      },
      series: [
        {
          type: 'pie',
          radius: ['60%', '80%'],
          avoidLabelOverlap: false,
          label: { show: false },
          emphasis: {
            label: { show: false },
          },
          data: [
            {
              value: covered,
              name: 'Covered',
              itemStyle: { color },
            },
            {
              value: uncovered,
              name: 'Uncovered',
              itemStyle: { color: '#e0e0e0' },
            },
          ],
        },
      ],
    };
  }

  // -- Trend chart builder --

  private buildTrendOption(points: CoverageTrendPoint[]): EChartsOption {
    const dates = points.map((p) => p.date);
    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
      },
      legend: {
        data: ['Line', 'Branch', 'Function'],
        bottom: 0,
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '12%',
        top: '8%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dates,
        axisLabel: { rotate: 45 },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: { formatter: '{value}%' },
      },
      series: [
        {
          name: 'Line',
          type: 'line',
          smooth: true,
          data: points.map((p) => p.lineCoveragePercent),
          lineStyle: { color: '#4caf50' },
          itemStyle: { color: '#4caf50' },
          areaStyle: { color: 'rgba(76, 175, 80, 0.08)' },
        },
        {
          name: 'Branch',
          type: 'line',
          smooth: true,
          data: points.map((p) => p.branchCoveragePercent),
          lineStyle: { color: '#2196f3' },
          itemStyle: { color: '#2196f3' },
          areaStyle: { color: 'rgba(33, 150, 243, 0.08)' },
        },
        {
          name: 'Function',
          type: 'line',
          smooth: true,
          data: points.map((p) => p.functionCoveragePercent),
          lineStyle: { color: '#ff9800' },
          itemStyle: { color: '#ff9800' },
          areaStyle: { color: 'rgba(255, 152, 0, 0.08)' },
        },
      ],
    };
  }

  // -- Color coding --

  getCoverageColor(percent: number): string {
    if (percent >= 80) return '#4caf50';
    if (percent >= 60) return '#ff9800';
    if (percent >= 40) return '#f44336';
    return '#b71c1c';
  }

  getCoverageClass(percent: number): string {
    if (percent >= 80) return 'coverage-high';
    if (percent >= 60) return 'coverage-medium';
    if (percent >= 40) return 'coverage-low';
    return 'coverage-critical';
  }

  // -- File tree actions --

  toggleNode(path: string): void {
    this.expandedNodes.update((set) => {
      const next = new Set(set);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  isExpanded(path: string): boolean {
    return this.expandedNodes().has(path);
  }

  // -- Trend range --

  onTrendDaysChange(days: number): void {
    this.trendDays.set(days);
    this.coverageService.loadTrend(days);
  }

  // -- Threshold management --

  startEditThreshold(threshold: CoverageThreshold): void {
    this.editingThreshold.set({ ...threshold });
  }

  cancelEditThreshold(): void {
    this.editingThreshold.set(null);
  }

  saveThreshold(threshold: CoverageThreshold): void {
    const update: CoverageThresholdUpdate = {
      metric: threshold.metric,
      warningPercent: threshold.warningPercent,
      failPercent: threshold.failPercent,
      scope: threshold.scope,
    };

    this.coverageService.updateThreshold(threshold.id, update).subscribe({
      next: () => {
        this.editingThreshold.set(null);
        this.snackBar.open('Threshold updated.', 'OK', { duration: 3000 });
      },
      error: () => {
        this.snackBar.open('Failed to update threshold.', 'Dismiss', {
          duration: 5000,
        });
      },
    });
  }

  deleteThreshold(id: string): void {
    this.coverageService.deleteThreshold(id).subscribe({
      next: () => {
        this.snackBar.open('Threshold deleted.', 'OK', { duration: 3000 });
      },
      error: () => {
        this.snackBar.open('Failed to delete threshold.', 'Dismiss', {
          duration: 5000,
        });
      },
    });
  }

  // -- Report generation --

  generatePdfReport(): void {
    this.coverageService
      .generateReport({
        projectName: this.selectedProject() || undefined,
      })
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `coverage-report-${new Date().toISOString().slice(0, 10)}.pdf`;
          anchor.click();
          URL.revokeObjectURL(url);
          this.snackBar.open('Report downloaded.', 'OK', { duration: 3000 });
        },
        error: () => {
          this.snackBar.open('Failed to generate report.', 'Dismiss', {
            duration: 5000,
          });
        },
      });
  }

  // -- Refresh --

  refresh(): void {
    this.coverageService.loadDashboard();
  }

  trackByPath(_index: number, node: CoverageFileNode): string {
    return node.path;
  }

  trackByService(_index: number, entry: CoverageMatrixEntry): string {
    return entry.serviceName;
  }

  trackByThresholdId(_index: number, threshold: CoverageThreshold): string {
    return threshold.id;
  }
}
