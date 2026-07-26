export interface MarketplaceReservation {
  id: string;
  riderId: string;
  riderName: string;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string;
  dropoffLat: number;
  dropoffLng: number;
  dropoffAddress: string;
  scheduledAt: string;
  vehicleType: string;
  estimatedFare: number;
  currency: string;
  status: ReservationStatus;
  assignedDriverId: string | null;
  createdAt: string;
  confirmedAt: string | null;
  cancellationDeadline: string;
}

export enum ReservationStatus {
  Pending = 'Pending',
  Confirmed = 'Confirmed',
  DriverAssigned = 'DriverAssigned',
  InProgress = 'InProgress',
  Completed = 'Completed',
  CancelledByRider = 'CancelledByRider',
  CancelledBySystem = 'CancelledBySystem',
  NoShow = 'NoShow',
}

export interface DemandLiquidity {
  zoneId: string;
  zoneName: string;
  centerLat: number;
  centerLng: number;
  activeRiders: number;
  activeDrivers: number;
  pendingRequests: number;
  supplyDemandRatio: number;
  surgeMultiplier: number;
  averageWaitTimeSeconds: number;
  averageEtaSeconds: number;
  estimatedFulfillmentRate: number;
  lastUpdatedAt: string;
  trend: LiquidityTrend;
}

export enum LiquidityTrend {
  Surplus = 'Surplus',
  Balanced = 'Balanced',
  Deficit = 'Deficit',
  CriticalDeficit = 'CriticalDeficit',
}

export interface AuctionBid {
  id: string;
  tripRequestId: string;
  driverId: string;
  driverName: string;
  bidAmount: number;
  currency: string;
  estimatedArrivalMinutes: number;
  driverRating: number;
  vehicleType: string;
  status: BidStatus;
  submittedAt: string;
  expiresAt: string;
  isCounterOffer: boolean;
  originalFareEstimate: number;
  discountPercent: number;
}

export enum BidStatus {
  Pending = 'Pending',
  Accepted = 'Accepted',
  Rejected = 'Rejected',
  Expired = 'Expired',
  Withdrawn = 'Withdrawn',
  Outbid = 'Outbid',
}

export interface AlarmRule {
  id: string;
  name: string;
  description: string;
  metric: string;
  condition: AlarmCondition;
  threshold: number;
  evaluationPeriodMinutes: number;
  consecutiveBreaches: number;
  severity: AlarmSeverity;
  isEnabled: boolean;
  notificationChannels: string[];
  lastTriggeredAt: string | null;
  lastEvaluatedAt: string | null;
  currentValue: number | null;
  isInAlarm: boolean;
  createdBy: string;
  createdAt: string;
}

export enum AlarmCondition {
  GreaterThan = 'GreaterThan',
  LessThan = 'LessThan',
  GreaterThanOrEqual = 'GreaterThanOrEqual',
  LessThanOrEqual = 'LessThanOrEqual',
  Equal = 'Equal',
  NotEqual = 'NotEqual',
}

export enum AlarmSeverity {
  Info = 'Info',
  Warning = 'Warning',
  Error = 'Error',
  Critical = 'Critical',
}

export interface DriverNetworkNode {
  driverId: string;
  driverName: string;
  lat: number;
  lng: number;
  status: string;
  vehicleType: string;
  rating: number;
  totalTripsToday: number;
  earningsToday: number;
  currency: string;
  isOnTrip: boolean;
  currentTripId: string | null;
  connectedSince: string;
  signalStrength: SignalStrength;
  lastPingAt: string;
}

export enum SignalStrength {
  Excellent = 'Excellent',
  Good = 'Good',
  Fair = 'Fair',
  Poor = 'Poor',
  Disconnected = 'Disconnected',
}
