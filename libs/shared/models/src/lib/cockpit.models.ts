export interface SmokeResult {
  id: string;
  suiteName: string;
  environment: string;
  status: SmokeStatus;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationSeconds: number;
  startedAt: string;
  completedAt: string | null;
  triggeredBy: string;
  failureDetails: SmokeFailure[];
  artifactUrl: string | null;
}

export enum SmokeStatus {
  Running = 'Running',
  Passed = 'Passed',
  Failed = 'Failed',
  PartialPass = 'PartialPass',
  Aborted = 'Aborted',
}

export interface SmokeFailure {
  testName: string;
  errorMessage: string;
  stackTrace: string | null;
  screenshotUrl: string | null;
}

export interface PipelineRun {
  id: string;
  pipelineName: string;
  branch: string;
  commitSha: string;
  commitMessage: string;
  status: PipelineStatus;
  stages: PipelineStage[];
  triggeredBy: string;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  artifactUrls: string[];
  environment: string;
}

export enum PipelineStatus {
  Queued = 'Queued',
  Running = 'Running',
  Succeeded = 'Succeeded',
  Failed = 'Failed',
  Cancelled = 'Cancelled',
  WaitingApproval = 'WaitingApproval',
}

export interface PipelineStage {
  name: string;
  status: PipelineStatus;
  startedAt: string | null;
  completedAt: string | null;
  durationSeconds: number | null;
  logUrl: string | null;
}

export interface StoryItem {
  id: string;
  title: string;
  description: string;
  status: StoryStatus;
  priority: StoryPriority;
  assignee: string | null;
  epic: string | null;
  storyPoints: number | null;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  acceptanceCriteria: string[];
  blockedBy: string[];
}

export enum StoryStatus {
  Inbox = 'Inbox',
  Backlog = 'Backlog',
  Ready = 'Ready',
  InProgress = 'InProgress',
  InReview = 'InReview',
  Done = 'Done',
  Archived = 'Archived',
}

export enum StoryPriority {
  Critical = 'Critical',
  High = 'High',
  Medium = 'Medium',
  Low = 'Low',
}

export interface PlannerTrip {
  id: string;
  scenarioId: string;
  origin: string;
  destination: string;
  departureTime: string;
  vehicleType: string;
  expectedDurationMinutes: number;
  expectedDistanceKm: number;
  expectedFare: number;
  surgeMultiplier: number;
  routePolyline: string;
  isRoundTrip: boolean;
  passengerCount: number;
}

export interface AuditScenario {
  id: string;
  name: string;
  description: string;
  category: string;
  status: AuditStatus;
  steps: AuditStep[];
  expectedOutcome: string;
  actualOutcome: string | null;
  createdAt: string;
  executedAt: string | null;
  executedBy: string | null;
  baselineId: string | null;
  tags: string[];
}

export enum AuditStatus {
  Draft = 'Draft',
  Ready = 'Ready',
  Running = 'Running',
  Passed = 'Passed',
  Failed = 'Failed',
  Blocked = 'Blocked',
}

export interface AuditStep {
  order: number;
  action: string;
  expectedResult: string;
  actualResult: string | null;
  status: AuditStatus;
  screenshotUrl: string | null;
}

export interface AuditBaseline {
  id: string;
  scenarioId: string;
  name: string;
  capturedAt: string;
  capturedBy: string;
  snapshotData: Record<string, unknown>;
  checksumSha256: string;
  isActive: boolean;
  version: number;
  notes: string | null;
}

export interface AuditDiscrepancy {
  id: string;
  scenarioId: string;
  scenarioName: string;
  field: string;
  expectedValue: string;
  actualValue: string;
  severity: DiscrepancySeverity;
  fixSuggestion: string | null;
  detectedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  snapshotJson: Record<string, unknown> | null;
}

export enum DiscrepancySeverity {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Critical = 'Critical',
}

export interface AuditCaptureConfig {
  id: string;
  mode: CaptureMode;
  isEnabled: boolean;
  filterPattern: string;
  scheduleExpression: string | null;
  retentionDays: number;
  maxSnapshotsPerRun: number;
  captureHeaders: boolean;
  capturePayloads: boolean;
  captureTimings: boolean;
  updatedAt: string;
  updatedBy: string;
}

export enum CaptureMode {
  Off = 'Off',
  Passive = 'Passive',
  Active = 'Active',
  Full = 'Full',
}

export interface AuditMissionControlStatus {
  overallHealth: AuditHealthState;
  activeScenariosCount: number;
  passedLast24h: number;
  failedLast24h: number;
  openDiscrepancies: number;
  lastRunAt: string | null;
  tunnelStatus: TunnelState;
  captureMode: CaptureMode;
  baselinesDriftDetected: number;
  agentStatuses: AuditAgentStatus[];
}

export enum AuditHealthState {
  Green = 'Green',
  Yellow = 'Yellow',
  Red = 'Red',
  Unknown = 'Unknown',
}

export enum TunnelState {
  Connected = 'Connected',
  Disconnected = 'Disconnected',
  Connecting = 'Connecting',
  Error = 'Error',
}

