import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  signal,
  computed,
  inject,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

import {
  DriverManagementService,
  DriverSummary,
  DriverDetail,
  DriverStatus,
  ComplianceStatus,
  DriverListFilter,
} from './driver-management.service';

import { DriverGeneralComponent } from './tabs/driver-general.component';
import { DriverComplianceComponent } from './tabs/driver-compliance.component';
import { DriverPayoutsComponent } from './tabs/driver-payouts.component';
import { DriverMarketplaceComponent } from './tabs/driver-marketplace.component';
import { DriverTripsComponent } from './tabs/driver-trips.component';
import { DriverPaymentEventsComponent } from './tabs/driver-payment-events.component';
import { DriverInvoicesComponent } from './tabs/driver-invoices.component';
import { DriverTariffComponent } from './tabs/driver-tariff.component';
import { DriverCreationComponent } from './tabs/driver-creation.component';
import { DriverWalletComponent } from './tabs/driver-wallet.component';
import { DriverKycComponent } from './tabs/driver-kyc.component';
import { DriverVehicleComponent } from './tabs/driver-vehicle.component';

@Component({
  selector: 'app-driver-management',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTabsModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatFormFieldModule,
    MatCheckboxModule,
    MatMenuModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatBadgeModule,
    MatTooltipModule,
    MatPaginatorModule,
    MatSnackBarModule,
    DriverGeneralComponent,
    DriverComplianceComponent,
    DriverPayoutsComponent,
    DriverMarketplaceComponent,
    DriverTripsComponent,
    DriverPaymentEventsComponent,
    DriverInvoicesComponent,
    DriverTariffComponent,
    DriverCreationComponent,
    DriverWalletComponent,
    DriverKycComponent,
    DriverVehicleComponent,
  ],
  templateUrl: './driver-management.page.html',
  styleUrl: './driver-management.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriverManagementPage implements OnInit {
  private readonly svc = inject(DriverManagementService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);

  // ---------- List state ----------
  readonly drivers = signal<DriverSummary[]>([]);
  readonly loading = signal(false);
  readonly totalCount = signal(0);
  readonly page = signal(0);
  readonly pageSize = signal(25);

  // ---------- Filters ----------
  readonly searchTerm = signal('');
  readonly statusFilter = signal<DriverStatus | ''>('');
  readonly complianceFilter = signal<ComplianceStatus | ''>('');
  readonly cityFilter = signal('');
  readonly cities = signal<string[]>([]);

  readonly statuses: DriverStatus[] = ['Active', 'Suspended', 'PendingVerification', 'Inactive', 'Banned'];
  readonly complianceStatuses: ComplianceStatus[] = ['Compliant', 'NonCompliant', 'PendingReview', 'Expired'];

  // ---------- Selection ----------
  readonly selectedIds = signal<Set<string>>(new Set());
  readonly allSelected = computed(() => {
    const ids = this.selectedIds();
    const list = this.drivers();
    return list.length > 0 && list.every(d => ids.has(d.id));
  });
  readonly someSelected = computed(() => {
    const ids = this.selectedIds();
    return ids.size > 0;
  });
  readonly selectedCount = computed(() => this.selectedIds().size);

  // ---------- Detail state ----------
  readonly selectedDriver = signal<DriverDetail | null>(null);
  readonly detailLoading = signal(false);
  readonly activeTabIndex = signal(0);

  // ---------- Bulk action state ----------
  readonly bulkActionLoading = signal(false);

  // ---------- Search debounce ----------
  private readonly searchSubject = new Subject<string>();

  // ---------- Lifecycle ----------

  ngOnInit(): void {
    this.loadCities();
    this.loadDrivers();

    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(term => {
        this.searchTerm.set(term);
        this.page.set(0);
        this.loadDrivers();
      });
  }

  // ---------- Data loading ----------

  loadDrivers(): void {
    this.loading.set(true);
    const filter: DriverListFilter = {
      search: this.searchTerm() || undefined,
      status: this.statusFilter() || undefined,
      complianceStatus: this.complianceFilter() || undefined,
      city: this.cityFilter() || undefined,
      page: this.page() + 1,
      pageSize: this.pageSize(),
    };

    this.svc
      .getDrivers(filter)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.drivers.set(result.items);
          this.totalCount.set(result.totalCount);
          this.loading.set(false);
        },
        error: () => {
          this.snackBar.open('Failed to load drivers', 'Dismiss', { duration: 5000 });
          this.loading.set(false);
        },
      });
  }

  private loadCities(): void {
    this.svc
      .getCities()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: cities => this.cities.set(cities),
      });
  }

  // ---------- Search & Filter ----------

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchSubject.next(value);
  }

  onStatusFilterChange(status: DriverStatus | ''): void {
    this.statusFilter.set(status);
    this.page.set(0);
    this.loadDrivers();
  }

  onComplianceFilterChange(compliance: ComplianceStatus | ''): void {
    this.complianceFilter.set(compliance);
    this.page.set(0);
    this.loadDrivers();
  }

  onCityFilterChange(city: string): void {
    this.cityFilter.set(city);
    this.page.set(0);
    this.loadDrivers();
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.statusFilter.set('');
    this.complianceFilter.set('');
    this.cityFilter.set('');
    this.page.set(0);
    this.loadDrivers();
  }

  readonly hasActiveFilters = computed(() =>
    !!(this.statusFilter() || this.complianceFilter() || this.cityFilter()),
  );

  // ---------- Pagination ----------

  onPageChange(event: PageEvent): void {
    this.page.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadDrivers();
  }

  // ---------- Selection ----------

  toggleSelectAll(): void {
    const currentIds = this.selectedIds();
    const allIds = this.drivers().map(d => d.id);

    if (this.allSelected()) {
      this.selectedIds.set(new Set());
    } else {
      this.selectedIds.set(new Set(allIds));
    }
  }

  toggleSelectDriver(id: string): void {
    const ids = new Set(this.selectedIds());
    if (ids.has(id)) {
      ids.delete(id);
    } else {
      ids.add(id);
    }
    this.selectedIds.set(ids);
  }

  isSelected(id: string): boolean {
    return this.selectedIds().has(id);
  }

  // ---------- Driver detail ----------

  selectDriver(driver: DriverSummary): void {
    this.detailLoading.set(true);
    this.activeTabIndex.set(0);

    this.svc
      .getDriver(driver.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: detail => {
          this.selectedDriver.set(detail);
          this.detailLoading.set(false);
        },
        error: () => {
          this.snackBar.open('Failed to load driver details', 'Dismiss', { duration: 5000 });
          this.detailLoading.set(false);
        },
      });
  }

  closeDetail(): void {
    this.selectedDriver.set(null);
  }

  onTabChange(index: number): void {
    this.activeTabIndex.set(index);
  }

  // ---------- Single driver actions ----------

  activateDriver(id: string): void {
    this.svc
      .activateDriver(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Driver activated', 'OK', { duration: 3000 });
          this.loadDrivers();
          if (this.selectedDriver()?.id === id) {
            this.refreshSelectedDriver(id);
          }
        },
        error: () => this.snackBar.open('Failed to activate driver', 'Dismiss', { duration: 5000 }),
      });
  }

  suspendDriver(id: string): void {
    const reason = prompt('Suspension reason:');
    if (!reason) return;

    this.svc
      .suspendDriver(id, reason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Driver suspended', 'OK', { duration: 3000 });
          this.loadDrivers();
          if (this.selectedDriver()?.id === id) {
            this.refreshSelectedDriver(id);
          }
        },
        error: () => this.snackBar.open('Failed to suspend driver', 'Dismiss', { duration: 5000 }),
      });
  }

  verifyDriver(id: string): void {
    this.svc
      .verifyDriver(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Driver verified', 'OK', { duration: 3000 });
          this.loadDrivers();
          if (this.selectedDriver()?.id === id) {
            this.refreshSelectedDriver(id);
          }
        },
        error: () => this.snackBar.open('Failed to verify driver', 'Dismiss', { duration: 5000 }),
      });
  }

  approveKyc(id: string): void {
    this.svc
      .approveKyc(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('KYC approved', 'OK', { duration: 3000 });
          if (this.selectedDriver()?.id === id) {
            this.refreshSelectedDriver(id);
          }
        },
        error: () => this.snackBar.open('Failed to approve KYC', 'Dismiss', { duration: 5000 }),
      });
  }

  private refreshSelectedDriver(id: string): void {
    this.svc
      .getDriver(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: detail => this.selectedDriver.set(detail),
      });
  }

  // ---------- Bulk actions ----------

  bulkActivate(): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    this.bulkActionLoading.set(true);
    this.svc
      .bulkActivate(ids)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.bulkActionLoading.set(false);
          this.selectedIds.set(new Set());
          this.snackBar.open(
            `Activated ${result.succeeded.length} drivers. ${result.failed.length} failed.`,
            'OK',
            { duration: 5000 },
          );
          this.loadDrivers();
        },
        error: () => {
          this.bulkActionLoading.set(false);
          this.snackBar.open('Bulk activate failed', 'Dismiss', { duration: 5000 });
        },
      });
  }

  bulkSuspend(): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    const reason = prompt('Suspension reason for all selected drivers:');
    if (!reason) return;

    this.bulkActionLoading.set(true);
    this.svc
      .bulkSuspend(ids, reason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this.bulkActionLoading.set(false);
          this.selectedIds.set(new Set());
          this.snackBar.open(
            `Suspended ${result.succeeded.length} drivers. ${result.failed.length} failed.`,
            'OK',
            { duration: 5000 },
          );
          this.loadDrivers();
        },
        error: () => {
          this.bulkActionLoading.set(false);
          this.snackBar.open('Bulk suspend failed', 'Dismiss', { duration: 5000 });
        },
      });
  }

  // ---------- Template helpers ----------

  statusClass(status: DriverStatus): string {
    switch (status) {
      case 'Active': return 'status-active';
      case 'Suspended': return 'status-suspended';
      case 'PendingVerification': return 'status-pending';
      case 'Inactive': return 'status-inactive';
      case 'Banned': return 'status-banned';
      default: return '';
    }
  }

  complianceClass(status: ComplianceStatus): string {
    switch (status) {
      case 'Compliant': return 'compliance-ok';
      case 'NonCompliant': return 'compliance-fail';
      case 'PendingReview': return 'compliance-pending';
      case 'Expired': return 'compliance-expired';
      default: return '';
    }
  }

  trackByDriverId(_: number, driver: DriverSummary): string {
    return driver.id;
  }
}
