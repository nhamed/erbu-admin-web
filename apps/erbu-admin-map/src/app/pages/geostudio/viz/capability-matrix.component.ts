import {
  Component,
  ChangeDetectionStrategy,
  input,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

// ---------- Types ----------

export type CapabilityStatus = 'enabled' | 'disabled' | 'partial' | 'unknown';

export interface CapabilityCell {
  status: CapabilityStatus;
  label: string | null;
  tooltip: string | null;
}

export interface CapabilityRow {
  featureId: string;
  featureName: string;
  featureIcon: string | null;
  cells: CapabilityCell[];
}

export interface CapabilityMatrixData {
  environments: string[];
  rows: CapabilityRow[];
}

const STATUS_ICON: Record<CapabilityStatus, string> = {
  enabled: 'check_circle',
  disabled: 'cancel',
  partial: 'remove_circle',
  unknown: 'help',
};

const STATUS_CLASS: Record<CapabilityStatus, string> = {
  enabled: 'cell-enabled',
  disabled: 'cell-disabled',
  partial: 'cell-partial',
  unknown: 'cell-unknown',
};

@Component({
  selector: 'geo-capability-matrix',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  templateUrl: './capability-matrix.component.html',
  styleUrl: './capability-matrix.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CapabilityMatrixComponent {
  readonly data = input.required<CapabilityMatrixData>();
  readonly title = input<string>('Capability Matrix');

  readonly environments = computed(() => this.data().environments);
  readonly rows = computed(() => this.data().rows);

  readonly summary = computed(() => {
    const allCells = this.rows().flatMap((r) => r.cells);
    const total = allCells.length;
    if (total === 0) return { enabled: 0, disabled: 0, partial: 0, percent: 0 };

    const enabled = allCells.filter((c) => c.status === 'enabled').length;
    const disabled = allCells.filter((c) => c.status === 'disabled').length;
    const partial = allCells.filter((c) => c.status === 'partial').length;

    return {
      enabled,
      disabled,
      partial,
      percent: Math.round((enabled / total) * 100),
    };
  });

  statusIcon(status: CapabilityStatus): string {
    return STATUS_ICON[status];
  }

  statusClass(status: CapabilityStatus): string {
    return STATUS_CLASS[status];
  }

  trackByFeatureId(_: number, row: CapabilityRow): string {
    return row.featureId;
  }

  trackByIndex(index: number): number {
    return index;
  }
}
