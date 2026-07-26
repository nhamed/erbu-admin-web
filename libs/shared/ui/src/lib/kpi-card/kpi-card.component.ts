import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

export type KpiTrend = 'up' | 'down' | 'flat';

@Component({
  selector: 'erbu-kpi-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  templateUrl: './kpi-card.component.html',
  styleUrl: './kpi-card.component.scss',
  host: {
    '[attr.data-trend]': 'trend()',
  },
})
export class KpiCardComponent {
  readonly title = input.required<string>();
  readonly value = input.required<string | number>();
  readonly trend = input<KpiTrend>('flat');
  readonly unit = input<string>('');

  get trendIcon(): string {
    switch (this.trend()) {
      case 'up':
        return 'trending_up';
      case 'down':
        return 'trending_down';
      case 'flat':
        return 'trending_flat';
    }
  }
}
