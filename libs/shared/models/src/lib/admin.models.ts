export interface ServiceHealth {
  serviceName: string;
  status: ServiceStatus;
  version: string;
  uptime: string;
  uptimePercent: number;
  lastHealthCheckAt: string;
  responseTimeMs: number;
  errorRate: number;
  activeConnections: number;
  cpuPercent: number;
  memoryMb: number;
  region: string;
  instanceCount: number;
  endpoints: EndpointHealth[];
}

export enum ServiceStatus {
  Healthy = 'Healthy',
  Degraded = 'Degraded',
  Unhealthy = 'Unhealthy',
  Down = 'Down',
  Maintenance = 'Maintenance',
  Unknown = 'Unknown',
}

export interface EndpointHealth {
  path: string;
  method: string;
  status: ServiceStatus;
  averageResponseTimeMs: number;
  requestsPerMinute: number;
  errorRate: number;
}

export interface AlertItem {
  id: string;
  title: string;
  message: string;
  severity: AlertItemSeverity;
  category: AlertCategory;
  source: string;
  createdAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  isActive: boolean;
  actionUrl: string | null;
  metadata: Record<string, string>;
}

export enum AlertItemSeverity {
  Info = 'Info',
  Warning = 'Warning',
  Error = 'Error',
  Critical = 'Critical',
}

export enum AlertCategory {
  Infrastructure = 'Infrastructure',
  Payment = 'Payment',
  Fraud = 'Fraud',
  Compliance = 'Compliance',
  Operations = 'Operations',
  Security = 'Security',
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  userId: string;
  userType: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignedTo: string | null;
  tripId: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  responseCount: number;
  satisfactionRating: number | null;
}

export enum TicketCategory {
  TripIssue = 'TripIssue',
  PaymentProblem = 'PaymentProblem',
  AccountAccess = 'AccountAccess',
  DriverBehavior = 'DriverBehavior',
  AppBug = 'AppBug',
  LostItem = 'LostItem',
  SafetyConcern = 'SafetyConcern',
  General = 'General',
}

export enum TicketPriority {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Urgent = 'Urgent',
}

export enum TicketStatus {
  Open = 'Open',
  InProgress = 'InProgress',
  WaitingOnUser = 'WaitingOnUser',
  Escalated = 'Escalated',
  Resolved = 'Resolved',
  Closed = 'Closed',
}

export interface OrchestratorJob {
  id: string;
  jobName: string;
  jobType: JobType;
  status: JobStatus;
  scheduledAt: string;
  startedAt: string | null;
  completedAt: string | null;
  duration: string | null;
  triggeredBy: string;
  parameters: Record<string, string>;
  result: string | null;
  errorMessage: string | null;
  retryCount: number;
  maxRetries: number;
  nextRetryAt: string | null;
}

export enum JobType {
  PayoutBatch = 'PayoutBatch',
  ComplianceScan = 'ComplianceScan',
  DataExport = 'DataExport',
  CacheWarm = 'CacheWarm',
  ReportGeneration = 'ReportGeneration',
  CleanupOldData = 'CleanupOldData',
  NotificationBroadcast = 'NotificationBroadcast',
  SurgeRecalculation = 'SurgeRecalculation',
}

export enum JobStatus {
  Scheduled = 'Scheduled',
  Running = 'Running',
  Completed = 'Completed',
  Failed = 'Failed',
  Cancelled = 'Cancelled',
  Retrying = 'Retrying',
}

export interface InfraNode {
  id: string;
  hostname: string;
  role: NodeRole;
  region: string;
  ipAddress: string;
  status: NodeStatus;
  cpuPercent: number;
  memoryPercent: number;
  diskPercent: number;
  networkInMbps: number;
  networkOutMbps: number;
  containerCount: number;
  lastHeartbeatAt: string;
  provisionedAt: string;
  tags: Record<string, string>;
}

export enum NodeRole {
  ApiGateway = 'ApiGateway',
  Worker = 'Worker',
  Database = 'Database',
  Cache = 'Cache',
  MessageBroker = 'MessageBroker',
  LoadBalancer = 'LoadBalancer',
  Monitor = 'Monitor',
}

export enum NodeStatus {
  Running = 'Running',
  Draining = 'Draining',
  Stopped = 'Stopped',
  Provisioning = 'Provisioning',
  Error = 'Error',
}

export interface PricingRule {
  id: string;
  name: string;
  ruleType: PricingRuleType;
  cityCode: string;
  vehicleType: string;
  baseFare: number;
  perKmRate: number;
  perMinuteRate: number;
  minimumFare: number;
  surgeMultiplierCap: number;
  cancellationFee: number;
  currency: string;
  isActive: boolean;
  effectiveFrom: string;
  effectiveUntil: string | null;
  createdBy: string;
  updatedAt: string;
}

export enum PricingRuleType {
  Standard = 'Standard',
  Peak = 'Peak',
  OffPeak = 'OffPeak',
  Weekend = 'Weekend',
  Holiday = 'Holiday',
  Event = 'Event',
  Promotional = 'Promotional',
}
