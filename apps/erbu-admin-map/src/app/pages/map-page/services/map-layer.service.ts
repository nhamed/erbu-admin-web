import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
  DriverPosition,
  RiderPosition,
  SurgeZone,
  GeoFence,
  DemandLevel,
} from '@erbu-admin-web/shared/models';
import { Environment } from '@erbu-admin-web/shared/data-access';

import type {
  Map as MlMap,
  GeoJSONSource,
  LngLatBoundsLike,
  LayerSpecification,
  SourceSpecification,
} from 'maplibre-gl';

import type { Feature, FeatureCollection } from 'geojson';

/** Color palette for layer rendering */
const COLORS = {
  driverAvailable: '#22c55e',
  driverOnTrip: '#3b82f6',
  driverOffline: '#94a3b8',
  rider: '#a855f7',
  riderWaiting: '#f59e0b',
  route: '#06b6d4',
  geofence: '#64748b',
  geofenceRestricted: '#ef4444',
  surgeNormal: '#22c55e',
  surgeHigh: '#f59e0b',
  surgeVeryHigh: '#f97316',
  surgeCritical: '#ef4444',
} as const;

/** Canonical layer IDs matching the 8 map layers requirement */
export const MAP_LAYER_IDS = {
  drivers: 'layer-drivers',
  riders: 'layer-riders',
  routes: 'layer-routes',
  customMarkers: 'layer-custom-markers',
  geofences: 'layer-geofences',
  surgePolygons: 'layer-surge-polygons',
  surgeHeatmap: 'layer-surge-heatmap',
  customSurge: 'layer-custom-surge',
} as const;

const SOURCE_IDS = {
  drivers: 'source-drivers',
  riders: 'source-riders',
  routes: 'source-routes',
  customMarkers: 'source-custom-markers',
  geofences: 'source-geofences',
  surgePolygons: 'source-surge-polygons',
  surgeHeatmap: 'source-surge-heatmap',
  customSurge: 'source-custom-surge',
} as const;

