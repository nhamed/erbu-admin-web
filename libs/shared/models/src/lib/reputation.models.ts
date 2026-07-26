export interface ReputationScore {
  entityId: string;
  entityType: ReputationEntityType;
  overallScore: number;
  safetyScore: number;
  reliabilityScore: number;
  courtesyScore: number;
  cleanlinessScore: number;
  navigationScore: number;
  totalRatings: number;
  averageRating: number;
  ratingsDistribution: Record<number, number>;
  recentTrend: ReputationTrend;
  lastCalculatedAt: string;
  tier: ReputationTier;
  badges: string[];
  warningsCount: number;
}

export enum ReputationEntityType {
  Driver = 'Driver',
  Rider = 'Rider',
}

export enum ReputationTrend {
  Improving = 'Improving',
  Stable = 'Stable',
  Declining = 'Declining',
}

export enum ReputationTier {
  Bronze = 'Bronze',
  Silver = 'Silver',
  Gold = 'Gold',
  Platinum = 'Platinum',
  Diamond = 'Diamond',
}

export interface ReputationHistory {
  id: string;
  entityId: string;
  entityType: ReputationEntityType;
  eventType: ReputationEventType;
  scoreDelta: number;
  previousScore: number;
  newScore: number;
  reason: string;
  relatedTripId: string | null;
  relatedReviewId: string | null;
  occurredAt: string;
  expiresAt: string | null;
  isDisputed: boolean;
  disputeResolution: string | null;
}

export enum ReputationEventType {
  TripCompleted = 'TripCompleted',
  RatingReceived = 'RatingReceived',
  ComplaintFiled = 'ComplaintFiled',
  ComplaintResolved = 'ComplaintResolved',
  SafetyIncident = 'SafetyIncident',
  BonusAwarded = 'BonusAwarded',
  PenaltyApplied = 'PenaltyApplied',
  TierPromotion = 'TierPromotion',
  TierDemotion = 'TierDemotion',
  ManualAdjustment = 'ManualAdjustment',
}
