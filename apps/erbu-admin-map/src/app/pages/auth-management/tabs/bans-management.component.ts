import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  AuthManagementService,
  Ban,
  BanCreateRequest,
  BanReason,
  BanStatus,
} from '../auth-management.service';

@Component({
  selector: 'app-bans-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bans-management.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BansManagementComponent implements OnInit {
  private readonly svc = inject(AuthManagementService);

  readonly bans = this.svc.bans;
  readonly totalBans = this.svc.totalBans;
  readonly activeBanCount = this.svc.activeBanCount;
  readonly loading = this.svc.loading;

  // create ban form
  readonly showBanForm = signal(false);
  readonly banUserId = signal('');
  readonly banReason = signal<BanReason>('TOS_Violation');
  readonly banDescription = signal('');
  readonly banDurationDays = signal<number | null>(null);
  readonly banPermanent = signal(false);
  readonly submitting = signal(false);

  // filter
  readonly filterStatus = signal<BanStatus | null>(null);

  readonly reasonOptions: BanReason[] = ['Fraud', 'Abuse', 'TOS_Violation', 'Spam', 'Other'];
  readonly statusOptions: BanStatus[] = ['Active', 'Expired', 'Revoked'];

  readonly canCreateBan = computed(
    () =>
      this.banUserId().trim().length > 0 &&
      this.banDescription().trim().length > 0 &&
      (this.banPermanent() || (this.banDurationDays() !== null && (this.banDurationDays() ?? 0) > 0)) &&
      !this.submitting(),
  );

  ngOnInit(): void {
    this.svc.loadBans();
  }

  onStatusFilterChange(status: string): void {
    const s = (status as BanStatus) || null;
    this.filterStatus.set(s);
    this.svc.loadBans(1, 25, s ?? undefined);
  }

  toggleBanForm(): void {
    this.showBanForm.update((v) => !v);
    this.clearBanForm();
  }

  submitBan(): void {
    if (!this.canCreateBan()) return;
    this.submitting.set(true);

    const data: BanCreateRequest = {
      userId: this.banUserId().trim(),
      reason: this.banReason(),
      description: this.banDescription().trim(),
      durationDays: this.banPermanent() ? null : this.banDurationDays(),
    };

    this.svc.createBan(data).subscribe({
      next: () => {
        this.showBanForm.set(false);
        this.clearBanForm();
        this.submitting.set(false);
      },
      error: () => {
        this.submitting.set(false);
      },
    });
  }

  revokeBan(banId: string): void {
    if (!confirm('Revoke this ban?')) return;
    this.svc.revokeBan(banId).subscribe();
  }

  onPermanentChange(permanent: boolean): void {
    this.banPermanent.set(permanent);
    if (permanent) {
      this.banDurationDays.set(null);
    }
  }

  reasonLabel(reason: BanReason): string {
    return reason.replace(/_/g, ' ');
  }

  banStatusClass(status: BanStatus): string {
    switch (status) {
      case 'Active':
        return 'ban-active';
      case 'Expired':
        return 'ban-expired';
      case 'Revoked':
        return 'ban-revoked';
      default:
        return '';
    }
  }

  trackByBanId(_: number, ban: Ban): string {
    return ban.id;
  }

  private clearBanForm(): void {
    this.banUserId.set('');
    this.banReason.set('TOS_Violation');
    this.banDescription.set('');
    this.banDurationDays.set(null);
    this.banPermanent.set(false);
  }
}