@Injectable()
export class MapLayerService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly environment = inject<Environment>('ENVIRONMENT' as never);
  private map: MlMap | null = null;

  /** Bind the MapLibre instance after map 'load' event. */
  setMap(map: MlMap): void {
    this.map = map;
  }

  /** Returns the current map instance (for direct access in parent). */
  getMap(): MlMap | null {
    return this.map;
  }

  // ------------------------------------------------------------------
  // Layer setup
  // ------------------------------------------------------------------

  addDriversLayer(): void {
    if (!this.map) return;
    this.addGeoJsonSource(SOURCE_IDS.drivers);
    this.map.addLayer({
      id: MAP_LAYER_IDS.drivers,
      type: 'circle',
      source: SOURCE_IDS.drivers,
      paint: {
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          8, 3,
          14, 8,
          18, 14,
        ],
        'circle-color': [
          'match', ['get', 'status'],
          'Available', COLORS.driverAvailable,
          'OnTrip', COLORS.driverOnTrip,
          COLORS.driverOffline,
        ],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.9,
      },
    });
  }

  addRidersLayer(): void {
    if (!this.map) return;
    this.addGeoJsonSource(SOURCE_IDS.riders);
    this.map.addLayer({
      id: MAP_LAYER_IDS.riders,
      type: 'circle',
      source: SOURCE_IDS.riders,
      paint: {
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          8, 2,
          14, 6,
          18, 10,
        ],
        'circle-color': [
          'case',
          ['get', 'isWaitingForPickup'], COLORS.riderWaiting,
          COLORS.rider,
        ],
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.85,
      },
    });
  }

  addRoutesLayer(): void {
    if (!this.map) return;
    this.addGeoJsonSource(SOURCE_IDS.routes);
    this.map.addLayer({
      id: MAP_LAYER_IDS.routes,
      type: 'line',
      source: SOURCE_IDS.routes,
      layout: {
        'line-join': 'round',
        'line-cap': 'round',
      },
      paint: {
        'line-color': COLORS.route,
        'line-width': 3,
        'line-opacity': 0.8,
        'line-dasharray': [2, 1],
      },
    });
  }

  addCustomMarkersLayer(): void {
    if (!this.map) return;
    this.addGeoJsonSource(SOURCE_IDS.customMarkers);
    this.map.addLayer({
      id: MAP_LAYER_IDS.customMarkers,
      type: 'circle',
      source: SOURCE_IDS.customMarkers,
      paint: {
        'circle-radius': 6,
        'circle-color': ['get', 'color'],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#1e293b',
      },
    });
  }

  addGeofencesLayer(): void {
    if (!this.map) return;
    this.addGeoJsonSource(SOURCE_IDS.geofences);
    this.map.addLayer({
      id: MAP_LAYER_IDS.geofences,
      type: 'fill',
      source: SOURCE_IDS.geofences,
      paint: {
        'fill-color': [
          'match', ['get', 'fenceType'],
          'RestrictedZone', COLORS.geofenceRestricted,
          'NoPickupZone', COLORS.geofenceRestricted,
          COLORS.geofence,
        ],
        'fill-opacity': 0.15,
      },
    });

    // Geofence outline
    this.map.addLayer({
      id: MAP_LAYER_IDS.geofences + '-outline',
      type: 'line',
      source: SOURCE_IDS.geofences,
      paint: {
        'line-color': [
          'match', ['get', 'fenceType'],
          'RestrictedZone', COLORS.geofenceRestricted,
          'NoPickupZone', COLORS.geofenceRestricted,
          COLORS.geofence,
        ],
        'line-width': 2,
        'line-dasharray': [4, 2],
      },
    });
  }

  addSurgeLayer(): void {
    if (!this.map) return;
    this.addGeoJsonSource(SOURCE_IDS.surgePolygons);
    this.map.addLayer({
      id: MAP_LAYER_IDS.surgePolygons,
      type: 'fill',
      source: SOURCE_IDS.surgePolygons,
      paint: {
        'fill-color': [
          'match', ['get', 'demandLevel'],
          'Normal', COLORS.surgeNormal,
          'High', COLORS.surgeHigh,
          'VeryHigh', COLORS.surgeVeryHigh,
          'Critical', COLORS.surgeCritical,
          COLORS.surgeNormal,
        ],
        'fill-opacity': [
          'interpolate', ['linear'], ['get', 'surgeMultiplier'],
          1.0, 0.05,
          2.0, 0.2,
          3.0, 0.35,
          5.0, 0.5,
        ],
      },
    });
  }

  addHeatmapLayer(): void {
    if (!this.map) return;
    this.addGeoJsonSource(SOURCE_IDS.surgeHeatmap);
    this.map.addLayer({
      id: MAP_LAYER_IDS.surgeHeatmap,
      type: 'fill',
      source: SOURCE_IDS.surgeHeatmap,
      paint: {
        'fill-color': [
          'interpolate', ['linear'], ['get', 'surgeMultiplier'],
          1.0, 'rgba(34,197,94,0.1)',
          1.5, 'rgba(245,158,11,0.25)',
          2.0, 'rgba(249,115,22,0.4)',
          3.0, 'rgba(239,68,68,0.55)',
          5.0, 'rgba(185,28,28,0.7)',
        ],
        'fill-opacity': 0.6,
      },
    });
  }

  addCustomSurgeLayer(): void {
    if (!this.map) return;
    this.addGeoJsonSource(SOURCE_IDS.customSurge);
    this.map.addLayer({
      id: MAP_LAYER_IDS.customSurge,
      type: 'fill',
      source: SOURCE_IDS.customSurge,
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': ['get', 'opacity'],
      },
    });
  }

  // ------------------------------------------------------------------
  // Data update helpers
  // ------------------------------------------------------------------

  updateDriverPositions(positions: DriverPosition[]): void {
    this.setSourceData(SOURCE_IDS.drivers, {
      type: 'FeatureCollection',
      features: positions.map((p) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        properties: {
          id: p.driverId,
          status: p.status,
          vehicleType: p.vehicleType,
          isOnTrip: p.isOnTrip,
          heading: p.headingDegrees,
          speed: p.speedKmh,
        },
      })),
    });
  }

  updateRiderPositions(positions: RiderPosition[]): void {
    this.setSourceData(SOURCE_IDS.riders, {
      type: 'FeatureCollection',
      features: positions.map((p) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
        properties: {
          id: p.riderId,
          isWaitingForPickup: p.isWaitingForPickup,
        },
      })),
    });
  }

  updateRoutes(routes: FeatureCollection): void {
    this.setSourceData(SOURCE_IDS.routes, routes);
  }

  updateGeofences(fences: GeoFence[]): void {
    this.setSourceData(SOURCE_IDS.geofences, {
      type: 'FeatureCollection',
      features: fences.map((f) => {
        try {
          const geometry = JSON.parse(f.boundaryGeoJson);
          return {
            type: 'Feature' as const,
            geometry,
            properties: {
              id: f.id,
              name: f.name,
              fenceType: f.type,
              isActive: f.isActive,
            },
          };
        } catch {
          return null;
        }
      }).filter(Boolean) as Feature[],
    });
  }

  updateSurgeZones(zones: SurgeZone[]): void {
    const features: Feature[] = zones
      .filter((z) => z.isActive)
      .map((z) => {
        try {
          const geometry = JSON.parse(z.boundaryGeoJson);
          return {
            type: 'Feature' as const,
            geometry,
            properties: {
              id: z.id,
              name: z.name,
              surgeMultiplier: z.surgeMultiplier,
              demandLevel: z.demandLevel,
              activeDriverCount: z.activeDriverCount,
              pendingRequestCount: z.pendingRequestCount,
            },
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean) as Feature[];

    const collection: FeatureCollection = {
      type: 'FeatureCollection',
      features,
    };

    this.setSourceData(SOURCE_IDS.surgePolygons, collection);
    this.setSourceData(SOURCE_IDS.surgeHeatmap, collection);
  }

  // ------------------------------------------------------------------
  // Layer controls
  // ------------------------------------------------------------------

  toggleLayer(layerId: string, visible: boolean): void {
    if (!this.map) return;
    const visibility = visible ? 'visible' : 'none';
    if (this.map.getLayer(layerId)) {
      this.map.setLayoutProperty(layerId, 'visibility', visibility);
    }
    // Toggle companion outline layer for geofences
    const outlineId = layerId + '-outline';
    if (this.map.getLayer(outlineId)) {
      this.map.setLayoutProperty(outlineId, 'visibility', visibility);
    }
  }

  fitBounds(bounds: LngLatBoundsLike, padding = 60): void {
    this.map?.fitBounds(bounds, { padding, duration: 800 });
  }

  flyTo(lng: number, lat: number, zoom = 14): void {
    this.map?.flyTo({ center: [lng, lat], zoom, duration: 600 });
  }

  // ------------------------------------------------------------------
  // Private helpers
  // ------------------------------------------------------------------

  private addGeoJsonSource(sourceId: string): void {
    if (!this.map || this.map.getSource(sourceId)) return;
    this.map.addSource(sourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }

  private setSourceData(
    sourceId: string,
    data: FeatureCollection,
  ): void {
    if (!this.map) return;
    const source = this.map.getSource(sourceId) as GeoJSONSource | undefined;
    if (source) {
      source.setData(data);
    }
  }
}
