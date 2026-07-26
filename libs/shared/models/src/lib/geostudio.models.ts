export interface StudioModule {
  id: string;
  name: string;
  group: ModuleGroup;
  description: string;
  icon: string;
  route: string;
  isEnabled: boolean;
  featureFlag: string | null;
  minRole: string;
  version: string;
  lastUpdatedAt: string;
  healthStatus: ModuleHealthStatus;
  documentationUrl: string | null;
}

export enum ModuleGroup {
  Search = 'Search',
  Ingestion = 'Ingestion',
  Analytics = 'Analytics',
  Infrastructure = 'Infrastructure',
  Configuration = 'Configuration',
  Experimentation = 'Experimentation',
  MachineLearning = 'MachineLearning',
}

export enum ModuleHealthStatus {
  Healthy = 'Healthy',
  Degraded = 'Degraded',
  Error = 'Error',
  Disabled = 'Disabled',
  NotFound = 'NotFound',
}

export interface IngestionPipeline {
  id: string;
  name: string;
  sourceType: IngestionSourceType;
  status: IngestionStatus;
  documentsIngested: number;
  documentsErrored: number;
  documentsPerSecond: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
  schedule: string | null;
  targetIndex: string;
  transformations: string[];
  createdAt: string;
  createdBy: string;
  errorMessage: string | null;
}

export enum IngestionSourceType {
  API = 'API',
  FileUpload = 'FileUpload',
  Database = 'Database',
  Webhook = 'Webhook',
  S3 = 'S3',
  Kafka = 'Kafka',
  Crawler = 'Crawler',
}

export enum IngestionStatus {
  Idle = 'Idle',
  Running = 'Running',
  Paused = 'Paused',
  Failed = 'Failed',
  Completed = 'Completed',
  Scheduled = 'Scheduled',
}

export interface InfraStatus {
  serviceName: string;
  status: ModuleHealthStatus;
  uptime: string;
  responseTimeMs: number;
  requestsPerMinute: number;
  errorRate: number;
  cpuPercent: number;
  memoryMb: number;
  diskUsedGb: number;
  diskTotalGb: number;
  activeConnections: number;
  region: string;
  version: string;
  lastCheckedAt: string;
}

export interface MonitorMetric {
  id: string;
  metricName: string;
  value: number;
  unit: string;
  threshold: number | null;
  isAboveThreshold: boolean;
  trend: MetricTrend;
  sparklineData: number[];
  collectedAt: string;
  source: string;
  tags: Record<string, string>;
}

export enum MetricTrend {
  Rising = 'Rising',
  Falling = 'Falling',
  Stable = 'Stable',
  Volatile = 'Volatile',
}

export interface SearchQuery {
  id: string;
  queryText: string;
  index: string;
  filters: Record<string, string>;
  resultCount: number;
  tookMs: number;
  executedAt: string;
  userId: string | null;
  rankingProfile: string | null;
  highlightedFields: string[];
  facets: Record<string, number>;
  page: number;
  pageSize: number;
}

export interface RankingProfile {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  weights: Record<string, number>;
  boostFields: string[];
  penaltyFields: string[];
  decayFunction: string | null;
  decayScale: number | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  isActive: boolean;
}

export interface HistoryEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: HistoryAction;
  performedBy: string;
  performedAt: string;
  previousValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  description: string;
  ipAddress: string | null;
  correlationId: string | null;
}

export enum HistoryAction {
  Created = 'Created',
  Updated = 'Updated',
  Deleted = 'Deleted',
  Activated = 'Activated',
  Deactivated = 'Deactivated',
  Promoted = 'Promoted',
  RolledBack = 'RolledBack',
}

export interface DigitalTwinConfig {
  id: string;
  name: string;
  sourceEnvironment: string;
  targetEnvironment: string;
  isShadowMode: boolean;
  trafficPercentage: number;
  comparisonMetrics: string[];
  divergenceThreshold: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastSyncAt: string | null;
  divergenceCount: number;
  matchRate: number;
}

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: string;
  properties: Record<string, unknown>;
  incomingEdgeCount: number;
  outgoingEdgeCount: number;
  createdAt: string;
  updatedAt: string;
  source: string;
  confidence: number;
  isVerified: boolean;
}

export interface KnowledgeGraphEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationship: string;
  weight: number;
  properties: Record<string, unknown>;
  createdAt: string;
  source: string;
  confidence: number;
  isDirected: boolean;
}

