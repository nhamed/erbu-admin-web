export interface PaymentEvent {
  id: string;
  tripId: string;
  riderId: string;
  driverId: string;
  type: PaymentEventType;
  amount: number;
  currency: string;
  paymentMethod: string;
  status: PaymentStatus;
  gatewayTransactionId: string | null;
  gatewayProvider: string;
  processedAt: string;
  failureReason: string | null;
  metadata: Record<string, string>;
}

export enum PaymentEventType {
  Charge = 'Charge',
  Refund = 'Refund',
  PartialRefund = 'PartialRefund',
  Chargeback = 'Chargeback',
  Payout = 'Payout',
  Adjustment = 'Adjustment',
  PromoCredit = 'PromoCredit',
}

export enum PaymentStatus {
  Pending = 'Pending',
  Processing = 'Processing',
  Completed = 'Completed',
  Failed = 'Failed',
  Refunded = 'Refunded',
  Disputed = 'Disputed',
  Cancelled = 'Cancelled',
}

export interface PaymentMonitor {
  totalTransactionsToday: number;
  totalVolumeToday: number;
  currency: string;
  failureRate: number;
  averageProcessingTimeMs: number;
  pendingPayouts: number;
  pendingPayoutsAmount: number;
  chargebackRate: number;
  fraudFlaggedCount: number;
  gatewayStatus: GatewayHealthStatus;
  lastCheckedAt: string;
  transactionsByMethod: Record<string, number>;
}

export enum GatewayHealthStatus {
  Healthy = 'Healthy',
  Degraded = 'Degraded',
  Down = 'Down',
  Unknown = 'Unknown',
}

export interface DriverVirement {
  id: string;
  driverId: string;
  driverName: string;
  amount: number;
  currency: string;
  status: VirementStatus;
  bankName: string;
  iban: string;
  bic: string;
  reference: string;
  periodStart: string;
  periodEnd: string;
  tripCount: number;
  commissionDeducted: number;
  initiatedAt: string;
  processedAt: string | null;
  failureReason: string | null;
}

export enum VirementStatus {
  Pending = 'Pending',
  Submitted = 'Submitted',
  Processing = 'Processing',
  Completed = 'Completed',
  Failed = 'Failed',
  Reversed = 'Reversed',
}

export interface PaymentAudit {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  performedBy: string;
  performedAt: string;
  previousState: Record<string, unknown>;
  newState: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
  reason: string | null;
  isAutomatic: boolean;
}
