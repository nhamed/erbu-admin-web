import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  ElementRef,
  viewChild,
  OnDestroy,
  AfterViewInit,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { inject } from '@angular/core';
import { Subject, debounceTime, switchMap, takeUntil, EMPTY } from 'rxjs';
import { Trip, TripWaypoint } from '@erbu-admin-web/shared/models';
import { ReplayDiffService, DiffReport, DiffSegment } from './replay-diff.service';

// ─── Color constants for canvas rendering ───────────
const SEVERITY_COLORS: Record<string, string> = {
  match: '#2dc653',
  minor: '#ffc107',
  significant: '#fd7e14',
  mismatch: '#e63946',
};

@Component({
  selector: 'erbu-replay-diff-tab',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './replay-diff-tab.page.html',
  styleUrl: './replay-diff-tab.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReplayDiffTabPage implements AfterViewInit, OnDestroy {
  private readonly diffService = inject(ReplayDiffService);
  private readonly destroy$ = new Subject<void>();

  // ─── Canvas ref ─────────────────────────────────────
  readonly diffCanvas = viewChild<ElementRef<HTMLCanvasElement>>('diffCanvas');

  // ─── Trip selection state ───────────────────────────
  readonly baselineQuery = signal('');
  readonly comparisonQuery = signal('');
  readonly baselineResults = signal<Trip[]>([]);
  readonly comparisonResults = signal<Trip[]>([]);
  readonly baselineDropdownOpen = signal(false);
  readonly comparisonDropdownOpen = signal(false);
  readonly baselineTrip = signal<Trip | null>(null);
  readonly comparisonTrip = signal<Trip | null>(null);
  readonly sameTrip = signal(false);

  // ─── Diff result state ──────────────────────────────
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly diffReport = signal<DiffReport | null>(null);
  readonly exporting = signal(false);

  // ─── Timeline / playback state ──────────────────────
  readonly scrubberPosition = signal(0);
  readonly playing = signal(false);
  readonly playbackSpeed = signal(1);
  private playbackTimer: ReturnType<typeof setInterval> | null = null;

  // ─── Search subjects for debounce ───────────────────
  private readonly baselineSearch$ = new Subject<string>();
  private readonly comparisonSearch$ = new Subject<string>();

  // ─── Computed helpers ───────────────────────────────
  readonly canCompare = computed(
    () => this.baselineTrip() !== null && this.comparisonTrip() !== null && !this.loading(),
  );

  readonly baselineWaypoints = computed<TripWaypoint[]>(() => {
    const report = this.diffReport();
    return report?.baselineReplay.waypoints ?? [];
  });

  readonly comparisonWaypoints = computed<TripWaypoint[]>(() => {
    const report = this.diffReport();
    return report?.comparisonReplay.waypoints ?? [];
  });

  readonly maxScrubberValue = computed(() => {
    const wps = this.baselineWaypoints();
    return wps.length > 0 ? wps.length - 1 : 0;
  });

  readonly scrubberStartTime = computed(() => {
    const wps = this.baselineWaypoints();
    return wps.length > 0 ? wps[0].timestamp : '';
  });

  readonly scrubberEndTime = computed(() => {
    const wps = this.baselineWaypoints();
    return wps.length > 0 ? wps[wps.length - 1].timestamp : '';
  });

  readonly scrubberCurrentTime = computed(() => {
    const wps = this.baselineWaypoints();
    const pos = this.scrubberPosition();
    return wps.length > pos ? wps[pos].timestamp : '';
  });

  constructor() {
    // Wire up debounced trip search for baseline
    this.baselineSearch$
      .pipe(
        debounceTime(300),
        switchMap((q) => {
          if (q.length < 2) {
            this.baselineResults.set([]);
            this.baselineDropdownOpen.set(false);
            return EMPTY;
          }
          return this.diffService.searchTrips(q);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((result) => {
        this.baselineResults.set(result.items);
        this.baselineDropdownOpen.set(result.items.length > 0);
      });

    // Wire up debounced trip search for comparison
    this.comparisonSearch$
      .pipe(
        debounceTime(300),
        switchMap((q) => {
          if (q.length < 2) {
            this.comparisonResults.set([]);
            this.comparisonDropdownOpen.set(false);
            return EMPTY;
          }
          return this.diffService.searchTrips(q);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((result) => {
        this.comparisonResults.set(result.items);
        this.comparisonDropdownOpen.set(result.items.length > 0);
      });
  }

  ngAfterViewInit(): void {
    // Initial render of empty canvas
    this.renderMiniMap();
  }

  ngOnDestroy(): void {
    this.stopPlayback();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Trip Search Handlers ───────────────────────────

  onBaselineSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.baselineQuery.set(value);
    this.baselineSearch$.next(value);
  }

  onComparisonSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.comparisonQuery.set(value);
    this.comparisonSearch$.next(value);
  }

  selectBaseline(trip: Trip): void {
    this.baselineTrip.set(trip);
    this.baselineQuery.set(trip.tripNumber);
    this.baselineDropdownOpen.set(false);
    this.baselineResults.set([]);
  }

  selectComparison(trip: Trip): void {
    this.comparisonTrip.set(trip);
    this.comparisonQuery.set(trip.tripNumber);
    this.comparisonDropdownOpen.set(false);
    this.comparisonResults.set([]);
  }

  clearBaseline(): void {
    this.baselineTrip.set(null);
    this.baselineQuery.set('');
    this.baselineResults.set([]);
    this.resetDiff();
  }

  clearComparison(): void {
    this.comparisonTrip.set(null);
    this.comparisonQuery.set('');
    this.comparisonResults.set([]);
    this.resetDiff();
  }

  toggleSameTrip(): void {
    this.sameTrip.update((v) => !v);
  }

  // ─── Comparison ─────────────────────────────────────

  runComparison(): void {
    const baseline = this.baselineTrip();
    const comparison = this.comparisonTrip();
    if (!baseline || !comparison) return;

    this.loading.set(true);
    this.error.set(null);
    this.diffReport.set(null);
    this.stopPlayback();
    this.scrubberPosition.set(0);

    this.diffService
      .compare({
        baselineTripId: baseline.id,
        comparisonTripId: comparison.id,
        sameTrip: this.sameTrip(),
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (report) => {
          this.diffReport.set(report);
          this.loading.set(false);
          // Render the mini-map after receiving data
          requestAnimationFrame(() => this.renderMiniMap());
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? err?.message ?? 'Failed to generate diff');
          this.loading.set(false);
        },
      });
  }

  dismissError(): void {
    this.error.set(null);
  }

  // ─── Timeline / Playback ───────────────────────────

  togglePlayback(): void {
    if (this.playing()) {
      this.stopPlayback();
    } else {
      this.startPlayback();
    }
  }

  stepForward(): void {
    const max = this.maxScrubberValue();
    this.scrubberPosition.update((pos) => Math.min(pos + 1, max));
  }

  stepBackward(): void {
    this.scrubberPosition.update((pos) => Math.max(pos - 1, 0));
  }

  onScrub(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.scrubberPosition.set(value);
  }

  setPlaybackSpeed(event: Event): void {
    const speed = Number((event.target as HTMLSelectElement).value);
    this.playbackSpeed.set(speed);
    // If currently playing, restart with new speed
    if (this.playing()) {
      this.stopPlayback();
      this.startPlayback();
    }
  }

  private startPlayback(): void {
    this.playing.set(true);
    const intervalMs = 200 / this.playbackSpeed();
    this.playbackTimer = setInterval(() => {
      const pos = this.scrubberPosition();
      const max = this.maxScrubberValue();
      if (pos >= max) {
        this.stopPlayback();
        return;
      }
      this.scrubberPosition.set(pos + 1);
    }, intervalMs);
  }

  private stopPlayback(): void {
    this.playing.set(false);
    if (this.playbackTimer !== null) {
      clearInterval(this.playbackTimer);
      this.playbackTimer = null;
    }
  }

  // ─── Diff Helpers ───────────────────────────────────

  isDeviated(index: number): boolean {
    const report = this.diffReport();
    if (!report) return false;
    const segment = report.segments.find((s) => s.index === index);
    return segment !== undefined && segment.severity !== 'match';
  }

  gutterMarkerHeight(): number {
    // Each waypoint row is ~33px; scale gutter markers to match
    return 33;
  }

  // ─── Mini Map Canvas Rendering ─────────────────────

  private renderMiniMap(): void {
    const canvasRef = this.diffCanvas();
    if (!canvasRef) return;

    const canvas = canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const report = this.diffReport();
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#f0f2f5';
    ctx.fillRect(0, 0, width, height);

    if (!report || report.segments.length === 0) {
      ctx.fillStyle = '#adb5bd';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Run a comparison to view the route diff map', width / 2, height / 2);
      return;
    }

    const segments = report.segments;
    const baselineWps = report.baselineReplay.waypoints;
    const comparisonWps = report.comparisonReplay.waypoints;

    // Compute bounding box across all waypoints
    const allLats = [
      ...baselineWps.map((w) => w.lat),
      ...comparisonWps.map((w) => w.lat),
    ];
    const allLngs = [
      ...baselineWps.map((w) => w.lng),
      ...comparisonWps.map((w) => w.lng),
    ];

    const minLat = Math.min(...allLats);
    const maxLat = Math.max(...allLats);
    const minLng = Math.min(...allLngs);
    const maxLng = Math.max(...allLngs);

    const padding = 40;
    const drawW = width - padding * 2;
    const drawH = height - padding * 2;
    const latRange = maxLat - minLat || 0.001;
    const lngRange = maxLng - minLng || 0.001;

    const toX = (lng: number) => padding + ((lng - minLng) / lngRange) * drawW;
    const toY = (lat: number) => padding + drawH - ((lat - minLat) / latRange) * drawH;

    // Draw baseline route (blue)
    this.drawRoute(ctx, baselineWps, toX, toY, '#4361ee', 2);

    // Draw comparison route (orange)
    this.drawRoute(ctx, comparisonWps, toX, toY, '#fd7e14', 2);

    // Draw deviation markers
    for (const seg of segments) {
      if (seg.severity === 'match') continue;
      const color = SEVERITY_COLORS[seg.severity] ?? '#adb5bd';
      const x1 = toX(seg.baselineLng);
      const y1 = toY(seg.baselineLat);
      const x2 = toX(seg.comparisonLng);
      const y2 = toY(seg.comparisonLat);

      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Dot at midpoint
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(mx, my, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawRoute(
    ctx: CanvasRenderingContext2D,
    waypoints: TripWaypoint[],
    toX: (lng: number) => number,
    toY: (lat: number) => number,
    color: string,
    lineWidth: number,
  ): void {
    if (waypoints.length < 2) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(toX(waypoints[0].lng), toY(waypoints[0].lat));

    for (let i = 1; i < waypoints.length; i++) {
      ctx.lineTo(toX(waypoints[i].lng), toY(waypoints[i].lat));
    }
    ctx.stroke();

    // Draw start and end markers
    const start = waypoints[0];
    const end = waypoints[waypoints.length - 1];
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(toX(start.lng), toY(start.lat), 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(toX(end.lng), toY(end.lat), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // ─── Formatting Helpers ─────────────────────────────

  formatDuration(totalSeconds: number): string {
    const abs = Math.abs(totalSeconds);
    const sign = totalSeconds < 0 ? '-' : '+';
    const minutes = Math.floor(abs / 60);
    const seconds = Math.round(abs % 60);
    return `${sign}${minutes}m ${seconds}s`;
  }

  formatTimestamp(iso: string): string {
    if (!iso) return '--:--:--';
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return iso;
    }
  }

  // ─── Export ─────────────────────────────────────────

  exportReport(format: 'pdf' | 'csv'): void {
    const report = this.diffReport();
    if (!report) return;

    this.exporting.set(true);

    this.diffService
      .exportReport(report.diff.id, format)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (blob) => {
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `replay-diff-${report.diff.id}.${format}`;
          anchor.click();
          URL.revokeObjectURL(url);
          this.exporting.set(false);
        },
        error: () => {
          this.error.set(`Failed to export ${format.toUpperCase()} report`);
          this.exporting.set(false);
        },
      });
  }

  // ─── Internal ───────────────────────────────────────

  private resetDiff(): void {
    this.diffReport.set(null);
    this.scrubberPosition.set(0);
    this.stopPlayback();
    this.error.set(null);
  }
}
