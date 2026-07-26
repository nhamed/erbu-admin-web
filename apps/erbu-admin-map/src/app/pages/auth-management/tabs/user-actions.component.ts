import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  AuthManagementService,
  AuthUser,
  UserCreateRequest,
  UserRole,
} from '../auth-management.service';

@Component({
  selector: 'app-user-actions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-actions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserActionsComponent {
  private readonly svc = inject(AuthManagementService);

  readonly selectedUser = this.svc.selectedUser;
  readonly loading = this.svc.loading;
  readonly error = this.svc.error;

  // lock form
  readonly lockDuration = signal(30);

  // suspend form
  readonly suspendReason = signal('');

  // create user form
  readonly showCreateForm = signal(false);
  readonly createEmail = signal('');
  readonly createDisplayName = signal('');
  readonly createRole = signal<UserRole>('Viewer');
  readonly createPassword = signal('');
  readonly createSendVerification = signal(true);
  readonly creating = signal(false);

  readonly roleOptions: UserRole[] = ['Admin', 'Operator', 'Viewer', 'Driver', 'Rider'];

  readonly actionMessage = signal<string | null>(null);

  readonly canCreateUser = computed(
    () =>
      this.createEmail().trim().length > 0 &&
      this.createDisplayName().trim().length > 0 &&
      this.createPassword().trim().length >= 8 &&
      !this.creating(),
  );

  // ---------- user actions ----------
  lockUser(): void {
    const user = this.selectedUser();
    if (!user) return;
    this.svc.lockUser(user.id, this.lockDuration()).subscribe({
      next: (result) => this.actionMessage.set(result.message),
      error: () => this.actionMessage.set('Lock failed.'),
    });
  }

  unlockUser(): void {
    const user = this.selectedUser();
    if (!user) return;
    this.svc.unlockUser(user.id).subscribe({
      next: (result) => this.actionMessage.set(result.message),
      error: () => this.actionMessage.set('Unlock failed.'),
    });
  }

  suspendUser(): void {
    const user = this.selectedUser();
    if (!user || !this.suspendReason().trim()) return;
    this.svc.suspendUser(user.id, this.suspendReason().trim()).subscribe({
      next: (result) => {
        this.actionMessage.set(result.message);
        this.suspendReason.set('');
      },
      error: () => this.actionMessage.set('Suspend failed.'),
    });
  }

  reactivateUser(): void {
    const user = this.selectedUser();
    if (!user) return;
    this.svc.reactivateUser(user.id).subscribe({
      next: (result) => this.actionMessage.set(result.message),
      error: () => this.actionMessage.set('Reactivation failed.'),
    });
  }

  resetPassword(): void {
    const user = this.selectedUser();
    if (!user) return;
    this.svc.resetPassword(user.id).subscribe({
      next: (result) => this.actionMessage.set(result.message),
      error: () => this.actionMessage.set('Password reset failed.'),
    });
  }

  revokeAllTokens(): void {
    const user = this.selectedUser();
    if (!user) return;
    this.svc.revokeAllUserTokens(user.id).subscribe({
      next: () => this.actionMessage.set('All tokens revoked.'),
      error: () => this.actionMessage.set('Token revocation failed.'),
    });
  }

  deleteUser(): void {
    const user = this.selectedUser();
    if (!user) return;
    if (!confirm(`Delete user ${user.displayName}? This action cannot be undone.`)) return;

    this.svc.deleteUser(user.id).subscribe({
      next: () => this.actionMessage.set('User deleted.'),
      error: () => this.actionMessage.set('Delete failed.'),
    });
  }

  // ---------- create user ----------
  toggleCreateForm(): void {
    this.showCreateForm.update((v) => !v);
    this.clearCreateForm();
  }

  submitCreateUser(): void {
    if (!this.canCreateUser()) return;
    this.creating.set(true);

    const data: UserCreateRequest = {
      email: this.createEmail().trim(),
      displayName: this.createDisplayName().trim(),
      role: this.createRole(),
      password: this.createPassword(),
      sendVerificationEmail: this.createSendVerification(),
    };

    this.svc.createUser(data).subscribe({
      next: (user) => {
        this.actionMessage.set(`User "${user.displayName}" created.`);
        this.clearCreateForm();
        this.showCreateForm.set(false);
        this.creating.set(false);
      },
      error: () => {
        this.actionMessage.set('User creation failed.');
        this.creating.set(false);
      },
    });
  }

  dismissMessage(): void {
    this.actionMessage.set(null);
  }

  private clearCreateForm(): void {
    this.createEmail.set('');
    this.createDisplayName.set('');
    this.createRole.set('Viewer');
    this.createPassword.set('');
    this.createSendVerification.set(true);
  }
}
