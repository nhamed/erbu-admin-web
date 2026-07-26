import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { VoipService, CallType } from '@erbu-admin-web/shared/data-access';
import { VoipCallStatus } from '@erbu-admin-web/shared/models';

@Component({
  selector: 'app-voip-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './voip-panel.component.html',
  styleUrl: './voip-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoipPanelComponent {
  private readonly voip = inject(VoipService);

  /** The target ID (driver or rider) to call */
  readonly targetId = signal('');

  /** Whether calling a driver or rider */
  readonly targetType = signal<'driver' | 'rider'>('driver');

  /** Panel expanded state */
  readonly expanded = signal(false);

  /** Call error message */
  readonly callError = signal<string | null>(null);

  // Expose VoIP service signals
  readonly callState = this.voip.callState;
  readonly isInCall = this.voip.isInCall;
  readonly localAudioEnabled = this.voip.localAudioEnabled;

  readonly statusLabel = computed(() => {
    const state = this.callState();
    if (!state) return 'Idle';
    switch (state.status) {
      case VoipCallStatus.Ringing:
        return 'Ringing...';
      case VoipCallStatus.Answered:
        return 'Connected';
      case VoipCallStatus.OnHold:
        return 'On Hold';
      case VoipCallStatus.Ended:
        return 'Call Ended';
      case VoipCallStatus.Missed:
        return 'Missed';
      case VoipCallStatus.Failed:
        return 'Failed';
      default:
        return 'Unknown';
    }
  });

  readonly statusClass = computed(() => {
    const state = this.callState();
    if (!state) return 'status-idle';
    switch (state.status) {
      case VoipCallStatus.Answered:
        return 'status-connected';
      case VoipCallStatus.Ringing:
        return 'status-ringing';
      case VoipCallStatus.Failed:
      case VoipCallStatus.Missed:
        return 'status-error';
      default:
        return 'status-idle';
    }
  });

  readonly callDuration = computed(() => {
    const state = this.callState();
    if (!state?.durationSeconds) return null;
    const mins = Math.floor(state.durationSeconds / 60);
    const secs = state.durationSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  });

  toggleExpanded(): void {
    this.expanded.update((v) => !v);
  }

  async callTarget(type: CallType = 'audio'): Promise<void> {
    const id = this.targetId().trim();
    if (!id) return;

    this.callError.set(null);
    try {
      await this.voip.initiateCall(id, type);
    } catch (err) {
      this.callError.set(
        err instanceof Error ? err.message : 'Call failed',
      );
    }
  }

  async hangUp(): Promise<void> {
    this.callError.set(null);
    try {
      await this.voip.endCall();
    } catch (err) {
      this.callError.set(
        err instanceof Error ? err.message : 'Hang up failed',
      );
    }
  }

  toggleMute(): void {
    this.voip.toggleAudio();
  }

  setTargetType(type: 'driver' | 'rider'): void {
    this.targetType.set(type);
  }
}
