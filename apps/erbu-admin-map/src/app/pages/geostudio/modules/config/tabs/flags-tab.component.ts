import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfigService, FeatureFlag, FlagStatus } from '../config.service';

@Component({
  selector: 'app-config-flags-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './flags-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FlagsTabComponent {
  readonly svc = inject(ConfigService);

  readonly searchTerm = signal('');
  readonly statusFilter = signal<FlagStatus | ''>('');
  readonly expandedFlagId = signal<string | null>(null);

  readonly filteredFlags = computed(() => {
    let flags = this.svc.flags();
    const term = this.searchTerm().toLowerCase();
    const status = this.statusFilter();

    if (term) {
      flags = flags.filter(
        (f) =>
          f.name.toLowerCase().includes(term) ||
          f.key.toLowerCase().includes(term) ||
          f.description.toLowerCase().includes(term),
      );
    }
    if (status) {
      flags = flags.filter((f) => f.status === status);
    }
    return flags;
  });

  readonly statusOptions: FlagStatus[] = ['enabled', 'disabled', 'rollout'];

  onSearchChange(value: string): void {
    this.searchTerm.set(value);
  }

  onStatusFilterChange(value: string): void {
    this.statusFilter.set(value as FlagStatus | '');
  }

  toggleFlag(flag: FeatureFlag): void {
    const newEnabled = flag.status !== 'enabled';
    this.svc.toggleFlag(flag.id, newEnabled).subscribe();
  }

  toggleExpand(flagId: string): void {
    this.expandedFlagId.update((current) =>
      current === flagId ? null : flagId,
    );
  }

  statusClass(status: FlagStatus): string {
    switch (status) {
      case 'enabled':
        return 'badge-success';
      case 'disabled':
        return 'badge-muted';
      case 'rollout':
        return 'badge-warning';
      default:
        return '';
    }
  }

  statusIcon(status: FlagStatus): string {
    switch (status) {
      case 'enabled':
        return 'check_circle';
      case 'disabled':
        return 'cancel';
      case 'rollout':
        return 'tune';
      default:
        return 'help';
    }
  }

  trackByFlagId(_: number, flag: FeatureFlag): string {
    return flag.id;
  }
}
