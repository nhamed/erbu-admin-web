import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

// ---------- Types ----------

export type TimelineEventSeverity = 'info' | 'success' | 'warning' | 'error' | 'neutral';

export interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  severity: TimelineEventSeverity;
  icon: string | null;
  source: string | null;
  metadata: Record<string, string>;
}

const SEVERITY_ICONS: Record<TimelineEventSeverity, string> = {
  info: 'info',
  success: 'check_circle',
  warning: 'warning',
  error: 'error',
  neutral: 'circle',
};

@Component({
  selector: 'geo-status-timeline',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './status-timeline.component.html',
  styleUrl: './status-timeline.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusTimelineComponent {
  readonly events = input.required<TimelineEvent[]>();
  readonly maxVisible = input<number>(50);
  readonly title = input<string>('');

  readonly visibleEvents = computed(() => {
    const sorted = [...this.events()].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
    return sorted.slice(0, this.maxVisible());
  });

  readonly totalCount = computed(() => this.events().length);

  eventIcon(event: TimelineEvent): string {
    return event.icon ?? SEVERITY_ICONS[event.severity] ?? 'circle';
  }

  formatTimestamp(ts: string): string {
    try {
      const date = new Date(ts);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();

      if (diffMs < 60000) return 'just now';
      if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)}m ago`;
      if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)}h ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return ts;
    }
  }

  trackByEventId(_: number, event: TimelineEvent): string {
    return event.id;
  }
}
