import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  AfterViewInit,
  effect,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { Subject, debounceTime, distinctUntilChanged, filter, takeUntil } from 'rxjs';

import { PlannerTrip } from '@erbu-admin-web/shared/models';
import { PlannerService, LocationSuggestion, TripTwinResult } from './planner-tab.service';

import * as maplibregl from 'maplibre-gl';
import polyline from '@mapbox/polyline';

// ── Twin comparison row for the mat-table ────────────────────────────────

interface TwinComparisonRow {
  metric: string;
  predicted: string;
  actual: string;
  delta: string;
  deltaValue: number | null;
}

@Component({
  selector: 'app-planner-tab',
  templateUrl: './planner-tab.page.html',
  styleUrl: './planner-tab.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTableModule,
  ],
  providers: [PlannerService],
})
export class PlannerTabPage implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('mapContainer', { static: true })
  private mapEl!: ElementRef<HTMLElement>;

  protected readonly plannerService: PlannerService;

  // ── Form controls ──────────────────────────────────────────────────

  readonly originCtrl = new FormControl('');
  readonly destCtrl = new FormControl('');
  readonly departureCtrl = new FormControl(this.defaultDeparture());
  readonly vehicleCtrl = new FormControl('Economy');
  readonly passengerCtrl = new FormControl(1);
  readonly roundTripCtrl = new FormControl(false);

  // ── Location autocomplete signals ──────────────────────────────────

  readonly originSuggestions = signal<LocationSuggestion[]>([]);
  readonly destSuggestions = signal<LocationSuggestion[]>([]);

  private selectedOrigin: LocationSuggestion | null = null;
  private selectedDest: LocationSuggestion | null = null;

  // ── Twin comparison table ──────────────────────────────────────────

  readonly twinColumns = ['metric', 'predicted', 'actual', 'delta'];

  readonly twinComparisonRows = computed<TwinComparisonRow[]>(() => {
    const twin = this.plannerService.twinResult();
    if (!twin) return [];

    return [
      {
        metric: 'Duration (min)',
        predicted: twin.predictedDurationMinutes.toFixed(1),
        actual: twin.actualDurationMinutes?.toFixed(1) ?? '--',
        delta: this.formatDelta(twin.durationDeltaPercent),
        deltaValue: twin.durationDeltaPercent,
      },
      {
        metric: 'Distance (km)',
        predicted: twin.predictedDistanceKm.toFixed(2),
        actual: twin.actualDistanceKm?.toFixed(2) ?? '--',
        delta: this.formatDelta(twin.distanceDeltaPercent),
        deltaValue: twin.distanceDeltaPercent,
      },
      {
        metric: 'Fare (EUR)',
        predicted: twin.predictedFare.toFixed(2),
        actual: twin.actualFare?.toFixed(2) ?? '--',
        delta: this.formatDelta(twin.fareDeltaPercent),
        deltaValue: twin.fareDeltaPercent,
      },
    ];
  });

  // ── Map ────────────────────────────────────────────────────────────

  private map: maplibregl.Map | null = null;
  private originMarker: maplibregl.Marker | null = null;
  private destMarker: maplibregl.Marker | null = null;

  private readonly destroy$ = new Subject<void>();

  constructor(plannerService: PlannerService) {
    this.plannerService = plannerService;

    // React to selected trip changes to update the map
    effect(() => {
      const trip = this.plannerService.selectedTrip();
      this.renderTripRoute(trip);
    });
  }

  // ── Lifecycle ──────────────────────────────────────────────────────

  ngOnInit(): void {
    this.plannerService.getTrips();
    this.plannerService.connectHub();
    this.setupAutocomplete();
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  // ── Template helpers ───────────────────────────────────────────────

  canPlan(): boolean {
    return this.selectedOrigin !== null && this.selectedDest !== null;
  }

  displayLocation(loc: LocationSuggestion | string | null): string {
    if (!loc) return '';
    if (typeof loc === 'string') return loc;
    return loc.displayName;
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'Requested':
        return 'hail';
      case 'Searching':
        return 'search';
      case 'DriverAssigned':
        return 'person_pin';
      case 'DriverEnRoute':
        return 'directions_car';
      case 'DriverArrived':
        return 'place';
      case 'InProgress':
        return 'navigation';
      case 'Completed':
        return 'check_circle';
      default:
        return 'info';
    }
  }

  // ── Event handlers ─────────────────────────────────────────────────

  onOriginSelected(event: MatAutocompleteSelectedEvent): void {
    this.selectedOrigin = event.option.value as LocationSuggestion;
  }

  onDestSelected(event: MatAutocompleteSelectedEvent): void {
    this.selectedDest = event.option.value as LocationSuggestion;
  }

  async onPlanTrip(): Promise<void> {
    if (!this.selectedOrigin || !this.selectedDest) return;

    await this.plannerService.planTrip({
      origin: this.selectedOrigin.displayName,
      destination: this.selectedDest.displayName,
      departureTime: this.departureCtrl.value ?? new Date().toISOString(),
      vehicleType: this.vehicleCtrl.value ?? 'Economy',
      isRoundTrip: this.roundTripCtrl.value ?? false,
      passengerCount: this.passengerCtrl.value ?? 1,
    });

    // Reset form after successful planning
    this.originCtrl.reset();
    this.destCtrl.reset();
    this.selectedOrigin = null;
    this.selectedDest = null;
    this.departureCtrl.setValue(this.defaultDeparture());
    this.vehicleCtrl.setValue('Economy');
    this.passengerCtrl.setValue(1);
    this.roundTripCtrl.setValue(false);
  }

  async onSimulateTwin(): Promise<void> {
    const trip = this.plannerService.selectedTrip();
    if (!trip) return;

    await this.plannerService.simulateTwin(trip.id);
  }

  async onDeleteTrip(tripId: string, event: Event): Promise<void> {
    event.stopPropagation();
    await this.plannerService.deleteTrip(tripId);
  }

  // ── Autocomplete wiring ────────────────────────────────────────────

  private setupAutocomplete(): void {
    this.originCtrl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        filter((v): v is string => typeof v === 'string' && v.length >= 2),
        takeUntil(this.destroy$),
      )
      .subscribe(async (query) => {
        const results = await this.plannerService.searchLocations(query);
        this.originSuggestions.set(results);
      });

    this.destCtrl.valueChanges
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        filter((v): v is string => typeof v === 'string' && v.length >= 2),
        takeUntil(this.destroy$),
      )
      .subscribe(async (query) => {
        const results = await this.plannerService.searchLocations(query);
        this.destSuggestions.set(results);
      });
  }

  // ── Map initialization ─────────────────────────────────────────────

  private initMap(): void {
    this.map = new maplibregl.Map({
      container: this.mapEl.nativeElement,
      style: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19,
          },
        ],
      },
      center: [10.18, 36.8], // Default: Tunis
      zoom: 11,
      attributionControl: false,
    });

    this.map.addControl(new maplibregl.NavigationControl(), 'top-right');
    this.map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-right',
    );
  }

  // ── Route rendering ────────────────────────────────────────────────

  private renderTripRoute(trip: PlannerTrip | null): void {
    if (!this.map) return;

    // Clean up previous route layer & markers
    this.clearMapRoute();

    if (!trip || !trip.routePolyline) return;

    let coordinates: [number, number][];
    try {
      const decoded = polyline.decode(trip.routePolyline);
      // polyline.decode returns [lat, lng] pairs -- MapLibre wants [lng, lat]
      coordinates = decoded.map(([lat, lng]: [number, number]) => [lng, lat] as [number, number]);
    } catch {
      return;
    }

    if (coordinates.length < 2) return;

    // Add route line
    this.map.addSource('trip-route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates,
        },
      },
    });

    this.map.addLayer({
      id: 'trip-route-line',
      type: 'line',
      source: 'trip-route',
      paint: {
        'line-color': '#1976d2',
        'line-width': 4,
        'line-opacity': 0.8,
      },
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
    });

    // Origin marker (green)
    const originCoord = coordinates[0];
    this.originMarker = new maplibregl.Marker({ color: '#4caf50' })
      .setLngLat(originCoord)
      .setPopup(new maplibregl.Popup().setText(trip.origin))
      .addTo(this.map);

    // Destination marker (red)
    const destCoord = coordinates[coordinates.length - 1];
    this.destMarker = new maplibregl.Marker({ color: '#f44336' })
      .setLngLat(destCoord)
      .setPopup(new maplibregl.Popup().setText(trip.destination))
      .addTo(this.map);

    // Fit map bounds to the route
    const bounds = new maplibregl.LngLatBounds();
    for (const coord of coordinates) {
      bounds.extend(coord);
    }
    this.map.fitBounds(bounds, { padding: 50, maxZoom: 15 });
  }

  private clearMapRoute(): void {
    if (!this.map) return;

    if (this.map.getLayer('trip-route-line')) {
      this.map.removeLayer('trip-route-line');
    }
    if (this.map.getSource('trip-route')) {
      this.map.removeSource('trip-route');
    }

    this.originMarker?.remove();
    this.originMarker = null;

    this.destMarker?.remove();
    this.destMarker = null;
  }

  // ── Formatting helpers ─────────────────────────────────────────────

  private formatDelta(value: number | null): string {
    if (value == null) return '--';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  }

  private defaultDeparture(): string {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    // Format for datetime-local input: "YYYY-MM-DDTHH:mm"
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
}
