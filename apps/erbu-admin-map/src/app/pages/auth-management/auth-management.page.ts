import {
  Component,
  ChangeDetectionStrategy,
  signal,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';

import { AuthManagementService, AuthUser } from './auth-management.service';
import { UserListComponent } from './tabs/user-list.component';
import { UserActionsComponent } from './tabs/user-actions.component';
import { BansManagementComponent } from './tabs/bans-management.component';
import { DiagnosticsComponent } from './tabs/diagnostics.component';

type TabId = 'users' | 'actions' | 'bans' | 'diagnostics';

interface TabDef {
  id: TabId;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-auth-management',
  standalone: true,
  imports: [
    CommonModule,
    UserListComponent,
    UserActionsComponent,
    BansManagementComponent,
    DiagnosticsComponent,
  ],
  templateUrl: './auth-management.page.html',
  styleUrl: './auth-management.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthManagementPage {
  private readonly svc = inject(AuthManagementService);

  readonly error = this.svc.error;
  readonly activeTab = signal<TabId>('users');

  readonly tabs: TabDef[] = [
    { id: 'users', label: 'User List', icon: 'people' },
    { id: 'actions', label: 'User Actions', icon: 'settings' },
    { id: 'bans', label: 'Bans', icon: 'block' },
    { id: 'diagnostics', label: 'Diagnostics', icon: 'monitor_heart' },
  ];

  switchTab(tabId: TabId): void {
    this.activeTab.set(tabId);
  }

  onUserSelected(user: AuthUser): void {
    this.svc.selectUser(user);
    this.activeTab.set('actions');
  }

  clearError(): void {
    this.svc.clearError();
  }
}
