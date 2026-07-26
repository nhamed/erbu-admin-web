import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

// ---------- Enums ----------

export type DriverStatus = 'Active' | 'Suspended' | 'PendingVerification' | 'Inactive' | 'Banned';
export type ComplianceStatus = 'Compliant' | 'NonCompliant' | 'PendingReview' | 'Expired';
export type KycStatus = 'Pending' | 'Approved' | 'Rejected' | 'RequiresResubmission';
export type PayoutStatus = 'Pending' | 'Completed' | 'Failed' | 'OnHold';
export type TripStatus = 'Completed' | 'InProgress' | 'Cancelled' | 'Disputed';
export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue' | 'Voided';
export type PaymentEventType = 'Charge' | 'Refund' | 'Payout' | 'Adjustment' | 'Fee';
export type WalletTransactionType = 'Credit' | 'Debit' | 'TopUp' | 'Withdrawal' | 'Bonus';
export type MarketplaceStatus = 'Available' | 'OnTrip' | 'Offline' | 'Break';

// ---------- DTOs ----------

export interface DriverSummary {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: DriverStatus;
  complianceStatus: ComplianceStatus;
  city: string;
  rating: number;
  totalTrips: number;
  createdAt: string;
  lastActiveAt: string;
  avatarUrl: string | null;
}

export interface DriverDetail {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  status: DriverStatus;
  rating: number;
  totalTrips: number;
  totalEarnings: number;
  currency: string;
  createdAt: string;
  lastActiveAt: string;
  avatarUrl: string | null;
  notes: string;
}

export interface ComplianceDocument {
  id: string;
  type: string;
  name: string;
  status: ComplianceStatus;
  issuedAt: string;
  expiresAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  documentUrl: string;
  rejectionReason: string | null;
}

export interface DriverCompliance {
  driverId: string;
  overallStatus: ComplianceStatus;
  documents: ComplianceDocument[];
  lastAuditAt: string | null;
  nextAuditDueAt: string | null;
}

export interface Payout {
  id: string;
  driverId: string;
  amount: number;
  currency: string;
  status: PayoutStatus;
  method: string;
  reference: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  paidAt: string | null;
  failureReason: string | null;
}

export interface MarketplaceEntry {
  id: string;
  driverId: string;
  zone: string;
  status: MarketplaceStatus;
  acceptanceRate: number;
  cancellationRate: number;
  avgResponseTimeMs: number;
  surgeMultiplier: number;
  priorityScore: number;
  lastUpdatedAt: string;
}

export interface DriverTrip {
  id: string;
  tripNumber: string;
  riderName: string;
  pickupAddress: string;
  dropoffAddress: string;
  status: TripStatus;
  fareAmount: number;
  currency: string;
  distanceKm: number;
  durationMinutes: number;
  requestedAt: string;
  completedAt: string | null;
  rating: number | null;
}

export interface PaymentEvent {
  id: string;
  driverId: string;
  type: PaymentEventType;
  amount: number;
  currency: string;
  description: string;
  reference: string;
  createdAt: string;
  tripId: string | null;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  driverId: string;
  amount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  status: InvoiceStatus;
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
  periodStart: string;
  periodEnd: string;
}

export interface TariffAssignment {
  id: string;
  driverId: string;
  tariffName: string;
  tariffId: string;
  baseFare: number;
  perKmRate: number;
  perMinuteRate: number;
  minimumFare: number;
  currency: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
}

export interface DriverCreation {
  driverId: string;
  createdAt: string;
  createdBy: string;
  source: string;
  onboardingSteps: OnboardingStep[];
  referralCode: string | null;
  referredBy: string | null;
}

export interface OnboardingStep {
  name: string;
  status: 'Completed' | 'Pending' | 'Skipped';
  completedAt: string | null;
}

export interface WalletInfo {
  driverId: string;
  balance: number;
  currency: string;
  holdAmount: number;
  availableBalance: number;
  lastTransactionAt: string | null;
  transactions: WalletTransaction[];
}

