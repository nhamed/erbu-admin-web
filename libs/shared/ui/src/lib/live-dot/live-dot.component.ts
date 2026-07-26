import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'erbu-live-dot',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './live-dot.component.html',
  styleUrl: './live-dot.component.scss',
  host: {
    '[class.connected]': 'connected()',
    '[class.disconnected]': '!connected()',
  },
})
export class LiveDotComponent {
  readonly connected = input<boolean>(false);
}
