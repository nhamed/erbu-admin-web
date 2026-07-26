import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'geo-sparkline',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sparkline.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SparklineComponent {
  readonly data = input.required<number[]>();
  readonly width = input<number>(80);
  readonly height = input<number>(24);
  readonly color = input<string>('#00d4ff');
  readonly fillOpacity = input<number>(0.15);
  readonly strokeWidth = input<number>(1.5);

  readonly viewBox = computed(() => `0 0 ${this.width()} ${this.height()}`);

  readonly linePath = computed(() => {
    const values = this.data();
    if (!values || values.length < 2) return '';

    const w = this.width();
    const h = this.height();
    const padding = 2;
    const drawW = w - padding * 2;
    const drawH = h - padding * 2;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const points = values.map((v, i) => {
      const x = padding + (i / (values.length - 1)) * drawW;
      const y = padding + drawH - ((v - min) / range) * drawH;
      return `${x},${y}`;
    });

    return `M${points.join(' L')}`;
  });

  readonly fillPath = computed(() => {
    const values = this.data();
    if (!values || values.length < 2) return '';

    const w = this.width();
    const h = this.height();
    const padding = 2;
    const drawW = w - padding * 2;
    const drawH = h - padding * 2;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const points = values.map((v, i) => {
      const x = padding + (i / (values.length - 1)) * drawW;
      const y = padding + drawH - ((v - min) / range) * drawH;
      return `${x},${y}`;
    });

    const lastX = padding + drawW;
    const firstX = padding;
    const bottom = h - padding;

    return `M${firstX},${bottom} L${points.join(' L')} L${lastX},${bottom} Z`;
  });

  readonly trend = computed(() => {
    const values = this.data();
    if (!values || values.length < 2) return 'stable';
    const last = values[values.length - 1];
    const first = values[0];
    if (last > first * 1.05) return 'up';
    if (last < first * 0.95) return 'down';
    return 'stable';
  });
}
