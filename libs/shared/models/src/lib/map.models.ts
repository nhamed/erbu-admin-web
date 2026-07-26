export interface MapLayer {
  id: string;
  name: string;
  type: MapLayerType;
  isVisible: boolean;
  opacity: number;
  zIndex: number;
  minZoom: number;
  maxZoom: number;
  source: string;
  color: string;
  metadata: Record<string, string>;
}

export enum MapLayerType {
  Drivers = 'Drivers',
  Riders = 'Riders',
  Surge = 'Surge',
  Geofence = 'Geofence',
  Heatmap = 'Heatmap',
  Traffic = 'Traffic',
  Routes = 'Routes',
  Incidents = 'Incidents',
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  type: MarkerType;
  label: string;
  iconUrl: string | null;
  color: string;
  rotation: number;
  isAnimated: boolean;
  tooltip: string | null;
  metadata: Record<string, string>;
}

export enum MarkerType {
  Driver = 'Driver',
  Rider = 'Rider',
  Pickup = 'Pickup',
  Dropoff = 'Dropoff',
  Incident = 'Incident',
  POI = 'POI',
  SurgeCenter = 'SurgeCenter',
}

export interface DriverPosition {
  driverId: string;
  lat: number;
  lng: number;
  headingDegrees: number;
  speedKmh: number;
  accuracy: number;
  status: string;
  vehicleType: string;
  isOnTrip: boolean;
  currentTripId: string | null;
  lastUpdatedAt: string;
  batteryLevel: number | null;
}

export interface RiderPosition {
  riderId: string;
  lat: number;
  lng: number;
  accuracy: number;
  isWaitingForPickup: boolean;
  currentTripId: string | null;
  requestedAt: string | null;
  lastUpdatedAt: string;
}

export interface SurgeZone {
  id: string;
  name: string;
  boundaryGeoJson: string;
  surgeMultiplier: number;
  demandLevel: DemandLevel;
  activeDriverCount: number;
  pendingRequestCount: number;
  estimatedWaitMinutes: number;
  centerLat: number;
  centerLng: number;
  radiusKm: number;
  isActive: boolean;
  activatedAt: string;
  expiresAt: string | null;
}

export enum DemandLevel {
  Low = 'Low',
  Normal = 'Normal',
  High = 'High',
  VeryHigh = 'VeryHigh',
  Critical = 'Critical',
}

export interface GeoFence {
  id: string;
  name: string;
  type: GeoFenceType;
  boundaryGeoJson: string;
  isActive: boolean;
  description: string;
  restrictions: string[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  color: string;
}

export enum GeoFenceType {
  ServiceArea = 'ServiceArea',
  RestrictedZone = 'RestrictedZone',
  Airport = 'Airport',
  EventZone = 'EventZone',
  ParkingZone = 'ParkingZone',
  NoPickupZone = 'NoPickupZone',
}

export interface MapFilter {
  layers: MapLayerType[];
  vehicleTypes: string[];
  driverStatuses: string[];
  showOnlyOnTrip: boolean;
  showSurgeZones: boolean;
  showGeofences: boolean;
  timeRangeMinutes: number;
  boundingBox: {
    northLat: number;
    southLat: number;
    eastLng: number;
    westLng: number;
  } | null;
  zoomLevel: number;
}
