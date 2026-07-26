import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatSliderModule } from '@angular/material/slider';
import { MatStepperModule } from '@angular/material/stepper';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  DeviceInstance,
  DeviceStatus,
  E2EPlatform,
} from '@erbu-admin-web/shared/models';
import { E2ETestSuite, E2ELaunchRequest } from '../e2e.service';

@Component({
  selector: 'app-e2e-launch-options',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatSliderModule,
    MatStepperModule,
    MatDividerModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './launch-options.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class E2ELaunchOptionsComponent {
  // ── Inputs ─────────────────────────────────────────────────
  readonly suites = input.required<E2ETestSuite[]>();
  readonly devices = input.required<DeviceInstance[]>();
  readonly launching = input<boolean>(false);

  // ── Outputs ────────────────────────────────────────────────
  readonly launch = output<E2ELaunchRequest>();
  readonly refreshDevices = output<void>();

  // ── Form state (signals) ───────────────────────────────────
  readonly selectedSuiteIds = signal<string[]>([]);
  readonly selectedDeviceIds = signal<string[]>([]);
  readonly environment = signal<string>('staging');
  readonly testFilter = signal<string>('');
  readonly parallelCount = signal<number>(1);
  readonly platform = signal<E2EPlatform>(E2EPlatform.Android);
  readonly tags = signal<string[]>([]);
  readonly retryFailedCount = signal<number>(0);
  readonly recordVideo = signal<boolean>(true);
  readonly captureScreenshots = signal<boolean>(true);
  readonly tagInput = signal<string>('');

  // ── Computed ───────────────────────────────────────────────
  readonly availableDevices = computed(() =>
    this.devices().filter((d) => d.status === DeviceStatus.Available),
  );

  readonly filteredSuites = computed(() => {
    const p = this.platform();
    return this.suites().filter((s) => s.platform === p);
  });

  readonly selectedSuiteCount = computed(
    () => this.selectedSuiteIds().length,
  );

  readonly selectedDeviceCount = computed(
    () => this.selectedDeviceIds().length,
  );

  readonly estimatedDuration = computed(() => {
    const suites = this.filteredSuites();
    const selected = this.selectedSuiteIds();
    const parallel = Math.max(1, this.parallelCount());
    const totalSeconds = suites
      .filter((s) => selected.includes(s.id))
      .reduce((sum, s) => sum + s.avgDurationSeconds, 0);
    return Math.ceil(totalSeconds / parallel);
  });

  readonly canLaunch = computed(
    () =>
      this.selectedSuiteIds().length > 0 &&
      this.selectedDeviceIds().length > 0 &&
      !this.launching(),
  );

  readonly environments = ['local', 'staging', 'production'];
  readonly platforms = Object.values(E2EPlatform);

  // ── Actions ────────────────────────────────────────────────
  onLaunch(): void {
    if (!this.canLaunch()) return;

    const request: E2ELaunchRequest = {
      suiteIds: this.selectedSuiteIds(),
      deviceIds: this.selectedDeviceIds(),
      environment: this.environment(),
      testFilter: this.testFilter(),
      parallelCount: this.parallelCount(),
      platform: this.platform(),
      tags: this.tags(),
      retryFailedCount: this.retryFailedCount(),
      recordVideo: this.recordVideo(),
      captureScreenshots: this.captureScreenshots(),
    };

    this.launch.emit(request);
  }

  onRefreshDevices(): void {
    this.refreshDevices.emit();
  }

  addTag(): void {
    const tag = this.tagInput().trim();
    if (tag && !this.tags().includes(tag)) {
      this.tags.update((t) => [...t, tag]);
      this.tagInput.set('');
    }
  }

  removeTag(tag: string): void {
    this.tags.update((t) => t.filter((x) => x !== tag));
  }

  formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
}
