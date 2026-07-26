import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  TripManagementService,
  TripListItem,
  TripMgmtStatus,
  TripFilters,
  TripDetail,
  TripReplayData,
  TripReplayFrame,
  TripStats,
  TripTimelineEvent,
} from './trip-management.service';

type ActiveView = 'list' | 'detail' | 'replay';

@Component({
  selector: 'app-trip-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './trip-management.page.html',
  styleUrl: './trip-management.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TripManagementPage implements OnInit, OnDestroy {
  private readonly svc = inject(TripManagementService);
  private readonly destroyRef = inject(DestroyRef);

  // ---------- signals ----------
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly activeView = signal<ActiveView>('list');

  // Trip list
  readonly trips = signal<TripListItem[]>([]);
  readonly totalCount = signal(0);
  readonly currentPage = signal(1);
  readonly pageSize = signal(25);
  readonly totalPages = signal(0);
  readonly filterStatus = signal<TripMgmtStatus | ''>('');
  readonly filterDateFrom = signal('');
  readonly filterDateTo = signal('');
  readonly searchQuery = signal('');

  // Trip detail
  readonly selectedTrip = signal<TripDetail | null>(null);
  readonly detailLoading = signal(false);

  // Trip replay
  readonly replayData = signal<TripReplayData | null>(null);
  readonly replayLoading = signal(false);
  readonly replayPlaying = signal(false);
  readonly replaySpeed = signal(1);
  readonly replayCurrentFrame = signal(0);
  readonly replayPaused = signal(false);

  // Trip stats
  readonly stats = signal<TripStats | null>(null);
  readonly showStats = signal(false);

  // Cancel dialog
  readonly cancelDialog = signal<TripListItem | null>(null);
  readonly cancelReason = signal('');
  readonly cancelling = signal(false);

  // ---------- computed ----------
  readonly currentFrameData = computed<TripReplayFrame | null>(() => {
    const data = this.replayData();
    const index = this.replayCurrentFrame();
    if (!data || index < 0 || index >= data.frames.length) return null;
    return data.frames[index];
  });

  readonly replayProgress = computed(() => {
    const data = this.replayData();
    const index = this.replayCurrentFrame();
    if (!data || data.totalFrames === 0) return 0;
    return (index / (data.totalFrames - 1)) * 100;
  });

  readonly replayElapsed = computed(() => {
    const frame = this.currentFrameData();
    return frame ? this.formatSeconds(frame.elapsedSeconds) : '00:00';
  });

  readonly replayTotal = computed(() => {
    const data = this.replayData();
    return data ? this.formatSeconds(data.totalDurationSeconds) : '00:00';
  });

  readonly tripStatusOptions: Array<{ value: TripMgmtStatus | ''; label: string }> = [
    { value: '', label: 'All Statuses' },
    { value: 'requested', label: 'Requested' },
    { value: 'searching', label: 'Searching' },
    { value: 'driver-assigned', label: 'Driver Assigned' },
    { value: 'driver-en-route', label: 'Driver En Route' },
    { value: 'driver-arrived', label: 'Driver Arrived' },
    { value: 'in-progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled-rider', label: 'Cancelled (Rider)' },
    { value: 'cancelled-driver', label: 'Cancelled (Driver)' },
    { value: 'cancelled-system', label: 'Cancelled (System)' },
    { value: 'disputed', label: 'Disputed' },
    { value: 'no-driver-found', label: 'No Driver Found' },
  ];

  readonly speedOptions = [0.5, 1, 2, 5, 10];

  // Replay timer
  private replayTimer: ReturnType<typeof setInterval> | null = null;

  // ---------- lifecycle ----------
  ngOnInit(): void {
    this.loadTrips();
  }

  ngOnDestroy(): void {
    this.stopReplayTimer();
  }

  // ---------- data loading ----------
  private buildFilters(): TripFilters {
    return {
      status: this.filterStatus() || undefined,
      dateFrom: this.filterDateFrom() || undefined,
      dateTo: this.filterDateTo() || undefined,
      search: this.searchQuery() || undefined,
      page: this.currentPage(),
      pageSize: this.pageSize(),
    };
  }

  loadTrips(): void {
    this.loading.set(true);
    this.svc
      .fetchTrips(this.buildFilters())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.trips.set(response.items);
          this.totalCount.set(response.totalCount);
          this.totalPages.set(response.totalPages);
          this.loading.set(false);
          this.error.set(null);
        },
        error: (err) => {
          this.error.set(err?.message ?? 'Failed to load trips');
          this.loading.set(false);
        },
      });
  }

  // ---------- filtering ----------
  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  onFilterStatusChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.filterStatus.set(select.value as TripMgmtStatus | '');
    this.currentPage.set(1);
    this.loadTrips();
  }

  onDateFromChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.filterDateFrom.set(input.value);
  }

  onDateToChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.filterDateTo.set(input.value);
  }

  applyFilters(): void {
    this.currentPage.set(1);
    this.loadTrips();
  }

  clearFilters(): void {
    this.filterStatus.set('');
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
    this.searchQuery.set('');
    this.currentPage.set(1);
    this.loadTrips();
  }

  // ---------- pagination ----------
  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadTrips();
  }

  get paginationPages(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  // ---------- trip detail ----------
  openTripDetail(trip: TripListItem): void {
    this.detailLoading.set(true);
    this.activeView.set('detail');
    this.svc
      .fetchTripDetail(trip.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          this.selectedTrip.set(detail);
          this.detailLoading.set(false);
        },
        error: (err) => {
          this.error.set(err?.message ?? 'Failed to load trip detail');
          this.detailLoading.set(false);
        },
      });
  }

  backToList(): void {
    this.activeView.set('list');
    this.selectedTrip.set(null);
    this.stopReplay();
  }

  // ---------- trip replay ----------
  openReplay(tripId: string): void {
    this.replayLoading.set(true);
    this.activeView.set('replay');
    this.replayCurrentFrame.set(0);
    this.replayPlaying.set(false);
    this.replayPaused.set(false);

    this.svc
      .fetchTripReplay(tripId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.replayData.set(data);
          this.replayLoading.set(false);
        },
        error: (err) => {
          this.error.set(err?.message ?? 'Failed to load trip replay');
          this.replayLoading.set(false);
        },
      });
  }

  playReplay(): void {
    const data = this.replayData();
    if (!data || data.frames.length === 0) return;

    this.replayPlaying.set(true);
    this.replayPaused.set(false);

    if (this.replayCurrentFrame() >= data.totalFrames - 1) {
      this.replayCurrentFrame.set(0);
    }

    this.startReplayTimer();
  }

  pauseReplay(): void {
    this.replayPaused.set(true);
    this.stopReplayTimer();
  }

  resumeReplay(): void {
    this.replayPaused.set(false);
    this.startReplayTimer();
  }

  stopReplay(): void {
    this.replayPlaying.set(false);
    this.replayPaused.set(false);
    this.replayCurrentFrame.set(0);
    this.stopReplayTimer();
  }

  setReplaySpeed(speed: number): void {
    this.replaySpeed.set(speed);
    if (this.replayPlaying() && !this.replayPaused()) {
      this.stopReplayTimer();
      this.startReplayTimer();
    }
  }

  seekReplay(event: Event): void {
    const input = event.target as HTMLInputElement;
    const frame = parseInt(input.value, 10);
    this.replayCurrentFrame.set(frame);
  }

  private startReplayTimer(): void {
    this.stopReplayTimer();
    const intervalMs = Math.max(50, 1000 / this.replaySpeed());
    this.replayTimer = setInterval(() => {
      const data = this.replayData();
      const current = this.replayCurrentFrame();
      if (!data || current >= data.totalFrames - 1) {
        this.replayPlaying.set(false);
        this.stopReplayTimer();
        return;
      }
      this.replayCurrentFrame.set(current + 1);
    }, intervalMs);
  }

  private stopReplayTimer(): void {
    if (this.replayTimer) {
      clearInterval(this.replayTimer);
      this.replayTimer = null;
    }
  }

  // ---------- trip stats ----------
  toggleStats(): void {
    const show = !this.showStats();
    this.showStats.set(show);
    if (show && !this.stats()) {
      this.loadStats();
    }
  }

  private loadStats(): void {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400 * 1000);
    this.svc
      .fetchTripStats(
        thirtyDaysAgo.toISOString().split('T')[0],
        now.toISOString().split('T')[0],
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (stats) => this.stats.set(stats),
        error: () => {},
      });
  }

  // ---------- cancel trip ----------
  openCancelDialog(trip: TripListItem): void {
    this.cancelDialog.set(trip);
    this.cancelReason.set('');
  }

  closeCancelDialog(): void {
    this.cancelDialog.set(null);
    this.cancelReason.set('');
  }

  onCancelReasonChange(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    this.cancelReason.set(input.value);
  }

  confirmCancelTrip(): void {
    const trip = this.cancelDialog();
    const reason = this.cancelReason().trim();
    if (!trip || !reason) return;

    this.cancelling.set(true);
    this.svc
      .cancelTrip(trip.id, reason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.cancelling.set(false);
          this.cancelDialog.set(null);
          this.cancelReason.set('');
          this.loadTrips();
        },
        error: (err) => {
          this.error.set(err?.message ?? 'Failed to cancel trip');
          this.cancelling.set(false);
        },
      });
  }

  // ---------- export ----------
  exportTrips(): void {
    this.svc
      .exportTrips(this.buildFilters())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `trips-export-${new Date().toISOString().split('T')[0]}.csv`;
          a.click();
          URL.revokeObjectURL(url);
        },
        error: (err) => {
          this.error.set(err?.message ?? 'Export failed');
        },
      });
  }

  // ---------- template helpers ----------
  statusClass(status: TripMgmtStatus): string {
    switch (status) {
      case 'completed':
        return 'trip-completed';
      case 'in-progress':
      case 'driver-en-route':
      case 'driver-arrived':
        return 'trip-active';
      case 'requested':
      case 'searching':
      case 'driver-assigned':
        return 'trip-pending';
      case 'cancelled-rider':
      case 'cancelled-driver':
      case 'cancelled-system':
        return 'trip-cancelled';
      case 'disputed':
      case 'no-driver-found':
        return 'trip-failed';
      default:
        return '';
    }
  }

  statusLabel(status: TripMgmtStatus): string {
    const map: Record<TripMgmtStatus, string> = {
      requested: 'Requested',
      searching: 'Searching',
      'driver-assigned': 'Assigned',
      'driver-en-route': 'En Route',
      'driver-arrived': 'Arrived',
      'in-progress': 'In Progress',
      completed: 'Completed',
      'cancelled-rider': 'Cancelled',
      'cancelled-driver': 'Cancelled',
      'cancelled-system': 'Cancelled',
      disputed: 'Disputed',
      'no-driver-found': 'No Driver',
    };
    return map[status] ?? status;
  }

  formatSeconds(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  formatCurrency(amount: number, currency: string): string {
    return amount.toFixed(2) + ' ' + currency;
  }

  trackByTripId(_: number, trip: TripListItem): string {
    return trip.id;
  }

  trackByEventIndex(index: number): number {
    return index;
  }

  trackByFrameIndex(index: number): number {
    return index;
  }
}
