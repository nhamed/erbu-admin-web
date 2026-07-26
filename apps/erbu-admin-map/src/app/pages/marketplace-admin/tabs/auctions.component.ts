import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatMenuModule } from '@angular/material/menu';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AuctionBid, BidStatus } from '@erbu-admin-web/shared/models';
import {
  MarketplaceService,
  ActiveAuction,
  AuctionStatus,
} from '../marketplace.service';

const AUTO_REFRESH_MS = 10_000;

@Component({
  selector: 'app-auctions-tab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatPaginatorModule,
    MatMenuModule,
    MatExpansionModule,
    MatSnackBarModule,
  ],
  templateUrl: './auctions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuctionsComponent implements OnInit, OnDestroy {
  readonly svc = inject(MarketplaceService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  // ── Filter / paging ──────────────────────────────────────────
  readonly page = signal(0);
  readonly pageSize = signal(25);
  readonly statusFilter = signal<AuctionStatus | ''>('');

  readonly statusOptions: AuctionStatus[] = ['Open', 'Closed', 'Awarded', 'Expired', 'Cancelled'];

  // ── Expanded auction for bid tracking ────────────────────────
  readonly expandedAuctionId = signal<string | null>(null);
  readonly expandedBids = signal<AuctionBid[]>([]);
  readonly bidsLoading = signal(false);

  // ── Table config ─────────────────────────────────────────────
  readonly displayedColumns: string[] = [
    'riderName',
    'pickupAddress',
    'dropoffAddress',
    'estimatedFare',
    'bidCount',
    'lowestBid',
    'status',
    'expiresAt',
    'actions',
  ];

  readonly bidColumns: string[] = [
    'driverName',
    'bidAmount',
    'estimatedArrivalMinutes',
    'driverRating',
    'vehicleType',
    'bidStatus',
    'submittedAt',
    'bidActions',
  ];

  // ── Lifecycle ────────────────────────────────────────────────
  ngOnInit(): void {
    this.loadData();
    this.refreshTimer = setInterval(() => this.loadData(), AUTO_REFRESH_MS);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // ── Data loading ─────────────────────────────────────────────
  loadData(): void {
    this.svc.loadAuctions(
      this.page() + 1,
      this.pageSize(),
      this.statusFilter() || undefined,
    );
  }

  // ── Filter / page events ─────────────────────────────────────
  onStatusFilterChange(status: AuctionStatus | ''): void {
    this.statusFilter.set(status);
    this.page.set(0);
    this.loadData();
  }

  onPageChange(event: PageEvent): void {
    this.page.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadData();
  }

  // ── Bid expansion ────────────────────────────────────────────
  toggleBids(auction: ActiveAuction): void {
    if (this.expandedAuctionId() === auction.id) {
      this.expandedAuctionId.set(null);
      this.expandedBids.set([]);
      return;
    }

    this.expandedAuctionId.set(auction.id);
    this.bidsLoading.set(true);

    this.svc
      .getAuctionBids(auction.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: bids => {
          this.expandedBids.set(bids);
          this.bidsLoading.set(false);
        },
        error: () => {
          this.bidsLoading.set(false);
          this.snackBar.open('Failed to load bids', 'Dismiss', { duration: 5000 });
        },
      });
  }

  // ── Actions ──────────────────────────────────────────────────
  cancelAuction(auction: ActiveAuction): void {
    const reason = prompt('Cancellation reason:');
    if (!reason) return;

    this.svc
      .cancelAuction(auction.id, reason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Auction cancelled', 'OK', { duration: 3000 });
          this.loadData();
        },
        error: () =>
          this.snackBar.open('Failed to cancel auction', 'Dismiss', { duration: 5000 }),
      });
  }

  awardBid(auctionId: string, bidId: string): void {
    this.svc
      .awardAuction(auctionId, bidId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.snackBar.open('Auction awarded', 'OK', { duration: 3000 });
          this.expandedAuctionId.set(null);
          this.loadData();
        },
        error: () =>
          this.snackBar.open('Failed to award auction', 'Dismiss', { duration: 5000 }),
      });
  }

  // ── Helpers ──────────────────────────────────────────────────
  auctionStatusClass(status: AuctionStatus): string {
    switch (status) {
      case 'Open':
        return 'status-active';
      case 'Awarded':
        return 'status-completed';
      case 'Closed':
        return 'status-confirmed';
      case 'Expired':
        return 'status-noshow';
      case 'Cancelled':
        return 'status-cancelled';
      default:
        return '';
    }
  }

  bidStatusClass(status: BidStatus): string {
    switch (status) {
      case BidStatus.Pending:
        return 'status-pending';
      case BidStatus.Accepted:
        return 'status-completed';
      case BidStatus.Rejected:
        return 'status-cancelled';
      case BidStatus.Expired:
        return 'status-noshow';
      case BidStatus.Withdrawn:
        return 'status-cancelled';
      case BidStatus.Outbid:
        return 'status-pending';
      default:
        return '';
    }
  }

  isOpen(auction: ActiveAuction): boolean {
    return auction.status === 'Open';
  }

  trackByAuctionId(_: number, auction: ActiveAuction): string {
    return auction.id;
  }

  trackByBidId(_: number, bid: AuctionBid): string {
    return bid.id;
  }
}