export interface WalletTransaction {
  id: string;
  type: WalletTransactionType;
  amount: number;
  currency: string;
  description: string;
  balanceAfter: number;
  createdAt: string;
  reference: string | null;
}

export interface KycInfo {
  driverId: string;
  status: KycStatus;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  identityVerified: boolean;
  addressVerified: boolean;
  backgroundCheckPassed: boolean | null;
  documents: KycDocument[];
  rejectionReason: string | null;
}

export interface KycDocument {
  id: string;
  type: string;
  name: string;
  status: KycStatus;
  uploadedAt: string;
  reviewedAt: string | null;
  documentUrl: string;
  rejectionReason: string | null;
}

export interface VehicleInfo {
  id: string;
  driverId: string;
  make: string;
  model: string;
  year: number;
  color: string;
  licensePlate: string;
  vin: string;
  registrationExpiry: string;
  insuranceExpiry: string;
  inspectionExpiry: string;
  vehicleType: string;
  seatingCapacity: number;
  isActive: boolean;
  documents: VehicleDocument[];
}

export interface VehicleDocument {
  id: string;
  type: string;
  name: string;
  expiresAt: string;
  documentUrl: string;
  isValid: boolean;
}

export interface DriverListFilter {
  search?: string;
  status?: DriverStatus;
  complianceStatus?: ComplianceStatus;
  city?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface BulkActionResult {
  succeeded: string[];
  failed: { id: string; reason: string }[];
}

// ---------- Service ----------

const API_BASE = '/api/admin/drivers';

@Injectable({ providedIn: 'root' })
export class DriverManagementService {
  private readonly http = inject(HttpClient);

  // ---------- Driver List ----------

  getDrivers(filter: DriverListFilter): Observable<PaginatedResult<DriverSummary>> {
    let params = new HttpParams();
    if (filter.search) params = params.set('search', filter.search);
    if (filter.status) params = params.set('status', filter.status);
    if (filter.complianceStatus) params = params.set('complianceStatus', filter.complianceStatus);
    if (filter.city) params = params.set('city', filter.city);
    if (filter.page != null) params = params.set('page', filter.page);
    if (filter.pageSize != null) params = params.set('pageSize', filter.pageSize);
    if (filter.sortBy) params = params.set('sortBy', filter.sortBy);
    if (filter.sortDirection) params = params.set('sortDirection', filter.sortDirection);
    return this.http.get<PaginatedResult<DriverSummary>>(API_BASE, { params });
  }

  getDriver(id: string): Observable<DriverDetail> {
    return this.http.get<DriverDetail>(`${API_BASE}/${id}`);
  }

  // ---------- Actions ----------

  activateDriver(id: string): Observable<void> {
    return this.http.post<void>(`${API_BASE}/${id}/activate`, {});
  }

  suspendDriver(id: string, reason: string): Observable<void> {
    return this.http.post<void>(`${API_BASE}/${id}/suspend`, { reason });
  }

  verifyDriver(id: string): Observable<void> {
    return this.http.post<void>(`${API_BASE}/${id}/verify`, {});
  }

  // ---------- Bulk Actions ----------

  bulkActivate(ids: string[]): Observable<BulkActionResult> {
    return this.http.post<BulkActionResult>(`${API_BASE}/bulk/activate`, { driverIds: ids });
  }

  bulkSuspend(ids: string[], reason: string): Observable<BulkActionResult> {
    return this.http.post<BulkActionResult>(`${API_BASE}/bulk/suspend`, { driverIds: ids, reason });
  }

  // ---------- Compliance ----------

  getCompliance(driverId: string): Observable<DriverCompliance> {
    return this.http.get<DriverCompliance>(`${API_BASE}/${driverId}/compliance`);
  }

  approveComplianceDocument(driverId: string, documentId: string): Observable<void> {
    return this.http.post<void>(`${API_BASE}/${driverId}/compliance/${documentId}/approve`, {});
  }

