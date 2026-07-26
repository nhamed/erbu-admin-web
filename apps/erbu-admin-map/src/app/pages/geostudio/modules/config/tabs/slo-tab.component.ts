import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfigService, SloDefinition } from '../config.service';

@Component({
  selector: 'app-config-slo-tab',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './slo-tab.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SloTabComponent {
  readonly svc = inject(ConfigService);

  readonly filterBreaching = signal(false);
  readonly expandedSloId = signal<string | null>(null);
  readonly editingSloId = signal<string | null>(null);
  readonly editTarget = signal<number>(99.9);
  readonly editWindow = signal<number>(30);

  readonly filteredSlos = computed(() => {
    const slos = this.svc.slos();
    if (this.filterBreaching()) {
      return slos.filter((s) => s.isBreaching);
    }
    return slos;
  });

  readonly healthySloCount = computed(
    () => this.svc.slos().filter((s) => !s.isBreaching).length,
  );

  toggleBreachingFilter(): void {
    this.filterBreaching.update((v) => !v);
  }

  toggleExpand(sloId: string): void {
    this.expandedSloId.update((current) =>
      current === sloId ? null : sloId,
    );
  }

  startEdit(slo: SloDefinition): void {
    this.editingSloId.set(slo.id);
    this.editTarget.set(slo.targetPercent);
    this.editWindow.set(slo.windowDays);
  }

  cancelEdit(): void {
    this.editingSloId.set(null);
  }

  saveEdit(sloId: string): void {
    this.svc
      .updateSlo(sloId, {
        targetPercent: this.editTarget(),
        windowDays: this.editWindow(),
      })
      .subscribe({
        next: () => this.editingSloId.set(null),
      });
  }

  budgetClass(remaining: number): string {
    if (remaining > 50) return 'budget-healthy';
    if (remaining > 20) return 'budget-warning';
    return 'budget-critical';
  }

  sloStatusClass(slo: SloDefinition): string {
    return slo.isBreaching ? 'slo-breaching' : 'slo-healthy';
  }

  trackBySloId(_: number, slo: SloDefinition): string {
    return slo.id;
  }
}
