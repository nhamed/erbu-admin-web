import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatTabsModule } from '@angular/material/tabs';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

import {
  MarketplaceService,
  DriverProfile,
  AuditAlert,
  AuditAlertSeverity,
} from './marketplace.service';
import { DriverNetworkComponent } from './tabs/driver-network.component';
import { ReservationsComponent } from './tabs/reservations.component';
import { DemandLiquidityComponent } from './tabs/demand-liquidity.component';
import { AuctionsComponent } from './tabs/auctions.component';
import { AlarmEngineComponent } from './tabs/alarm-engine.component';

@Component({
  selector: 'app-marketplace-admin',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTabsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatBadgeModule,
    MatTooltipModule,
    MatTableModule,
    MatPaginatorModule,
    MatMenuModule,
    MatSnackBarModule,
    DriverNetworkComponent,
    ReservationsComponent,
    DemandLiquidityComponent,
    AuctionsComponent,
    AlarmEngineComponent,
  ],
  templateUrl: './marketplace-admin.page.html',
  styleUrl: './marketplace-admin.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketplaceAdminPage implements OnInit {
  readonly svc = inject(MarketplaceService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);

  // ── Tab state ────────────────────────────────────────────────
  readonly activeTabIndex = signal(0);

  // ═══════════════════════════════════════════════════════════════
  //  DRIVER PROFILE (inline tab)
  // ═══════════════════════════════════════════════════════════════

  readonly driverSearchQuery = signal('');
  readonly driverProfiles = signal<DriverProfile[]>([]);
  readonly selectedProfile = signal<DriverProfile | null>(null);
  readonly profileLoading = signal(false);

  private readonly searchSubject = new Subject<string>();

  readonly profileDisplayedColumns: string[] = [
    'driverName',
    'email',
    'vehicleType',
    'rating',
    'totalTrips',
    'acceptanceRate',
    'earningsToday',
    'status',
  ];

  // ═══════════════════════════════════════════════════════════════
  //  AUDIT ALERTS (inline tab)
  // ═══════════════════════════════════════════════════════════════

  readonly auditSeverityFilter = signal<AuditAlertSeverity | ''>('');
  readonly auditPage = signal(0);
  readonly auditPageSize = signal(25);

  readonly severityOptions: AuditAlertSeverity[] = ['Low', 'Medium', 'High', 'Critical'];

  readonly auditDisplayedColumns: string[] = [
    'severity',
    'type',
    'message',
    'source',
    'createdAt',
    'isResolved',
    'actions',
  ];

  // ── Lifecycle ────────────────────────────────────────────────
  ngOnInit(): void {
    this.searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(query => {
        this.driverSearchQuery.set(query);
        if (query.length >= 2) {
          this.searchDrivers(query);
        }
      });
  }

  // ── Tab change ───────────────────────────────────────────────
  onTabChange(index: number): void {
    this.activeTabIndex.set(index);

    // Lazy-load tab data on first visit
    switch (index) {
      case 4: // AuditAlerts
        if (this.svc.auditAlerts().length === 0) {
          this.loadAuditAlerts();
        }
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  //  DRIVER PROFILE METHODS
  // ═══════════════════════════════════════════════════════════════

  onDriverSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchSubject.next(value);
  }

  private searchDrivers(query: string): void {
    this.profileLoading.set(true);
    this.svc
      .searchDriverProfiles(query)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: profiles => {
          this.driverProfiles.set(profiles);
          this.profileLoading.set(false);
        },
        error: () => {
          this.profileLoading.set(false);
          this.snackBar.open('Failed to search drivers', 'Dismiss', { duration: 5000 });
        },
      });
  }

  selectProfile(profile: DriverProfile): void {
    this.selectedProfile.set(profile);
  }

  closeProfile(): void {
    this.selectedProfile.set(null);
  }

  // ═══════════════════════════════════════════════════════════════
  //  AUDIT ALERTS METHODS
  // ═══════════════════════════════════════════════════════════════

  loadAuditAlerts(): void {
    this.svc.loadAuditAlerts(
      this.auditPage() + 1,
      this.auditPageSize(),
      this.auditSeverityFilter() || undefined,
    );
  }

  onAuditSeverityChange(severity: AuditAlertSeverity | ''): void {
    this.auditSeverityFilter.set(severity);
    this.auditPage.set(0);
    this.loadAuditAlerts();
  }

  onAuditPageChange(event: PageEvent): void {
    this.auditPage.set(event.pageIndex);
    this.auditPageSize.set(event.pageSize);
    this.loadAuditAlerts();
  }

  acknowledgeAlert(alert: AuditAlert): void {
    this.svc
      .acknowledgeAlert(alert.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.snackBar.open('Alert acknowledged', 'OK', { duration: 3000 }),
        error: () =>
          this.snackBar.open('Failed to acknowledge alert', 'Dismiss', { duration: 5000 }),
      });
  }

  // ── Helpers ──────────────────────────────────────────────────
  alertSeverityClass(severity: AuditAlertSeverity): string {
    switch (severity) {
      case 'Low':
        return 'severity-info';
      case 'Medium':
        return 'severity-warning';
      case 'High':
        return 'severity-error';
      case 'Critical':
        return 'severity-critical';
      default:
        return '';
    }
  }

  alertSeverityIcon(severity: AuditAlertSeverity): string {
    switch (severity) {
      case 'Low':
        return 'info';
      case 'Medium':
        return 'warning';
      case 'High':
        return 'error';
      case 'Critical':
        return 'crisis_alert';
      default:
        return 'help';
    }
  }

  trackByAlertId(_: number, alert: AuditAlert): string {
    return alert.id;
  }

  trackByProfileId(_: number, profile: DriverProfile): string {
    return profile.driverId;
  }
}