  rejectComplianceDocument(driverId: string, documentId: string, reason: string): Observable<void> {
    return this.http.post<void>(`${API_BASE}/${driverId}/compliance/${documentId}/reject`, { reason });
  }

  // ---------- Payouts ----------

  getPayouts(driverId: string, page = 1, pageSize = 20): Observable<PaginatedResult<Payout>> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<PaginatedResult<Payout>>(`${API_BASE}/${driverId}/payouts`, { params });
  }

  retryPayout(driverId: string, payoutId: string): Observable<void> {
    return this.http.post<void>(`${API_BASE}/${driverId}/payouts/${payoutId}/retry`, {});
  }

  // ---------- Marketplace ----------

  getMarketplace(driverId: string): Observable<MarketplaceEntry[]> {
    return this.http.get<MarketplaceEntry[]>(`${API_BASE}/${driverId}/marketplace`);
  }

  // ---------- Trips ----------

  getTrips(driverId: string, page = 1, pageSize = 20): Observable<PaginatedResult<DriverTrip>> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<PaginatedResult<DriverTrip>>(`${API_BASE}/${driverId}/trips`, { params });
  }

  // ---------- Payment Events ----------

  getPaymentEvents(driverId: string, page = 1, pageSize = 20): Observable<PaginatedResult<PaymentEvent>> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<PaginatedResult<PaymentEvent>>(`${API_BASE}/${driverId}/payment-events`, { params });
  }

  // ---------- Invoices ----------

  getInvoices(driverId: string, page = 1, pageSize = 20): Observable<PaginatedResult<Invoice>> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<PaginatedResult<Invoice>>(`${API_BASE}/${driverId}/invoices`, { params });
  }

  // ---------- Tariff ----------

  getTariffs(driverId: string): Observable<TariffAssignment[]> {
    return this.http.get<TariffAssignment[]>(`${API_BASE}/${driverId}/tariffs`);
  }

  assignTariff(driverId: string, tariffId: string): Observable<void> {
    return this.http.post<void>(`${API_BASE}/${driverId}/tariffs`, { tariffId });
  }

  // ---------- Creation / Onboarding ----------

  getCreationInfo(driverId: string): Observable<DriverCreation> {
    return this.http.get<DriverCreation>(`${API_BASE}/${driverId}/creation`);
  }

  // ---------- Wallet ----------

  getWallet(driverId: string): Observable<WalletInfo> {
    return this.http.get<WalletInfo>(`${API_BASE}/${driverId}/wallet`);
  }

  adjustWalletBalance(driverId: string, amount: number, reason: string): Observable<void> {
    return this.http.post<void>(`${API_BASE}/${driverId}/wallet/adjust`, { amount, reason });
  }

  // ---------- KYC ----------

  getKyc(driverId: string): Observable<KycInfo> {
    return this.http.get<KycInfo>(`${API_BASE}/${driverId}/kyc`);
  }

  approveKyc(driverId: string): Observable<void> {
    return this.http.post<void>(`${API_BASE}/${driverId}/kyc/approve`, {});
  }

  rejectKyc(driverId: string, reason: string): Observable<void> {
    return this.http.post<void>(`${API_BASE}/${driverId}/kyc/reject`, { reason });
  }

  requestKycResubmission(driverId: string, reason: string): Observable<void> {
    return this.http.post<void>(`${API_BASE}/${driverId}/kyc/request-resubmission`, { reason });
  }

  // ---------- Vehicle ----------

  getVehicle(driverId: string): Observable<VehicleInfo> {
    return this.http.get<VehicleInfo>(`${API_BASE}/${driverId}/vehicle`);
  }

  updateVehicle(driverId: string, data: Partial<VehicleInfo>): Observable<VehicleInfo> {
    return this.http.patch<VehicleInfo>(`${API_BASE}/${driverId}/vehicle`, data);
  }

  // ---------- Cities (for filters) ----------

  getCities(): Observable<string[]> {
    return this.http.get<string[]>(`${API_BASE}/cities`);
  }
}
