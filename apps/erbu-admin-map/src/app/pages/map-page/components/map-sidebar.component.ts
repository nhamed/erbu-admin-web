import {
  Component,
  ChangeDetectionStrategy,
  output,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MapLayerType, DriverStatus } from '@erbu-admin-web/shared/models';
import { MapStateService } from '@erbu-admin-web/shared/data-access';
import { MAP_LAYER_IDS } from '../services/map-layer.service';

export interface LayerToggle {
  id: string;
  label: string;
  layerId: string;
  enabled: boolean;
  color: string;
}

export interface FilterChange {
  driverStatuses: string[];
  vehicleTypes: string[];
  showOnlyOnTrip: boolean;
}

@Component({
  selector: 'app-map-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './map-sidebar.component.html',
  styleUrl: './map-sidebar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapSidebarComponent {
  private readonly mapState = inject(MapStateService);

  /** Emitted when a layer is toggled on/off */
  readonly layerToggled = output<{ layerId: string; visible: boolean }>();

  /** Emitted when filter criteria change */
  readonly filterChanged = output<FilterChange>();

  /** Sidebar collapsed state */
  readonly collapsed = signal(false);

  /** Layer toggles */
  readonly layers = signal<LayerToggle[]>([
    { id: 'drivers', label: 'Drivers', layerId: MAP_LAYER_IDS.drivers, enabled: true, color: '#22c55e' },
    { id: 'riders', label: 'Riders', layerId: MAP_LAYER_IDS.riders, enabled: true, color: '#a855f7' },
    { id: 'routes', label: 'Routes', layerId: MAP_LAYER_IDS.routes, enabled: true, color: '#06b6d4' },
    { id: 'customMarkers', label: 'Custom Markers', layerId: MAP_LAYER_IDS.customMarkers, enabled: false, color: '#f59e0b' },
    { id: 'geofences', label: 'Geofences', layerId: MAP_LAYER_IDS.geofences, enabled: true, color: '#64748b' },
    { id: 'surgePolygons', label: 'Surge Zones', layerId: MAP_LAYER_IDS.surgePolygons, enabled: true, color: '#f97316' },
    { id: 'surgeHeatmap', label: 'Surge Heatmap', layerId: MAP_LAYER_IDS.surgeHeatmap, enabled: false, color: '#ef4444' },
    { id: 'customSurge', label: 'Custom Surge', layerId: MAP_LAYER_IDS.customSurge, enabled: false, color: '#8b5cf6' },
  ]);

  /** Driver status filter options */
  readonly driverStatusOptions: { value: string; label: string }[] = [
    { value: DriverStatus.Available, label: 'Available' },
    { value: DriverStatus.OnTrip, label: 'On Trip' },
    { value: DriverStatus.Offline, label: 'Offline' },
    { value: DriverStatus.Active, label: 'Active' },
    { value: DriverStatus.Suspended, label: 'Suspended' },
  ];

  /** Vehicle type filter options */
  readonly vehicleTypeOptions = [
    { value: 'Sedan', label: 'Sedan' },
    { value: 'SUV', label: 'SUV' },
    { value: 'Van', label: 'Van' },
    { value: 'Luxury', label: 'Luxury' },
    { value: 'Electric', label: 'Electric' },
    { value: 'Moto', label: 'Moto' },
  ];

  /** Active status filters */
  readonly selectedStatuses = signal<Set<string>>(
    new Set([DriverStatus.Available, DriverStatus.OnTrip]),
  );

  /** Active vehicle type filters */
  readonly selectedVehicleTypes = signal<Set<string>>(new Set());

  /** Show only on-trip drivers */
  readonly showOnlyOnTrip = signal(false);

  /** Counts from MapStateService */
  readonly driverCount = this.mapState.driverCount;
  readonly riderCount = this.mapState.riderCount;
  readonly activeTripCount = this.mapState.activeTripCount;
  readonly activeSurgeCount = this.mapState.activeSurgeZoneCount;

  toggleCollapsed(): void {
    this.collapsed.update((v) => !v);
  }

  onLayerToggle(index: number): void {
    this.layers.update((list) => {
      const updated = [...list];
      updated[index] = { ...updated[index], enabled: !updated[index].enabled };
      return updated;
    });

    const layer = this.layers()[index];
    this.layerToggled.emit({
      layerId: layer.layerId,
      visible: layer.enabled,
    });
  }

  onStatusToggle(status: string): void {
    this.selectedStatuses.update((current) => {
      const next = new Set(current);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
    this.emitFilterChange();
  }

  onVehicleTypeToggle(type: string): void {
    this.selectedVehicleTypes.update((current) => {
      const next = new Set(current);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
    this.emitFilterChange();
  }

  onOnlyOnTripToggle(): void {
    this.showOnlyOnTrip.update((v) => !v);
    this.emitFilterChange();
  }

  private emitFilterChange(): void {
    this.filterChanged.emit({
      driverStatuses: Array.from(this.selectedStatuses()),
      vehicleTypes: Array.from(this.selectedVehicleTypes()),
      showOnlyOnTrip: this.showOnlyOnTrip(),
    });
  }

  trackByLayerId(_: number, layer: LayerToggle): string {
    return layer.id;
  }
}
