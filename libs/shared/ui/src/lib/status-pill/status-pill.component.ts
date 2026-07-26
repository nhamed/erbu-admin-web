import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type StatusPillKind = 'ok' | 'warn' | 'error' | 'info' | 'neutral';

@Component({
  selector: 'erbu-status-pill',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './status-pill.component.html',
  styleUrl: './status-pill.component.scss',
  host: {
    '[attr.data-kind]': 'kind()',
  },
})
export class StatusPillComponent {
  readonly text = input.required<string>();
  readonly kind = input<StatusPillKind>('neutral');
}
