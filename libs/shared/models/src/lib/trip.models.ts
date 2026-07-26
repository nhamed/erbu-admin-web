export interface Trip {
  id: string;
  tripNumber: string;
  riderId: string;
  driverId: string | null;
  status: TripStatus;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffAddress: string;
  distanceKm: number;
  estimatedDurationMinutes: number;
  actualDurationMinutes: number | null;
  fareAmount: number;
  currency: string;
  surgeMultiplier: number;
  paymentMethod: string;
  requestedAt: string;
  acceptedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  riderRating: number | null;
  driverRating: number | null;
}

export enum TripStatus {
  Requested = 'Requested',
  Searching = 'Searching',
  DriverAssigned = 'DriverAssigned',
  DriverEnRoute = 'DriverEnRoute',
  DriverArrived = 'DriverArrived',
  InProgress = 'InProgress',
  Completed = 'Completed',
  CancelledByRider = 'CancelledByRider',
  CancelledByDriver = 'CancelledByDriver',
  CancelledBySystem = 'CancelledBySystem',
  Disputed = 'Disputed',
  NoDriverFound = 'NoDriverFound',
}

export interface TripReplay {
  tripId: string;
  waypoints: TripWaypoint[];
  events: TripEvent[];
  totalDistanceKm: number;
  totalDurationSeconds: number;
  averageSpeedKmh: number;
  maxSpeedKmh: number;
  routePolyline: string;
  recordedAt: string;
}

export interface TripWaypoint {
  lat: number;
  lng: number;
  timestamp: string;
  speedKmh: number;
  headingDegrees: number;
  accuracy: number;
}

export interface TripEvent {
  type: TripEventType;
  timestamp: string;
  lat: number;
  lng: number;
  metadata: Record<string, string>;
}

export enum TripEventType {
  Requested = 'Requested',
  Accepted = 'Accepted',
  DriverEnRoute = 'DriverEnRoute',
  DriverArrived = 'DriverArrived',
  TripStarted = 'TripStarted',
  RouteDeviation = 'RouteDeviation',
  SpeedAlert = 'SpeedAlert',
  TripCompleted = 'TripCompleted',
  TripCancelled = 'TripCancelled',
  PaymentProcessed = 'PaymentProcessed',
  RatingSubmitted = 'RatingSubmitted',
}

export interface TripHealth {
  totalTripsToday: number;
  activeTripsNow: number;
  averageWaitTimeSeconds: number;
  averageTripDurationMinutes: number;
  completionRate: number;
  cancellationRate: number;
  averageSurgeMultiplier: number;
  tripsByStatus: Record<TripStatus, number>;
  peakHour: number;
  revenueToday: number;
  currency: string;
  lastUpdatedAt: string;
}
