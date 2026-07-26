import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  effect,
  DestroyRef,
  PLATFORM_ID,
  afterNextRender,
  ElementRef,
  viewChild,
  NgZone,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HubConnectionState } from '@microsoft/signalr';

import { MapStateService } from '@erbu-admin-web/shared/data-access';
import { SignalRService } from '@erbu-admin-web/shared/data-access';
import { VoipService } from '@erbu-admin-web/shared/data-access';
import { Environment } from '@erbu-admin-web/shared/data-access';

import { MapLayerService, MAP_LAYER_IDS } from './services/map-layer.service';
import { MapSignalRService } from './services/map-signalr.service';
import { SimulationService } from './services/simulation.service';
import {
  MapSidebarComponent,
  FilterChange,
} from './components/map-sidebar.component';
import { VoipPanelComponent } from './components/voip-panel.component';

import type { Map as MlMap, NavigationControl, FullscreenControl } from 'maplibre-gl';

/** Default map center: Tunis, Tunisia */
const DEFAULT_CENTER: [number, number] = [10.1815, 36.8065];
const DEFAULT_ZOOM = 12;

@Component({
  selector: 'app-map-page',
  standalone: true,
  imports: [CommonModule, MapSidebarComponent, VoipPanelComponent],
  providers: [MapLayerService, MapSignalRService, SimulationService],
  templateUrl: './map-page.component.html',
  styleUrl: './map-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapPageComponent implements OnInit, OnDestroy {
  // ---------- DI ----------
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);
  private readonly mapState = inject(MapStateService);
  private readonly layerService = inject(MapLayerService);
  private readonly mapSignalR = inject(MapSignalRService);
  private readonly simulationService = inject(SimulationService);
  private readonly environment = inject<Environment>('ENVIRONMENT' as never);
  readonly voipService = inject(VoipService);

  // ---------- View refs ----------
  readonly mapContainer = viewChild<ElementRef<HTMLDivElement>>('mapContainer');

  // ---------- State ----------
  private map: MlMap | null = null;
  private resizeObserver: ResizeObserver | null = null;

  readonly mapReady = signal(false);
  readonly mapError = signal<string | null>(null);

  // Expose MapSignalR connection state
  readonly connectionState = this.mapSignalR.connectionState;
  readonly connectionError = this.mapSignalR.lastError;

  // Expose MapStateService counts for the status bar
  readonly driverCount = this.mapState.driverCount;
  readonly riderCount = this.mapState.riderCount;
  readonly activeTripCount = this.mapState.activeTripCount;
  readonly activeSurgeCount = this.mapState.activeSurgeZoneCount;
  readonly activeAlerts = this.mapState.activeAlerts;
  readonly criticalAlerts = this.mapState.criticalAlerts;

  readonly connectionLabel = computed(() => {
    switch (this.connectionState()) {
      case HubConnectionState.Connected:
        return 'Connected';
      case HubConnectionState.Reconnecting:
        return 'Reconnecting...';
      case HubConnectionState.Connecting:
        return 'Connecting...';
      default:
        return 'Disconnected';
    }
  });

  readonly connectionClass = computed(() => {
    switch (this.connectionState()) {
      case HubConnectionState.Connected:
        return 'conn-ok';
      case HubConnectionState.Reconnecting:
      case HubConnectionState.Connecting:
        return 'conn-warn';
      default:
        return 'conn-err';
    }
  });

  // ---------- Active filter state ----------
  private activeFilter = signal<FilterChange>({
    driverStatuses: ['Available', 'OnTrip'],
    vehicleTypes: [],
    showOnlyOnTrip: false,
  });

  // ---------- Effects: push data to map layers on signal change ----------
  private readonly driverEffect = effect(() => {
    const drivers = this.mapState.drivers();
    const filter = this.activeFilter();

    let filtered = drivers;
    if (filter.driverStatuses.length > 0) {
      filtered = filtered.filter((d) =>
        filter.driverStatuses.includes(d.status),
      );
    }
    if (filter.vehicleTypes.length > 0) {
      filtered = filtered.filter((d) =>
        filter.vehicleTypes.includes(d.vehicleType),
      );
    }
    if (filter.showOnlyOnTrip) {
      filtered = filtered.filter((d) => d.isOnTrip);
    }

    this.layerService.updateDriverPositions(filtered);
  });

  private readonly riderEffect = effect(() => {
    this.layerService.updateRiderPositions(this.mapState.riders());
  });

  private readonly surgeEffect = effect(() => {
    this.layerService.updateSurgeZones(this.mapState.surgeZones());
  });

  private readonly geofenceEffect = effect(() => {
    this.layerService.updateGeofences(this.mapState.geoFences());
  });

  // ---------- Lifecycle ----------

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      afterNextRender(() => this.initMap());
    }
  }

  ngOnInit(): void {
    // Initialize VoIP service (connects its own hub)
    this.voipService.initialize().catch(() => {
      // VoIP init failure is non-fatal
    });
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.simulationService.dispose();
    this.map?.remove();
    this.map = null;
  }

  // ---------- Public API for template ----------

  onLayerToggled(event: { layerId: string; visible: boolean }): void {
    this.layerService.toggleLayer(event.layerId, event.visible);
  }

  onFilterChanged(filter: FilterChange): void {
    this.activeFilter.set(filter);
  }

  // ---------- Map initialization ----------

  private async initMap(): Promise<void> {
    const container = this.mapContainer()?.nativeElement;
    if (!container) {
      this.mapError.set('Map container not found');
      return;
    }

    try {
      // Dynamic import to avoid SSR issues
      const maplibregl = await import('maplibre-gl');

      this.ngZone.runOutsideAngular(() => {
        this.map = new maplibregl.Map({
          container,
          style: this.getMapStyle() as any,
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          attributionControl: false,
          maxZoom: 20,
          minZoom: 3,
        });

        // Add controls
        this.map.addControl(
          new maplibregl.NavigationControl({ showCompass: true, showZoom: true }),
          'top-right',
        );
        this.map.addControl(
          new maplibregl.FullscreenControl(),
          'top-right',
        );
        this.map.addControl(
          new maplibregl.AttributionControl({ compact: true }),
          'bottom-right',
        );

        this.map.on('load', () => {
          this.ngZone.run(() => {
            this.onMapLoaded();
          });
        });

        // Fallback: if 'load' never fires (slow tiles), use 'style.load' + timeout
        this.map.on('style.load', () => {
          setTimeout(() => {
            if (!this.mapReady()) {
              this.ngZone.run(() => this.onMapLoaded());
            }
          }, 2000);
        });

        this.map.on('error', (e) => {
          this.ngZone.run(() => {
            this.mapError.set(e.error?.message ?? 'Map error');
          });
        });
      });

      // Resize observer for responsive container
      this.resizeObserver = new ResizeObserver(() => {
        this.map?.resize();
      });
      this.resizeObserver.observe(container);
    } catch (err) {
      this.mapError.set(
        err instanceof Error ? err.message : 'Failed to load MapLibre GL',
      );
    }
  }

  private onMapLoaded(): void {
    if (!this.map) return;

    try {
      this.layerService.setMap(this.map);

      this.layerService.addGeofencesLayer();
      this.layerService.addSurgeLayer();
      this.layerService.addHeatmapLayer();
      this.layerService.addCustomSurgeLayer();
      this.layerService.addRoutesLayer();
      this.layerService.addCustomMarkersLayer();
      this.layerService.addRidersLayer();
      this.layerService.addDriversLayer();

      this.layerService.toggleLayer(MAP_LAYER_IDS.customMarkers, false);
      this.layerService.toggleLayer(MAP_LAYER_IDS.surgeHeatmap, false);
      this.layerService.toggleLayer(MAP_LAYER_IDS.customSurge, false);
    } catch (err) {
      console.warn('[Map] Layer setup failed, map still usable:', err);
    }

    this.mapReady.set(true);
    this.mapSignalR.connect();
  }

  private getMapStyle(): string | object {
    const key = this.environment.mapTilerKey;
    if (key) {
      return `https://api.maptiler.com/maps/streets-v2-dark/style.json?key=${key}`;
    }
    return {
      version: 8,
      sources: {
        'carto-dark': {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
            'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
            'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
          ],
          tileSize: 256,
          attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        },
      },
      layers: [
        { id: 'carto-dark-layer', type: 'raster', source: 'carto-dark', minzoom: 0, maxzoom: 20 },
      ],
    };
  }
}
