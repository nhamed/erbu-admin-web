import {
  Component,
  ChangeDetectionStrategy,
  input,
  signal,
  effect,
  ElementRef,
  viewChild,
  OnDestroy,
  PLATFORM_ID,
  inject,
  afterNextRender,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

// ---------- Types ----------

export type ChartType = 'line' | 'bar' | 'area' | 'pie' | 'gauge';

export interface ChartSeries {
  name: string;
  data: number[];
  color?: string;
  type?: ChartType;
}

export interface ChartConfig {
  type: ChartType;
  title: string;
  categories: string[];
  series: ChartSeries[];
  height?: number;
  showLegend?: boolean;
  showGrid?: boolean;
  yAxisLabel?: string;
  xAxisLabel?: string;
}

type EChartsInstance = {
  setOption(option: unknown, notMerge?: boolean): void;
  resize(): void;
  dispose(): void;
};

@Component({
  selector: 'geo-analytics-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analytics-chart.component.html',
  styleUrl: './analytics-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsChartComponent implements OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);

  readonly config = input.required<ChartConfig>();
  readonly loading = signal(true);

  readonly chartContainer = viewChild<ElementRef<HTMLDivElement>>('chartEl');

  private chart: EChartsInstance | null = null;
  private resizeHandler = () => this.chart?.resize();

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      afterNextRender(() => this.initChart());
    }

    // Re-render on config changes
    effect(() => {
      const cfg = this.config();
      if (this.chart && cfg) {
        this.updateChart(cfg);
      }
    });
  }

  ngOnDestroy(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('resize', this.resizeHandler);
    }
    this.chart?.dispose();
    this.chart = null;
  }

  private async initChart(): Promise<void> {
    const container = this.chartContainer()?.nativeElement;
    if (!container) return;

    try {
      const echarts = await import('echarts/core');
      const { LineChart, BarChart, PieChart, GaugeChart } = await import('echarts/charts');
      const { GridComponent, TooltipComponent, LegendComponent, TitleComponent } =
        await import('echarts/components');
      const { CanvasRenderer } = await import('echarts/renderers');

      echarts.use([
        LineChart, BarChart, PieChart, GaugeChart,
        GridComponent, TooltipComponent, LegendComponent, TitleComponent,
        CanvasRenderer,
      ]);

      this.chart = echarts.init(container, 'dark') as unknown as EChartsInstance;
      this.updateChart(this.config());
      window.addEventListener('resize', this.resizeHandler);
      this.loading.set(false);
    } catch {
      this.loading.set(false);
    }
  }

  private updateChart(cfg: ChartConfig): void {
    if (!this.chart) return;

    const isPie = cfg.type === 'pie';
    const isGauge = cfg.type === 'gauge';

    const option: Record<string, unknown> = {
      title: {
        text: cfg.title,
        textStyle: { color: '#e0e0e0', fontSize: 14 },
        left: 'center',
        top: 8,
      },
      tooltip: {
        trigger: isPie || isGauge ? 'item' : 'axis',
      },
    };

    if (cfg.showLegend !== false) {
      option['legend'] = {
        bottom: 0,
        textStyle: { color: '#8e8ea0', fontSize: 11 },
        data: cfg.series.map((s) => s.name),
      };
    }

    if (!isPie && !isGauge) {
      option['grid'] = {
        left: 50,
        right: 20,
        top: 40,
        bottom: cfg.showLegend !== false ? 40 : 20,
        show: cfg.showGrid ?? false,
      };
      option['xAxis'] = {
        type: 'category',
        data: cfg.categories,
        name: cfg.xAxisLabel ?? '',
        nameTextStyle: { color: '#8e8ea0' },
        axisLabel: { color: '#8e8ea0', fontSize: 11 },
        axisLine: { lineStyle: { color: '#333' } },
      };
      option['yAxis'] = {
        type: 'value',
        name: cfg.yAxisLabel ?? '',
        nameTextStyle: { color: '#8e8ea0' },
        axisLabel: { color: '#8e8ea0', fontSize: 11 },
        splitLine: { lineStyle: { color: '#222' } },
      };
    }

    if (isPie) {
      option['series'] = [
        {
          type: 'pie',
          radius: ['40%', '70%'],
          data: cfg.series.map((s) => ({
            name: s.name,
            value: s.data.reduce((a, b) => a + b, 0),
            itemStyle: s.color ? { color: s.color } : undefined,
          })),
          label: { color: '#8e8ea0' },
        },
      ];
    } else if (isGauge) {
      option['series'] = cfg.series.map((s) => ({
        type: 'gauge',
        data: [{ value: s.data[0] ?? 0, name: s.name }],
        detail: { formatter: '{value}%', color: '#e0e0e0' },
        axisLine: { lineStyle: { width: 10 } },
      }));
    } else {
      option['series'] = cfg.series.map((s) => {
        const seriesType = s.type ?? cfg.type;
        const base: Record<string, unknown> = {
          name: s.name,
          type: seriesType === 'area' ? 'line' : seriesType,
          data: s.data,
          smooth: true,
        };
        if (s.color) {
          base['itemStyle'] = { color: s.color };
          base['lineStyle'] = { color: s.color };
        }
        if (seriesType === 'area') {
          base['areaStyle'] = { opacity: 0.15 };
        }
        return base;
      });
    }

    this.chart.setOption(option, true);
  }
}