export interface AuditAgentStatus {
  agentId: string;
  name: string;
  status: AuditHealthState;
  lastHeartbeat: string;
  scenariosAssigned: number;
}

export interface AuditTunnel {
  id: string;
  name: string;
  localPort: number;
  remoteHost: string;
  remotePort: number;
  state: TunnelState;
  openedAt: string | null;
  bytesTransferred: number;
  errorMessage: string | null;
}

export interface BaselineDriftPoint {
  timestamp: string;
  baselineId: string;
  baselineName: string;
  driftPercent: number;
  fieldCount: number;
  driftedFields: number;
}

export interface BaselineComparison {
  baselineId: string;
  baselineName: string;
  comparedAt: string;
  totalFields: number;
  matchedFields: number;
  driftedFields: DriftedField[];
  overallDriftPercent: number;
}

export interface DriftedField {
  fieldPath: string;
  baselineValue: string;
  currentValue: string;
  driftMagnitude: number;
}

export interface CoverageReport {
  id: string;
  projectName: string;
  branch: string;
  commitSha: string;
  totalLines: number;
  coveredLines: number;
  lineCoveragePercent: number;
  totalBranches: number;
  coveredBranches: number;
  branchCoveragePercent: number;
  totalFunctions: number;
  coveredFunctions: number;
  functionCoveragePercent: number;
  generatedAt: string;
  reportUrl: string | null;
  uncoveredFiles: CoverageFile[];
}

export interface CoverageFile {
  filePath: string;
  lineCoveragePercent: number;
  uncoveredLineRanges: string[];
}

export interface E2ETestRun {
  id: string;
  suiteName: string;
  platform: E2EPlatform;
  deviceName: string;
  osVersion: string;
  status: SmokeStatus;
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  durationSeconds: number;
  startedAt: string;
  completedAt: string | null;
  videoUrl: string | null;
  logUrl: string | null;
  failedTests: E2EFailedTest[];
}

export enum E2EPlatform {
  Android = 'Android',
  iOS = 'iOS',
  Web = 'Web',
}

export interface E2EFailedTest {
  testName: string;
  errorMessage: string;
  screenshotUrl: string | null;
  step: string;
}

export interface DeviceInstance {
  id: string;
  name: string;
  platform: E2EPlatform;
  osVersion: string;
  status: DeviceStatus;
  isPhysical: boolean;
  resolution: string;
  assignedToRunId: string | null;
  lastUsedAt: string | null;
  provisionedAt: string;
  tags: string[];
}

export enum DeviceStatus {
  Available = 'Available',
  InUse = 'InUse',
  Offline = 'Offline',
  Maintenance = 'Maintenance',
  Error = 'Error',
}

export interface ChaosExperiment {
  id: string;
  name: string;
  description: string;
  targetService: string;
  faultType: ChaosType;
  severity: ChaosSeverity;
  status: ChaosStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number;
  rollbackOnFailure: boolean;
  hypothesis: string;
  actualResult: string | null;
  createdBy: string;
  approvedBy: string | null;
}

export enum ChaosType {
  NetworkLatency = 'NetworkLatency',
  NetworkPartition = 'NetworkPartition',
  ServiceKill = 'ServiceKill',
  CpuStress = 'CpuStress',
  MemoryStress = 'MemoryStress',
  DiskFill = 'DiskFill',
  DnsFailure = 'DnsFailure',
  ClockSkew = 'ClockSkew',
}

export enum ChaosSeverity {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
  Critical = 'Critical',
}

export enum ChaosStatus {
  Draft = 'Draft',
  Approved = 'Approved',
  Scheduled = 'Scheduled',
  Running = 'Running',
  Completed = 'Completed',
  RolledBack = 'RolledBack',
  Cancelled = 'Cancelled',
}

export interface ReplayDiff {
  id: string;
  tripId: string;
  baselineReplayId: string;
  comparisonReplayId: string;
  distanceDeltaKm: number;
  durationDeltaSeconds: number;
  fareDeltaAmount: number;
  routeDeviationPercent: number;
  waypointMismatches: number;
  generatedAt: string;
  verdict: DiffVerdict;
  details: string;
}

export enum DiffVerdict {
  Match = 'Match',
  MinorDifference = 'MinorDifference',
  SignificantDifference = 'SignificantDifference',
  Mismatch = 'Mismatch',
}

export interface ScenarioNode {
  id: string;
  scenarioId: string;
  type: ScenarioNodeType;
  label: string;
  x: number;
  y: number;
  config: Record<string, unknown>;
  isEntryPoint: boolean;
  isTerminal: boolean;
  status: string | null;
}

export enum ScenarioNodeType {
  Action = 'Action',
  Condition = 'Condition',
  Wait = 'Wait',
  Assert = 'Assert',
  Loop = 'Loop',
  Parallel = 'Parallel',
  SubScenario = 'SubScenario',
}

export interface ScenarioEdge {
  id: string;
  scenarioId: string;
  sourceNodeId: string;
  targetNodeId: string;
  label: string | null;
  condition: string | null;
  order: number;
}
