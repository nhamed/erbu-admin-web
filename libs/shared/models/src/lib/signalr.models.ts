export interface HubEvent<T = unknown> {
  eventId: string;
  hubName: string;
  eventType: HubEventType;
  payload: T;
  timestamp: string;
  correlationId: string;
  source: string;
  version: number;
}

export enum HubEventType {
  PositionUpdate = 'PositionUpdate',
  TripUpdate = 'TripUpdate',
  FraudAlert = 'FraudAlert',
  InfraAlert = 'InfraAlert',
  PaymentEvent = 'PaymentEvent',
  DriverStatusChange = 'DriverStatusChange',
  SurgeUpdate = 'SurgeUpdate',
  SystemNotification = 'SystemNotification',
  VoipCall = 'VoipCall',
}

export interface PositionUpdate {
  entityId: string;
  entityType: PositionEntityType;
  lat: number;
  lng: number;
  headingDegrees: number;
  speedKmh: number;
  accuracy: number;
  timestamp: string;
  isOnTrip: boolean;
  tripId: string | null;
  batteryLevel: number | null;
}

export enum PositionEntityType {
  Driver = 'Driver',
  Rider = 'Rider',
}

export interface TripUpdate {
  tripId: string;
  riderId: string;
  driverId: string | null;
  previousStatus: string;
  newStatus: string;
  timestamp: string;
  lat: number | null;
  lng: number | null;
  estimatedArrivalMinutes: number | null;
  fareEstimate: number | null;
  metadata: Record<string, string>;
}

export interface FraudAlert {
  id: string;
  alertType: FraudAlertType;
  severity: AlertSeverity;
  entityType: string;
  entityId: string;
  description: string;
  detectedAt: string;
  riskScore: number;
  isResolved: boolean;
  resolvedAt: string | null;
  resolvedBy: string | null;
  evidence: Record<string, unknown>;
  recommendedAction: string;
}

export enum FraudAlertType {
  GPSSpoofing = 'GPSSpoofing',
  FareManipulation = 'FareManipulation',
  AccountTakeover = 'AccountTakeover',
  PaymentFraud = 'PaymentFraud',
  FakeTrip = 'FakeTrip',
  CollaborativeFraud = 'CollaborativeFraud',
  MultipleAccounts = 'MultipleAccounts',
  PromoAbuse = 'PromoAbuse',
}

export enum AlertSeverity {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Critical = 'Critical',
}

export interface InfraAlert {
  id: string;
  service: string;
  alertType: InfraAlertType;
  severity: AlertSeverity;
  message: string;
  detectedAt: string;
  resolvedAt: string | null;
  isActive: boolean;
  affectedRegion: string | null;
  metricName: string;
  metricValue: number;
  threshold: number;
  dashboardUrl: string | null;
}

export enum InfraAlertType {
  HighLatency = 'HighLatency',
  ErrorRate = 'ErrorRate',
  MemoryPressure = 'MemoryPressure',
  CpuSaturation = 'CpuSaturation',
  DiskFull = 'DiskFull',
  ServiceDown = 'ServiceDown',
  DatabaseSlow = 'DatabaseSlow',
  QueueBacklog = 'QueueBacklog',
  CertExpiring = 'CertExpiring',
}

export interface VoipCallState {
  callId: string;
  tripId: string;
  callerId: string;
  callerType: PositionEntityType;
  receiverId: string;
  receiverType: PositionEntityType;
  status: VoipCallStatus;
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  quality: CallQuality | null;
  recordingUrl: string | null;
}

export enum VoipCallStatus {
  Ringing = 'Ringing',
  Answered = 'Answered',
  OnHold = 'OnHold',
  Ended = 'Ended',
  Missed = 'Missed',
  Failed = 'Failed',
}

export enum CallQuality {
  Excellent = 'Excellent',
  Good = 'Good',
  Fair = 'Fair',
  Poor = 'Poor',
}