export interface FeatureVector {
  id: string;
  entityId: string;
  entityType: string;
  featureName: string;
  dimensions: number;
  values: number[];
  version: number;
  computedAt: string;
  expiresAt: string | null;
  model: string;
  isStale: boolean;
  metadata: Record<string, string>;
}

export interface Collection {
  id: string;
  name: string;
  description: string;
  documentCount: number;
  sizeBytes: number;
  schema: Record<string, string>;
  indexedFields: string[];
  replicaCount: number;
  shardCount: number;
  status: CollectionStatus;
  createdAt: string;
  updatedAt: string;
  lastIndexedAt: string | null;
  queryCount24h: number;
}

export enum CollectionStatus {
  Active = 'Active',
  Building = 'Building',
  Rebuilding = 'Rebuilding',
  Degraded = 'Degraded',
  Offline = 'Offline',
}

export interface QualityReport {
  id: string;
  collectionId: string;
  reportType: QualityReportType;
  overallScore: number;
  metrics: QualityMetric[];
  issues: QualityIssue[];
  generatedAt: string;
  generatedBy: string;
  sampleSize: number;
  recommendations: string[];
}

export enum QualityReportType {
  Relevance = 'Relevance',
  Freshness = 'Freshness',
  Completeness = 'Completeness',
  Consistency = 'Consistency',
  Coverage = 'Coverage',
}

export interface QualityMetric {
  name: string;
  value: number;
  target: number;
  unit: string;
  isPassing: boolean;
}

export interface QualityIssue {
  severity: string;
  description: string;
  affectedDocuments: number;
  suggestedFix: string;
}

export interface LearningModel {
  id: string;
  name: string;
  modelType: string;
  version: string;
  status: LearningModelStatus;
  accuracy: number | null;
  trainedAt: string | null;
  evaluatedAt: string | null;
  promotedAt: string | null;
  trainingDataSize: number;
  featureCount: number;
  hyperparameters: Record<string, unknown>;
  metrics: Record<string, number>;
  createdBy: string;
  description: string;
  artifactUrl: string | null;
}

export enum LearningModelStatus {
  Draft = 'Draft',
  Training = 'Training',
  Trained = 'Trained',
  Evaluated = 'Evaluated',
  Approved = 'Approved',
  Active = 'Active',
  Deprecated = 'Deprecated',
  Archived = 'Archived',
}

export interface Experiment {
  id: string;
  name: string;
  description: string;
  type: ExperimentType;
  status: ExperimentStatus;
  hypothesis: string;
  controlGroup: string;
  treatmentGroup: string;
  trafficSplitPercent: number;
  primaryMetric: string;
  secondaryMetrics: string[];
  startedAt: string | null;
  endedAt: string | null;
  createdBy: string;
  conclusion: string | null;
  statisticalSignificance: number | null;
  isWinner: boolean | null;
}

export enum ExperimentType {
  ABTest = 'ABTest',
  MultiArmedBandit = 'MultiArmedBandit',
  Interleaving = 'Interleaving',
}

export enum ExperimentStatus {
  Draft = 'Draft',
  Running = 'Running',
  Paused = 'Paused',
  Completed = 'Completed',
  Cancelled = 'Cancelled',
}

export interface ChaosFault {
  id: string;
  name: string;
  targetService: string;
  faultType: string;
  severity: string;
  isActive: boolean;
  activatedAt: string | null;
  deactivatedAt: string | null;
  activatedBy: string | null;
  impactDescription: string;
  rollbackProcedure: string;
  featureFlag: string;
  metadata: Record<string, unknown>;
}

export interface GeoConfig {
  id: string;
  key: string;
  value: string;
  category: string;
  description: string;
  dataType: ConfigDataType;
  isOverridden: boolean;
  defaultValue: string;
  lastModifiedAt: string;
  lastModifiedBy: string;
  version: number;
  isSecret: boolean;
  validationRegex: string | null;
}

export enum ConfigDataType {
  String = 'String',
  Number = 'Number',
  Boolean = 'Boolean',
  Json = 'Json',
  Duration = 'Duration',
  Url = 'Url',
}

export interface GeoSetting {
  id: string;
  group: string;
  key: string;
  displayName: string;
  description: string;
  value: string;
  dataType: ConfigDataType;
  isEditable: boolean;
  requiresRestart: boolean;
  lastModifiedAt: string;
  lastModifiedBy: string;
  validValues: string[] | null;
  minValue: number | null;
  maxValue: number | null;
}
