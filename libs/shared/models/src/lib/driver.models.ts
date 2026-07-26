export interface Driver {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  status: DriverStatus;
  rating: number;
  totalTrips: number;
  vehicleId: string | null;
  cityCode: string;
  registeredAt: string;
  lastActiveAt: string | null;
  profilePictureUrl: string | null;
  isOnline: boolean;
}

export enum DriverStatus {
  PendingApproval = 'PendingApproval',
  Active = 'Active',
  Suspended = 'Suspended',
  Deactivated = 'Deactivated',
  Banned = 'Banned',
  OnTrip = 'OnTrip',
  Available = 'Available',
  Offline = 'Offline',
}

export interface DriverCompliance {
  driverId: string;
  kycStatus: KycStatus;
  insuranceVerified: boolean;
  insuranceExpiresAt: string | null;
  backgroundCheckStatus: BackgroundCheckStatus;
  backgroundCheckDate: string | null;
  licenseVerified: boolean;
  licenseExpiresAt: string | null;
  vehicleInspectionStatus: InspectionStatus;
  lastInspectionDate: string | null;
  documentsComplete: boolean;
  complianceScore: number;
}

export enum KycStatus {
  NotStarted = 'NotStarted',
  Pending = 'Pending',
  Verified = 'Verified',
  Rejected = 'Rejected',
  Expired = 'Expired',
}

export enum BackgroundCheckStatus {
  NotStarted = 'NotStarted',
  InProgress = 'InProgress',
  Passed = 'Passed',
  Failed = 'Failed',
  Expired = 'Expired',
}

export enum InspectionStatus {
  NotScheduled = 'NotScheduled',
  Scheduled = 'Scheduled',
  Passed = 'Passed',
  Failed = 'Failed',
  Overdue = 'Overdue',
}

export interface DriverPayouts {
  driverId: string;
  totalEarnings: number;
  pendingPayout: number;
  lastPayoutAmount: number;
  lastPayoutDate: string | null;
  payoutMethod: PayoutMethod;
  bankAccountLast4: string | null;
  currency: string;
  weeklyEarnings: number;
  monthlyEarnings: number;
  commissionRate: number;
}

export enum PayoutMethod {
  BankTransfer = 'BankTransfer',
  MobileWallet = 'MobileWallet',
  Cash = 'Cash',
  Check = 'Check',
}

export interface DriverKyc {
  driverId: string;
  documentType: string;
  documentNumber: string;
  issuingCountry: string;
  issuedAt: string;
  expiresAt: string;
  frontImageUrl: string;
  backImageUrl: string | null;
  selfieUrl: string | null;
  verificationStatus: KycStatus;
  rejectionReason: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
}

export interface DriverVehicle {
  id: string;
  driverId: string;
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate: string;
  vin: string | null;
  vehicleType: VehicleType;
  seatingCapacity: number;
  insurancePolicyNumber: string | null;
  registrationExpiresAt: string;
  isActive: boolean;
  photoUrl: string | null;
}

export enum VehicleType {
  Sedan = 'Sedan',
  SUV = 'SUV',
  Van = 'Van',
  Luxury = 'Luxury',
  Electric = 'Electric',
  Moto = 'Moto',
}

export interface DriverTrip {
  tripId: string;
  driverId: string;
  riderId: string;
  pickupAddress: string;
  dropoffAddress: string;
  distanceKm: number;
  durationMinutes: number;
  fareAmount: number;
  driverEarnings: number;
  commissionAmount: number;
  status: string;
  startedAt: string;
  completedAt: string | null;
  rating: number | null;
}

export interface DriverInvoice {
  id: string;
  driverId: string;
  invoiceNumber: string;
  periodStart: string;
  periodEnd: string;
  totalTrips: number;
  grossEarnings: number;
  commissionDeducted: number;
  netPayout: number;
  currency: string;
  status: InvoiceStatus;
  issuedAt: string;
  paidAt: string | null;
  downloadUrl: string | null;
}

export enum InvoiceStatus {
  Draft = 'Draft',
  Issued = 'Issued',
  Paid = 'Paid',
  Overdue = 'Overdue',
  Cancelled = 'Cancelled',
}

export interface DriverWallet {
  driverId: string;
  balance: number;
  currency: string;
  availableBalance: number;
  pendingBalance: number;
  lastTopUpAmount: number | null;
  lastTopUpDate: string | null;
  lastWithdrawalAmount: number | null;
  lastWithdrawalDate: string | null;
  isLocked: boolean;
  lockReason: string | null;
}

export interface BonDeCommande {
  id: string;
  driverId: string;
  orderNumber: string;
  vehicleDescription: string;
  amount: number;
  currency: string;
  status: BonDeCommandeStatus;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
  deliveryDate: string | null;
  notes: string | null;
  attachmentUrls: string[];
}

export enum BonDeCommandeStatus {
  Pending = 'Pending',
  Approved = 'Approved',
  Rejected = 'Rejected',
  InProgress = 'InProgress',
  Delivered = 'Delivered',
  Cancelled = 'Cancelled',
}
