import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  AuthManagementService,
  AuthUser,
  UserRole,
  UserStatus,
} from '../auth-management.service';

@Component({
  selector: 'app-user-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-list.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserListComponent implements OnInit {
  private readonly svc = inject(AuthManagementService);

  readonly users = this.svc.filteredUsers;
  readonly loading = this.svc.loading;
  readonly filterRole = this.svc.filterRole;
  readonly filterStatus = this.svc.filterStatus;
  readonly searchQuery = this.svc.searchQuery;
  readonly totalUsers = this.svc.totalUsers;

  readonly userSelected = output<AuthUser>();

  readonly roleOptions: UserRole[] = ['Admin', 'Operator', 'Viewer', 'Driver', 'Rider'];
  readonly statusOptions: UserStatus[] = ['Active', 'Locked', 'Suspended', 'Deleted'];

  ngOnInit(): void {
    this.svc.loadUsers();
  }

  onSearchChange(query: string): void {
    this.svc.setSearchQuery(query);
  }

  onRoleChange(role: string): void {
    this.svc.setRoleFilter((role as UserRole) || null);
  }

  onStatusChange(status: string): void {
    this.svc.setStatusFilter((status as UserStatus) || null);
  }

  selectUser(user: AuthUser): void {
    this.svc.selectUser(user);
    this.userSelected.emit(user);
  }

  roleClass(role: UserRole): string {
    switch (role) {
      case 'Admin':
        return 'role-admin';
      case 'Operator':
        return 'role-operator';
      case 'Viewer':
        return 'role-viewer';
      case 'Driver':
        return 'role-driver';
      case 'Rider':
        return 'role-rider';
      default:
        return '';
    }
  }

  statusClass(status: UserStatus): string {
    switch (status) {
      case 'Active':
        return 'status-active';
      case 'Locked':
        return 'status-locked';
      case 'Suspended':
        return 'status-suspended';
      case 'Deleted':
        return 'status-deleted';
      default:
        return '';
    }
  }

  trackByUserId(_: number, user: AuthUser): string {
    return user.id;
  }
}
