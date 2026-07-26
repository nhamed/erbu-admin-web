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
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';

import {
  RiderManagementService,
  Rider,
  RiderDetail,
  RiderStatus,
  MarketplaceRider,
  MarketplaceStatus,
} from './rider-management.service';

@Component({
  selector: 'app-rider-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTabsModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    MatBadgeModule,
  ],
  templateUrl: './rider-management.page.html',
  styleUrl: './rider-management.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RiderManagementPage implements OnInit {
  protected readonly svc = inject(RiderManagementService);

  // ---- Local UI state ----
  readonly searchTerm = signal('');
  readonly statusFilter = signal<RiderStatus | ''>('');
  readonly marketplaceStatusFilter = signal<MarketplaceStatus | ''>('');
  readonly activeTab = signal<'riders' | 'marketplace'>('riders');
  readonly currentPage = signal(1);
  readonly pageSize = signal(25);
  readonly marketplacePage = signal(1);

  // ---- Rider table columns ----
  readonly riderColumns: string[] = [
    'fullName',
    'email',
    'phone',
    'status',
    'rating',
    'totalTrips',
    'lastActiveAt',
    'actions',
  ];

  // ---- Marketplace table columns ----
  readonly marketplaceColumns: string[] = [
    'fullName',
    'marketplaceStatus',
    'waitingMinutes',
    'surgeMultiplier',
    'nearbyDrivers',
    'lastRequestedAt',
  ];

  // ---- Status options ----
  readonly riderStatuses: RiderStatus[] = ['Active', 'Inactive', 'Suspended', 'PendingVerification'];
  readonly marketplaceStatuses: MarketplaceStatus[] = ['Available', 'OnTrip', 'Offline', 'Idle'];

  // ---- Computed KPIs ----
  readonly kpiCards = computed(() => [
    {
      label: 'Total Riders',
      value: this.svc.totalCount(),
      icon: 'people',
      variant: 'neutral',
    },
    {
      label: 'Active',
      value: this.svc.activeCount(),
      icon: 'check_circle',
      variant: 'success',
    },
    {
      label: 'Suspended',
      value: this.svc.suspendedCount(),
      icon: 'block',
      variant: 'danger',
    },
    {
      label: 'Pending Verification',
      value: this.svc.pendingCount(),
      icon: 'pending',
      variant: 'warning',
    },
  ]);

  // ---- Lifecycle ----
  ngOnInit(): void {
    this.loadRiders();
  }

  // ---- Actions ----
  onSearch(): void {
    this.currentPage.set(1);
    this.loadRiders();
  }

  onStatusFilterChange(status: RiderStatus | ''): void {
    this.statusFilter.set(status);
    this.currentPage.set(1);
    this.loadRiders();
  }

  onMarketplaceFilterChange(status: MarketplaceStatus | ''): void {
    this.marketplaceStatusFilter.set(status);
    this.marketplacePage.set(1);
    this.loadMarketplace();
  }

  onTabChange(index: number): void {
    this.activeTab.set(index === 0 ? 'riders' : 'marketplace');
    if (index === 1 && this.svc.marketplaceRiders().length === 0) {
      this.loadMarketplace();
    }
  }

  onSelectRider(rider: Rider): void {
    this.svc.loadRiderDetail(rider.id);
  }

  onCloseDetail(): void {
    this.svc.clearSelection();
  }

  onSuspendRider(rider: Rider): void {
    this.svc.suspendRider(rider.id, 'Administrative suspension').subscribe();
  }

  onReactivateRider(rider: Rider): void {
    this.svc.reactivateRider(rider.id).subscribe();
  }

  onUpdateStatus(rider: Rider, status: RiderStatus): void {
    this.svc.updateRiderStatus(rider.id, status).subscribe();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadRiders();
  }

  // ---- Helpers ----
  statusClass(status: RiderStatus): string {
    switch (status) {
      case 'Active':
        return 'status-active';
      case 'Inactive':
        return 'status-inactive';
      case 'Suspended':
        return 'status-suspended';
      case 'PendingVerification':
        return 'status-pending';
      default:
        return '';
    }
  }

  marketplaceStatusClass(status: MarketplaceStatus): string {
    switch (status) {
      case 'Available':
        return 'mp-available';
      case 'OnTrip':
        return 'mp-ontrip';
      case 'Offline':
        return 'mp-offline';
      case 'Idle':
        return 'mp-idle';
      default:
        return '';
    }
  }

  trackByRiderId(_: number, rider: Rider): string {
    return rider.id;
  }

  trackByMarketplaceRiderId(_: number, rider: MarketplaceRider): string {
    return rider.riderId;
  }

  // ---- Private ----
  private loadRiders(): void {
    const status = this.statusFilter();
    this.svc.loadRiders(
      this.currentPage(),
      this.pageSize(),
      this.searchTerm() || undefined,
      status || undefined,
    );
  }

  private loadMarketplace(): void {
    const status = this.marketplaceStatusFilter();
    this.svc.loadMarketplace(
      this.marketplacePage(),
      this.pageSize(),
      status || undefined,
    );
  }
}
