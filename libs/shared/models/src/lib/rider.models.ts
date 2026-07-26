export interface Rider {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  status: RiderStatus;
  rating: number;
  totalTrips: number;
  defaultPaymentMethod: string | null;
  cityCode: string;
  registeredAt: string;
  lastTripAt: string | null;
  profilePictureUrl: string | null;
  preferredLanguage: string;
  isVip: boolean;
}

export enum RiderStatus {
  Active = 'Active',
  Suspended = 'Suspended',
  Deactivated = 'Deactivated',
  Banned = 'Banned',
  PendingVerification = 'PendingVerification',
}

export interface RiderMarketplace {
  riderId: string;
  totalSpent: number;
  currency: string;
  loyaltyPoints: number;
  loyaltyTier: LoyaltyTier;
  activePromoCodes: string[];
  referralCode: string;
  referralCount: number;
  averageTripCost: number;
  preferredVehicleType: string | null;
  lastCancelledAt: string | null;
  cancellationRate: number;
  disputeCount: number;
}

export enum LoyaltyTier {
  Bronze = 'Bronze',
  Silver = 'Silver',
  Gold = 'Gold',
  Platinum = 'Platinum',
}
