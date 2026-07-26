import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';
import { catchError, delay } from 'rxjs/operators';

// ── Helpers ──
const uuid = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
const ts = (h = 0, m = 0) => `2026-07-26T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;
const pastTs = (daysAgo: number) => {
  const d = new Date('2026-07-26T12:00:00Z');
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
};

function matchUrl(url: string, pattern: string): boolean {
  const cleanUrl = url.split('?')[0];
  const regex = new RegExp('^.*' + pattern.replace(/\{[^}]+\}/g, '[^/]+') + '$');
  return regex.test(cleanUrl);
}

interface MockRoute {
  method: string;
  pattern: string;
  response: unknown | ((url: string) => unknown);
}

function findMockResponse(method: string, url: string): unknown | null {
  for (const route of MOCK_ROUTES) {
    if (route.method === method && matchUrl(url, route.pattern)) {
      return typeof route.response === 'function' ? route.response(url) : route.response;
    }
  }
  return null;
}

// ════════════════════════════════════════════════════════════════
// 1. DRIVER MANAGEMENT
// ════════════════════════════════════════════════════════════════

const DRIVER_CITIES = ['Tunis', 'Sfax', 'Sousse', 'Bizerte', 'Kairouan', 'Gabès', 'Monastir', 'Nabeul'];

const DRIVER_NAMES = [
  { first: 'Mohamed', last: 'Ben Ali' },
  { first: 'Ahmed', last: 'Trabelsi' },
  { first: 'Youssef', last: 'Bouazizi' },
  { first: 'Sami', last: 'Gharbi' },
  { first: 'Karim', last: 'Hammami' },
  { first: 'Nabil', last: 'Meddeb' },
  { first: 'Riadh', last: 'Jebali' },
  { first: 'Fathi', last: 'Chaabane' },
  { first: 'Walid', last: 'Sfar' },
  { first: 'Bilel', last: 'Souissi' },
  { first: 'Hichem', last: 'Amri' },
  { first: 'Tarek', last: 'Khemiri' },
  { first: 'Slim', last: 'Bennour' },
  { first: 'Maher', last: 'Dridi' },
  { first: 'Anouar', last: 'Riahi' },
];

const DRIVER_STATUSES = ['Active', 'Active', 'Suspended', 'PendingVerification', 'Active', 'Active', 'Active', 'Inactive', 'Active', 'Active', 'Active', 'Banned', 'Active', 'Active', 'Active'];
const COMPLIANCE_STATUSES = ['Compliant', 'Compliant', 'NonCompliant', 'PendingReview', 'Compliant', 'Compliant', 'Expired', 'Compliant', 'Compliant', 'Compliant', 'Compliant', 'Compliant', 'Compliant', 'PendingReview', 'Compliant'];

const MOCK_DRIVERS = Array.from({ length: 15 }, (_, i) => ({
  id: uuid(100 + i),
  firstName: DRIVER_NAMES[i].first,
  lastName: DRIVER_NAMES[i].last,
  email: `${DRIVER_NAMES[i].first.toLowerCase()}.${DRIVER_NAMES[i].last.toLowerCase().replace(' ', '')}@erbu.tn`,
  phone: `+216 ${20 + i} ${String(100 + i * 7).padStart(3, '0')} ${String(200 + i * 13).padStart(3, '0')}`,
  status: DRIVER_STATUSES[i],
  complianceStatus: COMPLIANCE_STATUSES[i],
  city: DRIVER_CITIES[i % DRIVER_CITIES.length],
  rating: +(4.0 + (i % 10) * 0.1).toFixed(1),
  totalTrips: 120 + i * 47,
  createdAt: pastTs(180 + i * 10),
  lastActiveAt: pastTs(i % 5),
  avatarUrl: null,
}));

const MOCK_DRIVERS_LIST = {
  items: MOCK_DRIVERS,
  totalCount: MOCK_DRIVERS.length,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};

const MOCK_DRIVER_DETAIL = {
  ...MOCK_DRIVERS[0],
  dateOfBirth: '1990-05-15',
  address: 'Avenue Habib Bourguiba, Apt 4B, Tunis',
  postalCode: '1000',
  country: 'Tunisie',
  totalEarnings: 32450.750,
  currency: 'TND',
  notes: '',
};

const MOCK_DRIVER_COMPLIANCE = {
  driverId: uuid(100),
  driverName: 'Mohamed Ben Ali',
  overallStatus: 'Compliant',
  documents: [
    { id: uuid(200), type: 'DriversLicense', status: 'Verified', issuedAt: pastTs(365), expiresAt: '2028-05-15T00:00:00Z', documentUrl: null, verifiedAt: pastTs(170), verifiedBy: 'System' },
    { id: uuid(201), type: 'VehicleRegistration', status: 'Verified', issuedAt: pastTs(300), expiresAt: '2027-12-01T00:00:00Z', documentUrl: null, verifiedAt: pastTs(170), verifiedBy: 'System' },
    { id: uuid(202), type: 'Insurance', status: 'Verified', issuedAt: pastTs(200), expiresAt: '2027-07-01T00:00:00Z', documentUrl: null, verifiedAt: pastTs(170), verifiedBy: 'System' },
    { id: uuid(203), type: 'BackgroundCheck', status: 'Verified', issuedAt: pastTs(180), expiresAt: '2027-01-15T00:00:00Z', documentUrl: null, verifiedAt: pastTs(170), verifiedBy: 'Admin' },
  ],
  lastReviewedAt: pastTs(5),
  nextReviewDate: '2026-08-15T00:00:00Z',
};

const MOCK_DRIVER_PAYOUTS = {
  items: Array.from({ length: 10 }, (_, i) => ({
    id: uuid(300 + i),
    driverId: uuid(100),
    amount: +(150 + i * 45.5).toFixed(2),
    currency: 'TND',
    status: i < 8 ? 'Completed' : 'Pending',
    method: 'BankTransfer',
    reference: `PAY-2026-${String(1000 + i)}`,
    periodStart: pastTs(30 + i * 7),
    periodEnd: pastTs(23 + i * 7),
    tripCount: 25 + i * 3,
    commissionDeducted: +(30 + i * 9.1).toFixed(2),
    processedAt: i < 8 ? pastTs(22 + i * 7) : null,
    createdAt: pastTs(23 + i * 7),
  })),
  totalCount: 10,
  page: 1,
  pageSize: 20,
};

const MOCK_DRIVER_MARKETPLACE = {
  driverId: uuid(100),
  driverName: 'Mohamed Ben Ali',
  isOnline: true,
  isOnTrip: false,
  latitude: 36.8065,
  longitude: 10.1815,
  currentZone: 'Centre-ville',
  vehicleType: 'Sedan',
  rating: 4.5,
  earningsToday: 85.500,
  tripsToday: 7,
  currency: 'TND',
  connectedSince: ts(7, 30),
  acceptanceRate: 92.5,
  cancellationRate: 3.2,
};

const MOCK_DRIVER_TRIPS = {
  items: Array.from({ length: 12 }, (_, i) => ({
    id: uuid(400 + i),
    tripNumber: `TRP-${2026}${String(1000 + i)}`,
    riderName: `Amira Ben Youssef`,
    status: i < 10 ? 'completed' : i === 10 ? 'cancelled-rider' : 'in-progress',
    pickupAddress: 'Avenue Habib Bourguiba, Tunis',
    dropoffAddress: 'La Marsa Centre',
    fareAmount: +(8.5 + i * 2.3).toFixed(2),
    currency: 'TND',
    distanceKm: +(3.2 + i * 1.1).toFixed(1),
    durationMinutes: 12 + i * 3,
    rating: i < 10 ? 4 + (i % 2) : null,
    requestedAt: pastTs(i * 2),
    completedAt: i < 10 ? pastTs(i * 2) : null,
    paymentMethod: i % 2 === 0 ? 'Card' : 'Cash',
  })),
  totalCount: 12,
  page: 1,
  pageSize: 20,
};

const MOCK_DRIVER_PAYMENT_EVENTS = {
  items: Array.from({ length: 8 }, (_, i) => ({
    id: uuid(450 + i),
    tripId: uuid(400 + i),
    riderId: uuid(500),
    driverId: uuid(100),
    type: i % 3 === 0 ? 'Payout' : 'Charge',
    amount: +(8.5 + i * 2.3).toFixed(2),
    currency: 'TND',
    paymentMethod: i % 2 === 0 ? 'Card' : 'Cash',
    status: 'Completed',
    gatewayTransactionId: `GW-${uuid(700 + i)}`,
    gatewayProvider: 'Stripe',
    processedAt: pastTs(i * 2),
    failureReason: null,
    metadata: {},
  })),
  totalCount: 8,
  page: 1,
  pageSize: 20,
};

const MOCK_DRIVER_INVOICES = {
  items: Array.from({ length: 6 }, (_, i) => ({
    id: uuid(460 + i),
    invoiceNumber: `INV-2026-${String(100 + i)}`,
    driverId: uuid(100),
    amount: +(250 + i * 75).toFixed(2),
    currency: 'TND',
    status: i < 5 ? 'Paid' : 'Pending',
    issuedAt: pastTs(30 + i * 30),
    dueAt: pastTs(i * 30),
    paidAt: i < 5 ? pastTs(1 + i * 30) : null,
    periodStart: pastTs(60 + i * 30),
    periodEnd: pastTs(30 + i * 30),
    items: [
      { description: 'Commission sur courses', amount: +(200 + i * 60).toFixed(2) },
      { description: 'Frais de service', amount: +(50 + i * 15).toFixed(2) },
    ],
  })),
  totalCount: 6,
  page: 1,
  pageSize: 20,
};

const MOCK_DRIVER_TARIFFS = [
  { id: uuid(470), tariffName: 'Standard Tunis', vehicleType: 'Sedan', baseFare: 2.5, perKm: 0.8, perMinute: 0.15, minimumFare: 3.0, currency: 'TND', effectiveFrom: pastTs(90), effectiveTo: null, zone: 'Tunis' },
  { id: uuid(471), tariffName: 'Nuit Tunis', vehicleType: 'Sedan', baseFare: 3.5, perKm: 1.2, perMinute: 0.2, minimumFare: 5.0, currency: 'TND', effectiveFrom: pastTs(90), effectiveTo: null, zone: 'Tunis' },
];

const MOCK_DRIVER_CREATION = {
  driverId: uuid(100),
  applicationDate: pastTs(200),
  approvalDate: pastTs(180),
  approvedBy: 'Admin System',
  onboardingStatus: 'Completed',
  steps: [
    { name: 'Registration', status: 'Completed', completedAt: pastTs(200) },
    { name: 'Document Upload', status: 'Completed', completedAt: pastTs(195) },
    { name: 'Background Check', status: 'Completed', completedAt: pastTs(185) },
    { name: 'Vehicle Inspection', status: 'Completed', completedAt: pastTs(182) },
    { name: 'Training', status: 'Completed', completedAt: pastTs(181) },
    { name: 'Activation', status: 'Completed', completedAt: pastTs(180) },
  ],
};

const MOCK_DRIVER_WALLET = {
  driverId: uuid(100),
  balance: 1245.750,
  currency: 'TND',
  pendingBalance: 85.500,
  totalEarnings: 32450.750,
  totalWithdrawals: 31120.000,
  lastWithdrawalAt: pastTs(3),
  bankAccount: { bankName: 'BIAT', iban: 'TN59 1000 6035 1835 9847 8831', bic: 'BIATTNTT', verified: true },
  recentTransactions: Array.from({ length: 5 }, (_, i) => ({
    id: uuid(480 + i),
    type: i % 2 === 0 ? 'Credit' : 'Debit',
    amount: +(25 + i * 15).toFixed(2),
    description: i % 2 === 0 ? 'Trip earnings' : 'Withdrawal',
    createdAt: pastTs(i),
    balanceAfter: +(1245.75 - i * 50).toFixed(2),
  })),
};

const MOCK_DRIVER_KYC = {
  driverId: uuid(100),
  status: 'Verified',
  level: 'Full',
  submittedAt: pastTs(180),
  verifiedAt: pastTs(175),
  verifiedBy: 'KYC System',
  documents: [
    { type: 'NationalId', status: 'Verified', submittedAt: pastTs(180), verifiedAt: pastTs(178) },
    { type: 'ProofOfAddress', status: 'Verified', submittedAt: pastTs(180), verifiedAt: pastTs(177) },
    { type: 'Selfie', status: 'Verified', submittedAt: pastTs(180), verifiedAt: pastTs(176) },
  ],
  riskScore: 12,
  riskLevel: 'Low',
};

const MOCK_DRIVER_VEHICLE = {
  driverId: uuid(100),
  vehicleId: uuid(490),
  make: 'Peugeot',
  model: '308',
  year: 2022,
  color: 'Blanc',
  plateNumber: '220 TU 4567',
  vehicleType: 'Sedan',
  seats: 4,
  registrationExpiry: '2027-06-30T00:00:00Z',
  insuranceExpiry: '2027-03-15T00:00:00Z',
  inspectionExpiry: '2027-01-10T00:00:00Z',
  status: 'Active',
  photos: [],
};

// ════════════════════════════════════════════════════════════════
// 2. RIDER MANAGEMENT
// ════════════════════════════════════════════════════════════════

const RIDER_NAMES = [
  'Amira Ben Youssef', 'Leila Hammami', 'Fatma Trabelsi', 'Nour El Houda Sfar',
  'Sara Chaabane', 'Ines Jebali', 'Mariem Meddeb', 'Rania Bouazizi',
  'Hajer Gharbi', 'Olfa Dridi', 'Asma Khemiri', 'Sana Bennour',
];

const RIDER_STATUSES = ['Active', 'Active', 'Active', 'Inactive', 'Active', 'Active', 'Suspended', 'Active', 'Active', 'PendingVerification', 'Active', 'Active'];

const MOCK_RIDERS = Array.from({ length: 12 }, (_, i) => ({
  id: uuid(500 + i),
  fullName: RIDER_NAMES[i],
  email: `${RIDER_NAMES[i].split(' ')[0].toLowerCase()}@gmail.com`,
  phone: `+216 ${50 + i} ${String(300 + i * 11).padStart(3, '0')} ${String(400 + i * 17).padStart(3, '0')}`,
  status: RIDER_STATUSES[i],
  rating: +(4.3 + (i % 7) * 0.1).toFixed(1),
  totalTrips: 30 + i * 12,
  joinedAt: pastTs(200 + i * 15),
  lastActiveAt: pastTs(i % 4),
  preferredPayment: i % 3 === 0 ? 'Cash' : i % 3 === 1 ? 'Card' : 'Wallet',
  avatarUrl: null,
  city: DRIVER_CITIES[i % DRIVER_CITIES.length],
  verificationComplete: RIDER_STATUSES[i] !== 'PendingVerification',
}));

const MOCK_RIDERS_LIST = {
  items: MOCK_RIDERS,
  total: MOCK_RIDERS.length,
  page: 1,
  pageSize: 20,
};

const MOCK_RIDER_DETAIL = {
  ...MOCK_RIDERS[0],
  dateOfBirth: '1995-03-20',
  address: 'Rue de Marseille, Apt 7, Tunis',
  postalCode: '1000',
  totalSpent: 2340.500,
  currency: 'TND',
  savedAddresses: [
    { label: 'Maison', address: 'Rue Ibn Khaldoun 42, Tunis', lat: 36.8028, lng: 10.1797 },
    { label: 'Travail', address: 'Lac 2, Tunis', lat: 36.8325, lng: 10.2330 },
  ],
  paymentMethods: [
    { id: uuid(550), type: 'Card', last4: '4532', brand: 'Visa', isDefault: true },
    { id: uuid(551), type: 'Cash', last4: null, brand: null, isDefault: false },
  ],
};

const MOCK_MARKETPLACE_RIDERS = {
  items: MOCK_RIDERS.slice(0, 8).map((r, i) => ({
    ...r,
    isActive: i < 6,
    lastRequestAt: pastTs(i),
    pendingRequest: i < 2,
  })),
  total: 8,
  page: 1,
  pageSize: 20,
};

// ════════════════════════════════════════════════════════════════
// 3. PAYMENT MONITOR
// ════════════════════════════════════════════════════════════════

const PAYMENT_VOLUME_HISTORY = Array.from({ length: 30 }, (_, i) => ({
  timestamp: pastTs(29 - i),
  volume: +(800 + Math.sin(i * 0.5) * 300 + i * 20).toFixed(2),
  count: 80 + Math.floor(Math.sin(i * 0.5) * 30 + i * 2),
  failureRate: +(0.5 + Math.random() * 1.5).toFixed(2),
}));

const MOCK_PAYMENT_DASHBOARD = {
  kpi: {
    totalVolume: 45230.5,
    totalVolumeChange: 5.2,
    pendingCount: 15,
    pendingCountChange: -2,
    failedCount: 3,
    failedCountChange: 1,
    successRate: 97.8,
    successRateChange: 0.3,
    currency: 'TND',
  },
  monitor: {
    totalTransactionsToday: 342,
    totalVolumeToday: 3210.75,
    currency: 'TND',
    failureRate: 0.8,
    averageProcessingTimeMs: 245,
    pendingPayouts: 12,
    pendingPayoutsAmount: 12450.0,
    chargebackRate: 0.1,
    fraudFlaggedCount: 2,
    gatewayStatus: 'Healthy',
    lastCheckedAt: ts(14, 30),
    transactionsByMethod: { Card: 180, Cash: 120, Wallet: 42 },
  },
  volumeHistory: PAYMENT_VOLUME_HISTORY,
};

const PAYMENT_METHODS = ['Card', 'Cash', 'Wallet', 'Card', 'Card', 'Cash', 'Card', 'Wallet', 'Card', 'Cash'];
const PAYMENT_TYPES = ['Charge', 'Charge', 'Charge', 'Refund', 'Charge', 'Payout', 'Charge', 'Charge', 'Charge', 'Refund'];
const PAYMENT_EVENT_STATUSES = ['Completed', 'Completed', 'Pending', 'Completed', 'Failed', 'Completed', 'Completed', 'Completed', 'Pending', 'Completed'];

const MOCK_PAYMENT_EVENTS = Array.from({ length: 20 }, (_, i) => ({
  id: uuid(600 + i),
  tripId: uuid(400 + (i % 12)),
  riderId: uuid(500 + (i % 12)),
  driverId: uuid(100 + (i % 15)),
  type: PAYMENT_TYPES[i % PAYMENT_TYPES.length],
  amount: +(5 + Math.random() * 45).toFixed(2),
  currency: 'TND',
  paymentMethod: PAYMENT_METHODS[i % PAYMENT_METHODS.length],
  status: PAYMENT_EVENT_STATUSES[i % PAYMENT_EVENT_STATUSES.length],
  gatewayTransactionId: `GW-TXN-${String(10000 + i)}`,
  gatewayProvider: i % 3 === 0 ? 'Stripe' : i % 3 === 1 ? 'Flouci' : 'D17',
  processedAt: pastTs(i),
  failureReason: PAYMENT_EVENT_STATUSES[i % PAYMENT_EVENT_STATUSES.length] === 'Failed' ? 'Insufficient funds' : null,
  metadata: {},
}));

const MOCK_PAYMENT_EVENTS_LIST = {
  items: MOCK_PAYMENT_EVENTS,
  totalCount: MOCK_PAYMENT_EVENTS.length,
  page: 1,
  pageSize: 20,
};

const MOCK_PAYMENT_AUDIT = {
  items: Array.from({ length: 10 }, (_, i) => ({
    id: uuid(650 + i),
    action: ['PaymentProcessed', 'RefundIssued', 'PayoutInitiated', 'ChargebackReceived', 'ManualAdjustment'][i % 5],
    performedBy: i % 2 === 0 ? 'System' : 'admin@erbu.tn',
    targetId: uuid(600 + i),
    targetType: 'PaymentEvent',
    details: `Processed payment event ${uuid(600 + i)}`,
    timestamp: pastTs(i),
    ipAddress: '196.203.42.' + (10 + i),
  })),
  totalCount: 10,
  page: 1,
  pageSize: 20,
};

const TN_BANKS = ['BIAT', 'Amen Bank', 'STB', 'BNA', 'Attijari Bank'];

const MOCK_VIREMENTS = {
  items: Array.from({ length: 10 }, (_, i) => ({
    id: uuid(670 + i),
    driverId: uuid(100 + i),
    driverName: `${DRIVER_NAMES[i % 15].first} ${DRIVER_NAMES[i % 15].last}`,
    amount: +(350 + i * 75).toFixed(2),
    currency: 'TND',
    status: i < 7 ? 'Completed' : i === 7 ? 'Pending' : i === 8 ? 'Processing' : 'Failed',
    bankName: TN_BANKS[i % TN_BANKS.length],
    iban: `TN59 ${1000 + i} ${6035 + i} ${1835 + i} ${9847 + i} ${8831 + i}`,
    bic: 'BIATTNTT',
    reference: `VIR-2026-${String(5000 + i)}`,
    periodStart: pastTs(14 + i * 7),
    periodEnd: pastTs(7 + i * 7),
    tripCount: 30 + i * 5,
    commissionDeducted: +(70 + i * 15).toFixed(2),
    initiatedAt: pastTs(6 + i * 7),
    processedAt: i < 7 ? pastTs(5 + i * 7) : null,
    failureReason: i === 9 ? 'Invalid IBAN' : null,
  })),
  totalCount: 10,
  page: 1,
  pageSize: 20,
};

// ════════════════════════════════════════════════════════════════
// 4. MARKETPLACE
// ════════════════════════════════════════════════════════════════

const MOCK_DRIVER_NETWORK = Array.from({ length: 25 }, (_, i) => ({
  driverId: uuid(100 + (i % 15)),
  driverName: `${DRIVER_NAMES[i % 15].first} ${DRIVER_NAMES[i % 15].last}`,
  lat: +(36.78 + Math.random() * 0.07).toFixed(6),
  lng: +(10.12 + Math.random() * 0.10).toFixed(6),
  status: i < 15 ? 'Online' : i < 20 ? 'OnTrip' : 'Idle',
  vehicleType: i % 3 === 0 ? 'Sedan' : i % 3 === 1 ? 'SUV' : 'Comfort',
  rating: +(4.0 + (i % 10) * 0.1).toFixed(1),
  totalTripsToday: 3 + (i % 8),
  earningsToday: +(25 + i * 8.5).toFixed(2),
  currency: 'TND',
  isOnTrip: i >= 15 && i < 20,
  currentTripId: i >= 15 && i < 20 ? uuid(400 + i) : null,
  connectedSince: ts(6 + (i % 4), i * 3),
  signalStrength: i % 4 === 0 ? 'Weak' : 'Strong',
  lastPingAt: ts(14, 25 + (i % 5)),
}));

const TUNIS_ADDRESSES = [
  'Avenue Habib Bourguiba, Tunis', 'Rue de Marseille, Tunis', 'Avenue Mohamed V, Tunis',
  'Lac 1, Tunis', 'Lac 2, Tunis', 'La Marsa Centre', 'Sidi Bou Said', 'Carthage Byrsa',
  'Avenue Farhat Hached, Tunis', 'Rue Ibn Khaldoun, Tunis', 'El Menzah 6, Ariana',
  'Bardo, Tunis', 'Ennasr 2, Ariana', 'Manar 3, Tunis', 'Soukra, Ariana',
];

const MOCK_RESERVATIONS = {
  items: Array.from({ length: 8 }, (_, i) => ({
    id: uuid(800 + i),
    riderId: uuid(500 + i),
    riderName: RIDER_NAMES[i],
    pickupLat: +(36.78 + Math.random() * 0.07).toFixed(6),
    pickupLng: +(10.12 + Math.random() * 0.10).toFixed(6),
    pickupAddress: TUNIS_ADDRESSES[i % TUNIS_ADDRESSES.length],
    dropoffLat: +(36.78 + Math.random() * 0.07).toFixed(6),
    dropoffLng: +(10.12 + Math.random() * 0.10).toFixed(6),
    dropoffAddress: TUNIS_ADDRESSES[(i + 5) % TUNIS_ADDRESSES.length],
    scheduledAt: `2026-07-27T${String(8 + i).padStart(2, '0')}:00:00.000Z`,
    vehicleType: i % 3 === 0 ? 'Sedan' : i % 3 === 1 ? 'SUV' : 'Comfort',
    estimatedFare: +(8 + i * 3.5).toFixed(2),
    currency: 'TND',
    status: i < 3 ? 'Confirmed' : i < 6 ? 'Pending' : 'Cancelled',
    assignedDriverId: i < 3 ? uuid(100 + i) : null,
    createdAt: pastTs(1),
    confirmedAt: i < 3 ? pastTs(0) : null,
    cancellationDeadline: `2026-07-27T${String(7 + i).padStart(2, '0')}:30:00.000Z`,
  })),
  totalCount: 8,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};

const ZONE_NAMES = ['Centre-ville', 'La Marsa', 'Lac', 'Ariana', 'Bardo'];

const MOCK_LIQUIDITY_ZONES = ZONE_NAMES.map((name, i) => ({
  zoneId: uuid(850 + i),
  zoneName: name,
  centerLat: [36.7992, 36.8783, 36.8325, 36.8602, 36.8089][i],
  centerLng: [10.1658, 10.3247, 10.2330, 10.1934, 10.1346][i],
  activeRiders: 15 + i * 5,
  activeDrivers: 10 + i * 3,
  pendingRequests: 3 + i,
  supplyDemandRatio: +(0.6 + i * 0.15).toFixed(2),
  surgeMultiplier: +(1.0 + i * 0.1).toFixed(1),
  averageWaitTimeSeconds: 120 + i * 30,
  averageEtaSeconds: 180 + i * 25,
  estimatedFulfillmentRate: +(85 + i * 2.5).toFixed(1),
  lastUpdatedAt: ts(14, 30),
  trend: i < 2 ? 'Increasing' : i < 4 ? 'Stable' : 'Decreasing',
}));

const MOCK_AUCTIONS = {
  items: Array.from({ length: 6 }, (_, i) => ({
    id: uuid(860 + i),
    tripRequestId: uuid(870 + i),
    riderName: RIDER_NAMES[i % 12],
    pickupAddress: TUNIS_ADDRESSES[i],
    status: i < 2 ? 'Active' : i < 4 ? 'Completed' : 'Expired',
    startedAt: pastTs(i),
    expiresAt: ts(15, i * 10),
    bidsCount: 3 + i,
    bestBidAmount: +(12 + i * 2.5).toFixed(2),
    currency: 'TND',
    assignedDriverId: i < 4 ? uuid(100 + i) : null,
  })),
  totalCount: 6,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};

const MOCK_AUDIT_ALERTS = {
  items: Array.from({ length: 5 }, (_, i) => ({
    id: uuid(880 + i),
    type: ['PriceAnomaly', 'UnusualBehavior', 'HighCancellation', 'FraudSuspicion', 'ComplianceViolation'][i],
    severity: i < 2 ? 'High' : 'Medium',
    message: [
      'Surge multiplier exceeded 3x in La Marsa',
      'Driver completed 25 trips in 4 hours',
      'Rider cancelled 5 consecutive trips',
      'Multiple accounts from same device',
      'Driver operating outside licensed zone',
    ][i],
    entityType: i < 2 ? 'Driver' : 'Rider',
    entityId: i < 2 ? uuid(100 + i) : uuid(500 + i),
    status: i === 0 ? 'Active' : 'Acknowledged',
    createdAt: pastTs(i),
    acknowledgedAt: i > 0 ? pastTs(i - 1) : null,
  })),
  totalCount: 5,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};

const MOCK_ALARM_RULES = [
  { id: uuid(890), name: 'High Surge Alert', condition: 'surge_multiplier > 2.5', severity: 'High', enabled: true, notifyChannels: ['email', 'slack'], cooldownMinutes: 15, createdAt: pastTs(60) },
  { id: uuid(891), name: 'Low Supply Alert', condition: 'supply_demand_ratio < 0.3', severity: 'Critical', enabled: true, notifyChannels: ['email', 'sms', 'slack'], cooldownMinutes: 5, createdAt: pastTs(60) },
  { id: uuid(892), name: 'High Wait Time', condition: 'avg_wait_time > 600', severity: 'Medium', enabled: true, notifyChannels: ['slack'], cooldownMinutes: 30, createdAt: pastTs(45) },
  { id: uuid(893), name: 'Fraud Score Alert', condition: 'fraud_score > 80', severity: 'High', enabled: false, notifyChannels: ['email', 'slack'], cooldownMinutes: 0, createdAt: pastTs(30) },
];

const MOCK_MARKETPLACE_DRIVER_PROFILE = {
  driverId: uuid(100),
  driverName: 'Mohamed Ben Ali',
  status: 'Online',
  rating: 4.5,
  totalTrips: 685,
  todayTrips: 7,
  todayEarnings: 85.500,
  currency: 'TND',
  vehicleType: 'Sedan',
  vehiclePlate: '220 TU 4567',
  acceptanceRate: 92.5,
  cancellationRate: 3.2,
  averageRating: 4.5,
  zone: 'Centre-ville',
  isOnline: true,
  lastLocation: { lat: 36.8065, lng: 10.1815 },
  connectedSince: ts(7, 30),
};

// ════════════════════════════════════════════════════════════════
// 5. DRIVER MONITOR
// ════════════════════════════════════════════════════════════════

const MOCK_DRIVER_POSITIONS = Array.from({ length: 15 }, (_, i) => ({
  driverId: uuid(100 + i),
  driverName: `${DRIVER_NAMES[i % 15].first} ${DRIVER_NAMES[i % 15].last}`,
  status: i < 8 ? 'Online' : i < 12 ? 'OnTrip' : 'Idle',
  latitude: +(36.78 + Math.random() * 0.07).toFixed(6),
  longitude: +(10.12 + Math.random() * 0.10).toFixed(6),
  heading: Math.floor(Math.random() * 360),
  speed: +(Math.random() * 60).toFixed(1),
  gpsQuality: i % 5 === 0 ? 'Poor' : 'Good',
  lastUpdatedAt: ts(14, 25 + (i % 5)),
  currentTripId: i >= 8 && i < 12 ? uuid(400 + i) : null,
  vehiclePlate: `${220 + i} TU ${4000 + i * 111}`,
  zone: ZONE_NAMES[i % ZONE_NAMES.length],
}));

const MOCK_DRIVER_ALERTS = [
  { id: uuid(900), driverId: uuid(103), driverName: 'Sami Gharbi', severity: 'High', message: 'GPS signal lost for 10+ minutes', createdAt: ts(14, 15), acknowledged: false, zone: 'La Marsa' },
  { id: uuid(901), driverId: uuid(107), driverName: 'Fathi Chaabane', severity: 'Medium', message: 'Speed exceeding 120 km/h', createdAt: ts(13, 45), acknowledged: true, zone: 'Ariana' },
  { id: uuid(902), driverId: uuid(110), driverName: 'Hichem Amri', severity: 'Low', message: 'Extended idle time (45+ min)', createdAt: ts(12, 30), acknowledged: false, zone: 'Bardo' },
];

const MOCK_DRIVER_MONITOR_DASHBOARD = {
  kpi: { totalOnline: 45, totalOffline: 8, totalOnTrip: 23, totalIdle: 12, avgGpsAccuracy: 4.2, avgSpeedKmh: 32.5 },
  drivers: MOCK_DRIVER_POSITIONS,
  alerts: MOCK_DRIVER_ALERTS,
  zones: ['Centre-ville', 'La Marsa', 'Lac', 'Ariana', 'Bardo', 'Carthage'],
};

const MOCK_DRIVER_MONITOR_LIST = {
  items: MOCK_DRIVER_POSITIONS,
  total: MOCK_DRIVER_POSITIONS.length,
  page: 1,
  pageSize: 20,
};

// ════════════════════════════════════════════════════════════════
// 6. REPUTATION
// ════════════════════════════════════════════════════════════════

const MOCK_REPUTATION_SUMMARY = {
  totalDrivers: 156,
  totalRiders: 1247,
  avgDriverScore: 4.3,
  avgRiderScore: 4.7,
  flaggedCount: 5,
  openFraudAlerts: 2,
};

const MOCK_REPUTATION_SCORES = {
  items: Array.from({ length: 20 }, (_, i) => ({
    userId: uuid(i < 10 ? 100 + i : 500 + i - 10),
    userName: i < 10 ? `${DRIVER_NAMES[i].first} ${DRIVER_NAMES[i].last}` : RIDER_NAMES[i - 10],
    userType: i < 10 ? 'Driver' : 'Rider',
    currentScore: +(3.5 + (i % 15) * 0.1).toFixed(1),
    previousScore: +(3.4 + (i % 15) * 0.1).toFixed(1),
    totalTrips: 50 + i * 25,
    totalRatings: 40 + i * 20,
    averageRating: +(4.0 + (i % 10) * 0.1).toFixed(1),
    lastUpdatedAt: pastTs(i % 5),
    flagged: i === 3 || i === 7 || i === 11 || i === 15 || i === 18,
  })),
  total: 20,
  page: 1,
  pageSize: 20,
};

const MOCK_SCORE_HISTORY = Array.from({ length: 30 }, (_, i) => ({
  date: pastTs(29 - i),
  score: +(4.0 + Math.sin(i * 0.3) * 0.5).toFixed(2),
  tripCount: 3 + (i % 5),
  ratingsCount: 2 + (i % 4),
}));

const MOCK_FRAUD_ALERTS = {
  items: Array.from({ length: 5 }, (_, i) => ({
    id: uuid(920 + i),
    userId: uuid(i < 3 ? 100 + i * 3 : 500 + i),
    userName: i < 3 ? `${DRIVER_NAMES[i * 3].first} ${DRIVER_NAMES[i * 3].last}` : RIDER_NAMES[i],
    userType: i < 3 ? 'Driver' : 'Rider',
    alertType: ['MultipleAccounts', 'FakeRatings', 'GpsManipulation', 'PaymentFraud', 'IdentityMismatch'][i],
    severity: i < 2 ? 'Critical' : 'High',
    description: [
      'Multiple accounts detected from same device ID',
      'Pattern of reciprocal 5-star ratings detected',
      'GPS coordinates show impossible travel speed',
      'Chargeback pattern across multiple cards',
      'Selfie verification mismatch with ID document',
    ][i],
    status: i === 0 ? 'Open' : i < 3 ? 'Investigating' : 'Resolved',
    createdAt: pastTs(i * 3),
    resolvedAt: i >= 3 ? pastTs(i) : null,
    assignedTo: i < 3 ? 'fraud-team@erbu.tn' : null,
  })),
  total: 5,
  page: 1,
  pageSize: 20,
};

// ════════════════════════════════════════════════════════════════
// 7. AUTH MANAGEMENT
// ════════════════════════════════════════════════════════════════

const AUTH_ROLES = ['Admin', 'Operator', 'Viewer', 'Driver', 'Rider'];
const AUTH_NAMES = [
  'Hamed Nidhal', 'Karim Admin', 'Sami Operator', 'Leila Viewer', 'Mohamed Ben Ali',
  'Ahmed Trabelsi', 'Youssef Bouazizi', 'Amira Ben Youssef', 'Fatma Trabelsi', 'Sara Chaabane',
  'Nabil Meddeb', 'Ines Jebali', 'Walid Sfar', 'Riadh Jebali', 'Bilel Souissi',
  'Fathi Chaabane', 'Tarek Khemiri', 'Slim Bennour', 'Maher Dridi', 'Anouar Riahi',
  'Hajer Gharbi', 'Olfa Dridi', 'Asma Khemiri', 'Nour Sfar', 'Mariem Meddeb',
];

const MOCK_AUTH_USERS = {
  items: Array.from({ length: 25 }, (_, i) => ({
    id: uuid(1000 + i),
    email: `${AUTH_NAMES[i].split(' ')[0].toLowerCase()}${i > 0 ? i : ''}@erbu.tn`,
    displayName: AUTH_NAMES[i],
    role: AUTH_ROLES[i < 3 ? i : i < 8 ? 3 : 4],
    status: i === 5 ? 'Locked' : i === 18 ? 'Disabled' : 'Active',
    emailVerified: i !== 18,
    mfaEnabled: i < 5,
    createdAt: pastTs(300 - i * 10),
    lastLoginAt: pastTs(i % 7),
    loginCount: 50 + i * 12,
    lockedUntil: i === 5 ? '2026-07-27T00:00:00Z' : null,
  })),
  total: 25,
  page: 1,
  pageSize: 25,
};

const MOCK_AUTH_TOKENS = {
  items: Array.from({ length: 10 }, (_, i) => ({
    id: uuid(1050 + i),
    userId: uuid(1000 + i),
    userName: AUTH_NAMES[i],
    tokenType: i % 3 === 0 ? 'RefreshToken' : 'AccessToken',
    issuedAt: pastTs(i % 3),
    expiresAt: `2026-07-${String(27 + (i % 3)).padStart(2, '0')}T${String(10 + i).padStart(2, '0')}:00:00Z`,
    clientId: i % 2 === 0 ? 'erbu-admin-web' : 'erbu-rider-app',
    ipAddress: `196.203.42.${10 + i}`,
    revoked: i === 8,
  })),
  total: 10,
  page: 1,
  pageSize: 20,
};

const MOCK_AUTH_BANS = {
  items: [
    { id: uuid(1080), userId: uuid(1005), userName: 'Ahmed Trabelsi', reason: 'Fraud', description: 'Multiple chargebacks and suspicious payment patterns', status: 'Active', bannedAt: pastTs(15), expiresAt: '2026-09-01T00:00:00Z', bannedBy: 'admin@erbu.tn', revokedAt: null, revokedBy: null },
    { id: uuid(1081), userId: uuid(500 + 6), userName: 'Mariem Meddeb', reason: 'Abuse', description: 'Repeated harassment of drivers', status: 'Active', bannedAt: pastTs(10), expiresAt: '2026-08-15T00:00:00Z', bannedBy: 'admin@erbu.tn', revokedAt: null, revokedBy: null },
    { id: uuid(1082), userId: uuid(1018), userName: 'Maher Dridi', reason: 'TOS Violation', description: 'Operating unlicensed vehicle', status: 'Revoked', bannedAt: pastTs(30), expiresAt: '2026-08-01T00:00:00Z', bannedBy: 'admin@erbu.tn', revokedAt: pastTs(5), revokedBy: 'admin@erbu.tn' },
  ],
  total: 3,
  page: 1,
  pageSize: 20,
};

const MOCK_AUTH_DIAGNOSTICS = {
  overallStatus: 'Healthy',
  components: [
    { component: 'Identity Server', status: 'Healthy', message: 'All endpoints responding', lastCheckedAt: ts(14, 25), details: { uptime: '15d 7h 32m', version: '3.2.1' } },
    { component: 'Token Store (Redis)', status: 'Healthy', message: 'Connected, latency 2ms', lastCheckedAt: ts(14, 25), details: { connectedClients: '12', usedMemory: '145MB' } },
    { component: 'MFA Provider', status: 'Warning', message: 'SMS delivery delay (avg 8s)', lastCheckedAt: ts(14, 24), details: { smsProvider: 'Twilio', avgDeliveryMs: '8200' } },
    { component: 'Password Policy Engine', status: 'Healthy', message: 'Policy v2.1 active', lastCheckedAt: ts(14, 25), details: { minLength: '12', maxAgeDays: '90' } },
  ],
  totalUsers: 25,
  activeTokenCount: 42,
  activeBanCount: 2,
  failedLoginLast24h: 8,
  avgLoginLatencyMs: 145,
};

// ════════════════════════════════════════════════════════════════
// 8. SUPPORT TICKETS
// ════════════════════════════════════════════════════════════════

const TICKET_CATEGORIES = ['Payment', 'Trip', 'Account', 'Driver', 'Technical', 'Safety'];
const TICKET_STATUSES = ['Open', 'InProgress', 'WaitingOnCustomer', 'Resolved', 'Closed'];
const TICKET_PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
const TICKET_SUBJECTS = [
  'Charge incorrecte sur ma carte',
  'Chauffeur ne s\'est pas présenté',
  'Impossible de se connecter',
  'Objet perdu dans le véhicule',
  'Problème de facturation',
  'Chauffeur impoli',
  'Application crash au démarrage',
  'Remboursement non reçu',
  'Trajet non terminé correctement',
  'Changement de numéro de téléphone',
  'Problème GPS pendant le trajet',
  'Double facturation',
  'Contestation de note',
  'Véhicule en mauvais état',
  'Demande de facture',
];

const MOCK_TICKETS = {
  items: Array.from({ length: 15 }, (_, i) => ({
    id: uuid(1100 + i),
    ticketNumber: `TKT-2026-${String(5000 + i).padStart(5, '0')}`,
    subject: TICKET_SUBJECTS[i],
    category: TICKET_CATEGORIES[i % TICKET_CATEGORIES.length],
    status: TICKET_STATUSES[i % TICKET_STATUSES.length],
    priority: TICKET_PRIORITIES[i % TICKET_PRIORITIES.length],
    riderName: RIDER_NAMES[i % 12],
    riderId: uuid(500 + (i % 12)),
    assignedTo: i < 10 ? ['support-team@erbu.tn', 'karim@erbu.tn', 'sami@erbu.tn'][i % 3] : null,
    createdAt: pastTs(i * 2),
    updatedAt: pastTs(i),
    lastReplyAt: i < 10 ? pastTs(i) : null,
    replyCount: i < 10 ? 2 + (i % 4) : 0,
  })),
  total: 15,
  page: 1,
  pageSize: 20,
};

const MOCK_TICKET_DETAIL = {
  ...MOCK_TICKETS.items[0],
  description: 'J\'ai été facturé 25 TND pour un trajet qui aurait dû coûter 12 TND. Le prix affiché avant la course était de 12 TND mais la facture finale montre 25 TND.',
  messages: [
    { id: uuid(1150), sender: 'rider', senderName: RIDER_NAMES[0], message: 'J\'ai été facturé 25 TND pour un trajet qui aurait dû coûter 12 TND.', createdAt: pastTs(4) },
    { id: uuid(1151), sender: 'agent', senderName: 'Support Erbu', message: 'Bonjour, nous examinons votre demande. Pouvez-vous nous fournir l\'ID du trajet ?', createdAt: pastTs(3) },
    { id: uuid(1152), sender: 'rider', senderName: RIDER_NAMES[0], message: 'Le trajet est TRP-20261000. Voici la capture d\'écran.', createdAt: pastTs(2) },
  ],
  tripId: uuid(400),
  attachments: [],
};

// ════════════════════════════════════════════════════════════════
// 9. ALERTS
// ════════════════════════════════════════════════════════════════

const ALERT_SEVERITIES = ['Critical', 'High', 'Medium', 'Low', 'Info'];
const ALERT_SOURCES = ['PaymentGateway', 'DriverMonitor', 'Infrastructure', 'Marketplace', 'Security', 'Database', 'API', 'SignalR'];

const MOCK_ALERTS = {
  items: Array.from({ length: 8 }, (_, i) => ({
    id: uuid(1200 + i),
    title: [
      'Payment gateway response time exceeded threshold',
      'Driver GPS signal loss cluster detected',
      'Server CPU usage above 90%',
      'Marketplace supply-demand ratio critical',
      'Multiple failed login attempts detected',
      'Database connection pool exhausted',
      'API rate limit exceeded for client',
      'SignalR hub disconnection spike',
    ][i],
    message: [
      'Average response time from Stripe gateway exceeded 2000ms for 5+ minutes',
      '12 drivers in La Marsa zone lost GPS signal simultaneously',
      'htz-prod-01 CPU usage at 94% for 10+ minutes',
      'Centre-ville zone supply/demand ratio dropped to 0.15',
      '15 failed login attempts from IP 196.203.42.55 in 5 minutes',
      'PostgreSQL connection pool at 98% capacity (196/200)',
      'Client erbu-rider-app exceeded 1000 req/min rate limit',
      '45 SignalR hub disconnections in the last 5 minutes',
    ][i],
    severity: ALERT_SEVERITIES[i % ALERT_SEVERITIES.length],
    status: i < 3 ? 'Active' : i < 6 ? 'Acknowledged' : 'Resolved',
    source: ALERT_SOURCES[i],
    createdAt: pastTs(i),
    acknowledgedAt: i >= 3 ? pastTs(i - 1) : null,
    acknowledgedBy: i >= 3 ? 'admin@erbu.tn' : null,
    resolvedAt: i >= 6 ? pastTs(i - 2) : null,
    metadata: {},
  })),
  total: 8,
  page: 1,
  pageSize: 20,
};

const MOCK_ALERT_RULES = [
  { id: uuid(1220), name: 'High CPU Alert', condition: 'cpu_usage > 90', severity: 'Critical', enabled: true, notifyChannels: ['email', 'slack', 'sms'], cooldownMinutes: 5, targetService: '*', createdAt: pastTs(90) },
  { id: uuid(1221), name: 'Payment Failure Rate', condition: 'payment_failure_rate > 5', severity: 'High', enabled: true, notifyChannels: ['email', 'slack'], cooldownMinutes: 10, targetService: 'payment-service', createdAt: pastTs(90) },
  { id: uuid(1222), name: 'Low Driver Supply', condition: 'supply_demand_ratio < 0.2', severity: 'High', enabled: true, notifyChannels: ['slack'], cooldownMinutes: 15, targetService: 'marketplace-service', createdAt: pastTs(60) },
  { id: uuid(1223), name: 'Database Slow Queries', condition: 'query_duration > 5000', severity: 'Medium', enabled: true, notifyChannels: ['slack'], cooldownMinutes: 30, targetService: 'database', createdAt: pastTs(45) },
  { id: uuid(1224), name: 'SignalR Disconnections', condition: 'disconnection_rate > 10', severity: 'Medium', enabled: false, notifyChannels: ['email'], cooldownMinutes: 20, targetService: 'signalr-hub', createdAt: pastTs(30) },
];

const MOCK_NOTIFICATION_PREFERENCES = {
  email: { enabled: true, address: 'ops@erbu.tn', minSeverity: 'Medium' },
  slack: { enabled: true, webhookUrl: 'https://hooks.slack.com/services/xxx', channel: '#ops-alerts', minSeverity: 'Low' },
  sms: { enabled: true, phoneNumber: '+216 20 123 456', minSeverity: 'Critical' },
  pushNotification: { enabled: false, minSeverity: 'High' },
  digestEnabled: true,
  digestFrequency: 'hourly',
  quietHoursStart: '23:00',
  quietHoursEnd: '07:00',
};

// ════════════════════════════════════════════════════════════════
// 10. ORCHESTRATOR
// ════════════════════════════════════════════════════════════════

const MOCK_ORCHESTRATOR_DASHBOARD = {
  queueDepth: 3,
  runningJobs: 2,
  failedLast24h: 1,
  avgDurationSeconds: 45.2,
  serviceCount: 15,
  healthyServices: 12,
  pendingDeployments: 1,
};

const JOB_TYPES = ['DataSync', 'Backup', 'Cleanup', 'Report', 'Migration', 'IndexRebuild', 'CacheWarm', 'HealthCheck', 'MetricsAggregation', 'AuditLog'];
const JOB_STATUSES = ['Completed', 'Running', 'Queued', 'Failed', 'Completed', 'Completed', 'Running', 'Completed', 'Completed', 'Cancelled'];

const MOCK_ORCHESTRATOR_JOBS = {
  items: Array.from({ length: 10 }, (_, i) => ({
    id: uuid(1300 + i),
    name: `${JOB_TYPES[i]} Job #${1000 + i}`,
    type: JOB_TYPES[i],
    status: JOB_STATUSES[i],
    priority: i < 3 ? 'High' : i < 7 ? 'Normal' : 'Low',
    progress: JOB_STATUSES[i] === 'Completed' ? 100 : JOB_STATUSES[i] === 'Running' ? 45 + i * 10 : 0,
    createdAt: pastTs(i),
    startedAt: JOB_STATUSES[i] !== 'Queued' ? pastTs(i) : null,
    completedAt: JOB_STATUSES[i] === 'Completed' ? pastTs(i) : null,
    duration: JOB_STATUSES[i] === 'Completed' ? 30 + i * 5 : null,
    retryCount: JOB_STATUSES[i] === 'Failed' ? 3 : 0,
    maxRetries: 3,
    errorMessage: JOB_STATUSES[i] === 'Failed' ? 'Connection timeout after 30s' : null,
    triggeredBy: i % 2 === 0 ? 'Scheduler' : 'admin@erbu.tn',
  })),
  total: 10,
  page: 1,
  pageSize: 20,
};

const SERVICE_NAMES = [
  'auth-service', 'rider-service', 'driver-service', 'trip-service', 'payment-service',
  'marketplace-service', 'notification-service', 'geocoding-service', 'pricing-service',
  'analytics-service', 'support-service', 'admin-gateway', 'signalr-hub', 'scheduler-service', 'media-service',
];

const MOCK_ORCHESTRATED_SERVICES = SERVICE_NAMES.map((name, i) => ({
  id: uuid(1350 + i),
  name,
  version: `1.${Math.floor(i / 3)}.${i % 5}`,
  state: i < 12 ? 'Running' : i === 12 ? 'Degraded' : i === 13 ? 'Starting' : 'Stopped',
  instanceCount: i < 12 ? 2 + (i % 3) : i === 14 ? 0 : 1,
  desiredInstances: 2 + (i % 3),
  cpuPercent: +(10 + Math.random() * 50).toFixed(1),
  memoryMb: Math.floor(128 + Math.random() * 384),
  uptimeSeconds: i < 12 ? 86400 * (3 + i) : 3600,
  lastHealthCheck: ts(14, 29),
  endpoint: `http://${name}:${8080 + i}`,
}));

const MOCK_DEPLOYMENTS = Array.from({ length: 5 }, (_, i) => ({
  id: uuid(1400 + i),
  serviceName: SERVICE_NAMES[i],
  version: `1.${Math.floor(i / 3)}.${i % 5}`,
  previousVersion: `1.${Math.floor(i / 3)}.${(i % 5) - 1 < 0 ? 0 : (i % 5) - 1}`,
  status: i === 0 ? 'InProgress' : i < 4 ? 'Completed' : 'RolledBack',
  initiatedBy: 'deploy-bot@erbu.tn',
  startedAt: pastTs(i * 2),
  completedAt: i > 0 ? pastTs(i * 2) : null,
  rollbackAvailable: i < 4,
  changelog: `Performance improvements and bug fixes for ${SERVICE_NAMES[i]}`,
}));

// ════════════════════════════════════════════════════════════════
// 11. SERVICES DASHBOARD
// ════════════════════════════════════════════════════════════════

const MOCK_MICROSERVICES = SERVICE_NAMES.map((name, i) => ({
  id: uuid(1350 + i),
  name,
  version: `1.${Math.floor(i / 3)}.${i % 5}`,
  status: i < 12 ? 'healthy' : i === 12 ? 'degraded' : i === 13 ? 'degraded' : 'down',
  cpuPercent: +(10 + Math.random() * 50).toFixed(1),
  memoryMb: Math.floor(128 + Math.random() * 384),
  memoryLimitMb: 512,
  uptimeSeconds: 86400 * (3 + i),
  lastHealthCheck: ts(14, 29),
  endpoint: `http://${name}:${8080 + i}`,
  replicas: 2 + (i % 3),
  activeConnections: Math.floor(10 + Math.random() * 100),
  requestsPerSecond: +(5 + Math.random() * 50).toFixed(1),
  errorRate: +(Math.random() * 0.02).toFixed(4),
  p99LatencyMs: Math.floor(20 + Math.random() * 100),
}));

const MOCK_PROMETHEUS = {
  totalRequests: 1250000,
  totalErrors: 1500,
  avgLatencyMs: 45.3,
  cpuUsagePercent: 34.5,
  memoryUsagePercent: 62.1,
  diskUsagePercent: 45.2,
  activeGoroutines: 156,
  openFileDescriptors: 342,
  metrics: [],
};

const MOCK_SERVICES_DASHBOARD = {
  services: MOCK_MICROSERVICES,
  prometheus: MOCK_PROMETHEUS,
  lastUpdatedAt: ts(14, 30),
};

const MOCK_SERVICE_ACTION_LOGS = Array.from({ length: 8 }, (_, i) => ({
  id: uuid(1450 + i),
  serviceName: SERVICE_NAMES[i % SERVICE_NAMES.length],
  action: ['Restart', 'ScaleUp', 'ScaleDown', 'Deploy', 'Rollback', 'HealthCheck', 'ConfigUpdate', 'Stop'][i],
  performedBy: 'admin@erbu.tn',
  timestamp: pastTs(i),
  result: i !== 4 ? 'Success' : 'Failed',
  details: `Action ${['Restart', 'ScaleUp', 'ScaleDown', 'Deploy', 'Rollback', 'HealthCheck', 'ConfigUpdate', 'Stop'][i]} performed on ${SERVICE_NAMES[i % SERVICE_NAMES.length]}`,
}));

// ════════════════════════════════════════════════════════════════
// 12. INFRASTRUCTURE ADMIN
// ════════════════════════════════════════════════════════════════

const MOCK_SERVER_NODES = [
  { id: uuid(1500), hostname: 'htz-prod-01', ipAddress: '135.181.42.10', location: 'Helsinki, FI', provider: 'Hetzner', status: 'online', cpuCores: 8, cpuUsagePercent: 42.5, memoryTotalGb: 32, memoryUsedGb: 18.7, diskTotalGb: 500, diskUsedGb: 225, networkInMbps: 125, networkOutMbps: 98, uptimeSeconds: 2592000, os: 'Ubuntu 24.04 LTS', lastSeen: ts(14, 30), tags: ['production', 'primary'], runningContainers: 18 },
  { id: uuid(1501), hostname: 'htz-prod-02', ipAddress: '135.181.42.11', location: 'Helsinki, FI', provider: 'Hetzner', status: 'online', cpuCores: 8, cpuUsagePercent: 38.2, memoryTotalGb: 32, memoryUsedGb: 16.3, diskTotalGb: 500, diskUsedGb: 198, networkInMbps: 110, networkOutMbps: 85, uptimeSeconds: 2592000, os: 'Ubuntu 24.04 LTS', lastSeen: ts(14, 30), tags: ['production', 'secondary'], runningContainers: 15 },
  { id: uuid(1502), hostname: 'htz-staging-01', ipAddress: '135.181.42.20', location: 'Helsinki, FI', provider: 'Hetzner', status: 'online', cpuCores: 4, cpuUsagePercent: 22.1, memoryTotalGb: 16, memoryUsedGb: 8.5, diskTotalGb: 250, diskUsedGb: 95, networkInMbps: 45, networkOutMbps: 32, uptimeSeconds: 1728000, os: 'Ubuntu 24.04 LTS', lastSeen: ts(14, 30), tags: ['staging'], runningContainers: 12 },
  { id: uuid(1503), hostname: 'htz-dev-01', ipAddress: '135.181.42.30', location: 'Helsinki, FI', provider: 'Hetzner', status: 'degraded', cpuCores: 4, cpuUsagePercent: 78.9, memoryTotalGb: 16, memoryUsedGb: 14.2, diskTotalGb: 250, diskUsedGb: 210, networkInMbps: 25, networkOutMbps: 18, uptimeSeconds: 864000, os: 'Ubuntu 24.04 LTS', lastSeen: ts(14, 28), tags: ['development'], runningContainers: 22 },
];

const MOCK_NETWORK_TOPOLOGY = {
  nodes: MOCK_SERVER_NODES.map(n => ({ id: n.id, label: n.hostname, type: 'server', status: n.status })),
  edges: [
    { source: uuid(1500), target: uuid(1501), label: 'replication', bandwidth: '1 Gbps' },
    { source: uuid(1500), target: uuid(1502), label: 'vpn', bandwidth: '100 Mbps' },
    { source: uuid(1502), target: uuid(1503), label: 'vpn', bandwidth: '100 Mbps' },
  ],
  loadBalancers: [
    { id: uuid(1510), name: 'lb-prod', targets: [uuid(1500), uuid(1501)], algorithm: 'round-robin', healthCheckInterval: 10 },
  ],
};

const MOCK_INFRA_DEPLOYMENTS = Array.from({ length: 5 }, (_, i) => ({
  id: uuid(1520 + i),
  serviceName: SERVICE_NAMES[i],
  version: `1.${i}.0`,
  environment: i < 3 ? 'production' : 'staging',
  status: i < 4 ? 'running' : 'deploying',
  deployedAt: pastTs(i * 5),
  deployedBy: 'deploy-bot@erbu.tn',
  nodeId: i < 2 ? uuid(1500) : uuid(1502),
  image: `erbu/${SERVICE_NAMES[i]}:1.${i}.0`,
  port: 8080 + i,
  healthEndpoint: `/health`,
  cpuRequest: '250m',
  memoryRequest: '512Mi',
  replicas: 2 + (i % 3),
  readyReplicas: i < 4 ? 2 + (i % 3) : 0,
}));

const MOCK_RESOURCE_ALERTS = Array.from({ length: 4 }, (_, i) => ({
  id: uuid(1540 + i),
  nodeId: uuid(1500 + i),
  hostname: MOCK_SERVER_NODES[i].hostname,
  type: ['HighCPU', 'HighMemory', 'DiskSpace', 'NetworkLatency'][i],
  severity: i === 0 ? 'Warning' : i === 3 ? 'Critical' : 'Info',
  message: [
    'CPU usage above 80% for 15 minutes',
    'Memory usage at 88% of capacity',
    'Disk usage at 84% - consider cleanup',
    'Network latency spike detected (>100ms)',
  ][i],
  value: [78.9, 88.7, 84.0, 125][i],
  threshold: [80, 90, 85, 100][i],
  createdAt: pastTs(i),
  resolved: i > 1,
}));

const MOCK_INFRA_DASHBOARD = {
  nodes: MOCK_SERVER_NODES,
  deployments: MOCK_INFRA_DEPLOYMENTS,
  alerts: MOCK_RESOURCE_ALERTS,
  topology: MOCK_NETWORK_TOPOLOGY,
  lastUpdatedAt: ts(14, 30),
};

// ════════════════════════════════════════════════════════════════
// 13. PRICING
// ════════════════════════════════════════════════════════════════

const PRICING_RULE_TYPES = ['BaseFare', 'PerKm', 'PerMinute', 'Minimum', 'Surge', 'Discount', 'Commission', 'Booking'];

const MOCK_PRICING_RULES = Array.from({ length: 8 }, (_, i) => ({
  id: uuid(1600 + i),
  name: [`Base Fare Tunis`, `Per Km Standard`, `Per Minute Rate`, `Minimum Fare`, `Peak Hour Surge`, `New User Discount`, `Driver Commission`, `Advance Booking Fee`][i],
  type: PRICING_RULE_TYPES[i],
  status: i < 7 ? 'active' : 'draft',
  description: `Pricing rule for ${PRICING_RULE_TYPES[i].toLowerCase()} calculation`,
  currency: 'TND',
  value: [2.5, 0.8, 0.15, 3.0, 1.5, -0.2, 0.15, 1.0][i],
  minValue: [2.0, 0.5, 0.1, 2.5, 1.0, -0.3, 0.1, 0.5][i],
  maxValue: [5.0, 2.0, 0.5, 8.0, 3.0, 0, 0.25, 3.0][i],
  priority: i + 1,
  zoneId: i < 5 ? uuid(850 + (i % 5)) : null,
  zoneName: i < 5 ? ZONE_NAMES[i % 5] : null,
  startTime: i === 4 ? '07:00' : null,
  endTime: i === 4 ? '09:00' : null,
  daysOfWeek: i === 4 ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] : null,
  validFrom: pastTs(90),
  validUntil: null,
  createdAt: pastTs(90),
  updatedAt: pastTs(5),
  createdBy: 'admin@erbu.tn',
}));

const MOCK_SURGE_CONFIGS = [
  { id: uuid(1620), zoneName: 'Centre-ville', zoneId: uuid(850), baseMultiplier: 1.0, maxMultiplier: 3.0, demandThreshold: 0.7, incrementStep: 0.1, cooldownMinutes: 10, isActive: true, lastTriggeredAt: ts(13, 45), currentMultiplier: 1.3 },
  { id: uuid(1621), zoneName: 'La Marsa', zoneId: uuid(851), baseMultiplier: 1.0, maxMultiplier: 2.5, demandThreshold: 0.6, incrementStep: 0.15, cooldownMinutes: 15, isActive: true, lastTriggeredAt: ts(12, 30), currentMultiplier: 1.0 },
  { id: uuid(1622), zoneName: 'Lac', zoneId: uuid(852), baseMultiplier: 1.0, maxMultiplier: 2.0, demandThreshold: 0.8, incrementStep: 0.1, cooldownMinutes: 10, isActive: false, lastTriggeredAt: null, currentMultiplier: 1.0 },
];

const MOCK_PRICING_ZONES = ZONE_NAMES.map((name, i) => ({
  id: uuid(850 + i),
  name,
  description: `Zone tarifaire ${name}`,
  centerLat: [36.7992, 36.8783, 36.8325, 36.8602, 36.8089][i],
  centerLng: [10.1658, 10.3247, 10.2330, 10.1934, 10.1346][i],
  radiusKm: 5 + i,
  baseFareMultiplier: +(1.0 + i * 0.05).toFixed(2),
  isActive: true,
  createdAt: pastTs(120),
}));

const MOCK_AB_TESTS = [
  { id: uuid(1640), name: 'Dynamic Pricing v2 Test', description: 'Testing new dynamic pricing algorithm', status: 'running', startDate: pastTs(14), endDate: '2026-08-10T00:00:00Z', controlGroup: { name: 'Control', percentage: 50, pricingRuleId: uuid(1600) }, testGroup: { name: 'Dynamic v2', percentage: 50, pricingRuleId: uuid(1601) }, metrics: { controlConversion: 72.3, testConversion: 78.1, significance: 0.92 } },
  { id: uuid(1641), name: 'Discount Impact Study', description: 'Measuring impact of 10% vs 20% new user discount', status: 'completed', startDate: pastTs(45), endDate: pastTs(15), controlGroup: { name: '10% Discount', percentage: 50, pricingRuleId: uuid(1605) }, testGroup: { name: '20% Discount', percentage: 50, pricingRuleId: uuid(1605) }, metrics: { controlConversion: 65.4, testConversion: 82.7, significance: 0.98 } },
];

const MOCK_PRICING_SIMULATION = {
  baseFare: 2.5,
  distanceCharge: 6.4,
  timeCharge: 2.7,
  surgeCharge: 0,
  discount: 0,
  bookingFee: 1.0,
  commission: 1.89,
  totalFare: 12.6,
  driverEarnings: 10.71,
  currency: 'TND',
  breakdown: [
    { label: 'Base fare', amount: 2.5 },
    { label: 'Distance (8.0 km × 0.80 TND)', amount: 6.4 },
    { label: 'Time (18 min × 0.15 TND)', amount: 2.7 },
    { label: 'Booking fee', amount: 1.0 },
  ],
};

// ════════════════════════════════════════════════════════════════
// 14. TRIPS
// ════════════════════════════════════════════════════════════════

const TRIP_STATUSES = ['completed', 'completed', 'completed', 'in-progress', 'completed', 'cancelled-rider', 'completed', 'driver-assigned', 'completed', 'completed', 'completed', 'completed', 'cancelled-driver', 'completed', 'completed', 'completed', 'in-progress', 'completed', 'completed', 'completed'];

const MOCK_TRIPS = {
  items: Array.from({ length: 20 }, (_, i) => ({
    id: uuid(400 + i),
    tripNumber: `TRP-2026${String(1000 + i)}`,
    riderName: RIDER_NAMES[i % 12],
    riderPhone: `+216 ${50 + (i % 12)} ${String(300 + i * 11).padStart(3, '0')} ${String(400 + i * 17).padStart(3, '0')}`,
    driverName: `${DRIVER_NAMES[i % 15].first} ${DRIVER_NAMES[i % 15].last}`,
    driverPhone: `+216 ${20 + (i % 15)} ${String(100 + i * 7).padStart(3, '0')} ${String(200 + i * 13).padStart(3, '0')}`,
    status: TRIP_STATUSES[i],
    vehicleType: i % 3 === 0 ? 'Sedan' : i % 3 === 1 ? 'SUV' : 'Comfort',
    pickupAddress: TUNIS_ADDRESSES[i % TUNIS_ADDRESSES.length],
    pickupLat: +(36.78 + Math.random() * 0.07).toFixed(6),
    pickupLng: +(10.12 + Math.random() * 0.10).toFixed(6),
    dropoffAddress: TUNIS_ADDRESSES[(i + 5) % TUNIS_ADDRESSES.length],
    dropoffLat: +(36.78 + Math.random() * 0.07).toFixed(6),
    dropoffLng: +(10.12 + Math.random() * 0.10).toFixed(6),
    requestedAt: pastTs(i),
    startedAt: TRIP_STATUSES[i] !== 'cancelled-rider' ? pastTs(i) : null,
    completedAt: TRIP_STATUSES[i] === 'completed' ? pastTs(i) : null,
    distanceKm: +(3 + Math.random() * 15).toFixed(1),
    durationMinutes: 10 + Math.floor(Math.random() * 30),
    fareAmount: +(5 + Math.random() * 35).toFixed(2),
    currency: 'TND',
    paymentMethod: i % 3 === 0 ? 'Card' : i % 3 === 1 ? 'Cash' : 'Wallet',
    rating: TRIP_STATUSES[i] === 'completed' ? 3 + (i % 3) : null,
    surgeMultiplier: i % 5 === 0 ? 1.3 : 1.0,
  })),
  totalCount: 20,
  page: 1,
  pageSize: 20,
  totalPages: 1,
};

const MOCK_TRIP_STATS = {
  totalTrips: 15420,
  completedTrips: 14200,
  cancelledTrips: 820,
  disputedTrips: 45,
  avgDurationMinutes: 18.5,
  avgDistanceKm: 7.2,
  avgFare: 8.5,
  totalRevenue: 120700,
  avgRating: 4.5,
  completionRate: 92.1,
};

const MOCK_TRIP_DETAIL = {
  ...MOCK_TRIPS.items[0],
  route: Array.from({ length: 20 }, (_, i) => ({
    lat: +(36.80 + i * 0.002).toFixed(6),
    lng: +(10.17 + i * 0.003).toFixed(6),
    timestamp: ts(10, i),
    speed: +(20 + Math.random() * 40).toFixed(1),
  })),
  events: [
    { type: 'Requested', timestamp: ts(10, 0) },
    { type: 'DriverAssigned', timestamp: ts(10, 1) },
    { type: 'DriverArrived', timestamp: ts(10, 5) },
    { type: 'TripStarted', timestamp: ts(10, 7) },
    { type: 'TripCompleted', timestamp: ts(10, 25) },
  ],
  payment: { method: 'Card', amount: MOCK_TRIPS.items[0].fareAmount, currency: 'TND', status: 'Completed', transactionId: `GW-TXN-10000` },
  riderRating: 5,
  driverRating: 4,
  riderFeedback: 'Très bon service, chauffeur ponctuel',
  driverFeedback: null,
};

const MOCK_TRIP_REPLAY = {
  tripId: uuid(400),
  points: Array.from({ length: 50 }, (_, i) => ({
    lat: +(36.80 + i * 0.001).toFixed(6),
    lng: +(10.17 + i * 0.0015).toFixed(6),
    timestamp: ts(10, Math.floor(i / 2)),
    speed: +(15 + Math.random() * 50).toFixed(1),
    heading: Math.floor(i * 7.2) % 360,
  })),
  totalDurationSeconds: 1080,
  totalDistanceMeters: 7200,
};

// ════════════════════════════════════════════════════════════════
// 15. DATABASE
// ════════════════════════════════════════════════════════════════

const MOCK_PG_STATS = {
  databaseName: 'erbu_prod',
  databaseSizeBytes: 2469606195,
  databaseSizeDisplay: '2.3 GB',
  tableCount: 45,
  totalRowCount: 2340000,
  indexCount: 127,
  activeQueries: 3,
  deadTuples: 12500,
  cacheHitRatio: 0.985,
  uptimeSeconds: 864000,
  postgresVersion: 'PostgreSQL 16.3',
};

const PG_TABLE_NAMES = [
  'trips', 'riders', 'drivers', 'payments', 'invoices', 'vehicles', 'ratings',
  'support_tickets', 'audit_logs', 'notifications', 'pricing_rules', 'zones',
  'wallets', 'kyc_documents', 'sessions',
];

const MOCK_PG_TABLES = PG_TABLE_NAMES.map((name, i) => ({
  tableName: name,
  schemaName: 'public',
  rowCount: [450000, 125000, 15600, 380000, 92000, 15800, 520000, 8500, 1200000, 340000, 45, 12, 15600, 31200, 42000][i],
  sizeBytes: [268435456, 134217728, 16777216, 201326592, 67108864, 8388608, 335544320, 4194304, 536870912, 134217728, 65536, 32768, 16777216, 33554432, 50331648][i],
  sizeDisplay: ['256 MB', '128 MB', '16 MB', '192 MB', '64 MB', '8 MB', '320 MB', '4 MB', '512 MB', '128 MB', '64 KB', '32 KB', '16 MB', '32 MB', '48 MB'][i],
  indexCount: [8, 5, 6, 7, 4, 3, 5, 4, 3, 4, 2, 1, 3, 4, 3][i],
  deadTuples: Math.floor(Math.random() * 500),
  lastVacuum: pastTs(1),
  lastAnalyze: pastTs(1),
  lastAutoVacuum: pastTs(0),
}));

const MOCK_PG_POOL = {
  maxConnections: 200,
  activeConnections: 42,
  idleConnections: 58,
  waitingClients: 0,
  totalConnectionsUsed: 100,
  poolUtilizationPercent: 50,
  avgQueryTimeMs: 12.3,
  slowQueryThresholdMs: 5000,
  connectionTimeoutMs: 30000,
};

const MOCK_PG_BACKUP = {
  lastBackupAt: pastTs(0),
  lastBackupSizeBytes: 1073741824,
  lastBackupSizeDisplay: '1.0 GB',
  lastBackupDurationSeconds: 120,
  backupSchedule: '0 2 * * *',
  backupRetentionDays: 30,
  backupLocation: 's3://erbu-backups/pg/',
  status: 'Healthy',
  nextScheduledAt: '2026-07-27T02:00:00Z',
  recentBackups: Array.from({ length: 5 }, (_, i) => ({
    id: uuid(1700 + i),
    timestamp: pastTs(i),
    sizeBytes: 1073741824 + i * 10485760,
    sizeDisplay: `${(1.0 + i * 0.01).toFixed(2)} GB`,
    durationSeconds: 115 + i * 5,
    status: 'Completed',
    type: 'Full',
  })),
};

const MOCK_PG_PURGE = [
  { id: uuid(1720), tableName: 'audit_logs', retentionDays: 90, schedule: '0 3 * * 0', lastRunAt: pastTs(3), rowsDeleted: 15000, nextRunAt: '2026-07-27T03:00:00Z', enabled: true },
  { id: uuid(1721), tableName: 'notifications', retentionDays: 30, schedule: '0 4 * * *', lastRunAt: pastTs(1), rowsDeleted: 8500, nextRunAt: '2026-07-27T04:00:00Z', enabled: true },
  { id: uuid(1722), tableName: 'sessions', retentionDays: 7, schedule: '0 5 * * *', lastRunAt: pastTs(1), rowsDeleted: 3200, nextRunAt: '2026-07-27T05:00:00Z', enabled: true },
];

// ════════════════════════════════════════════════════════════════
// 16. REDIS
// ════════════════════════════════════════════════════════════════

const MOCK_REDIS_STATS = {
  connectedClients: 24,
  usedMemoryBytes: 268435456,
  usedMemoryDisplay: '256 MB',
  totalKeysCount: 1250,
  opsPerSecond: 4500,
  hitRate: 0.942,
  uptimeSeconds: 432000,
  redisVersion: '7.2.4',
  databases: [
    { index: 0, keys: 850, expires: 420, avgTtlMs: 3600000 },
    { index: 1, keys: 300, expires: 300, avgTtlMs: 1800000 },
    { index: 2, keys: 100, expires: 50, avgTtlMs: 86400000 },
  ],
};

const MOCK_REDIS_KEY = {
  key: 'session:user:1000',
  type: 'hash',
  ttlSeconds: 3600,
  sizeBytes: 512,
  encoding: 'hashtable',
  value: { userId: uuid(1000), role: 'Admin', loginAt: ts(8, 0), ip: '196.203.42.10' },
  createdAt: ts(8, 0),
};

const MOCK_REDIS_KEYS: Array<{ key: string; type: string; ttlSeconds: number; sizeBytes: number; value: string | null }> = [
  { key: 'session:user:1000', type: 'hash', ttlSeconds: 3600, sizeBytes: 512, value: null },
  { key: 'session:user:1001', type: 'hash', ttlSeconds: 3200, sizeBytes: 480, value: null },
  { key: 'session:user:1002', type: 'hash', ttlSeconds: 2800, sizeBytes: 496, value: null },
  { key: 'driver:location:100', type: 'string', ttlSeconds: 60, sizeBytes: 128, value: '{"lat":36.8065,"lng":10.1815}' },
  { key: 'driver:location:101', type: 'string', ttlSeconds: 60, sizeBytes: 128, value: '{"lat":34.7406,"lng":10.7603}' },
  { key: 'driver:location:102', type: 'string', ttlSeconds: 60, sizeBytes: 128, value: '{"lat":35.8256,"lng":10.6084}' },
  { key: 'trip:active:500', type: 'hash', ttlSeconds: 1800, sizeBytes: 1024, value: null },
  { key: 'trip:active:501', type: 'hash', ttlSeconds: 1800, sizeBytes: 1024, value: null },
  { key: 'surge:zone:tunis-centre', type: 'string', ttlSeconds: 300, sizeBytes: 64, value: '1.8' },
  { key: 'surge:zone:lac', type: 'string', ttlSeconds: 300, sizeBytes: 64, value: '2.1' },
  { key: 'cache:geocode:tunis', type: 'string', ttlSeconds: 86400, sizeBytes: 2048, value: null },
  { key: 'cache:geocode:sfax', type: 'string', ttlSeconds: 86400, sizeBytes: 2048, value: null },
  { key: 'rate-limit:api:196.203.42.10', type: 'string', ttlSeconds: 60, sizeBytes: 16, value: '42' },
  { key: 'config:pricing:default', type: 'hash', ttlSeconds: -1, sizeBytes: 4096, value: null },
  { key: 'config:matching:weights', type: 'hash', ttlSeconds: -1, sizeBytes: 2048, value: null },
  { key: 'queue:notifications:pending', type: 'list', ttlSeconds: -1, sizeBytes: 8192, value: null },
  { key: 'queue:payments:retry', type: 'list', ttlSeconds: -1, sizeBytes: 4096, value: null },
  { key: 'stats:rides:2026-07-26', type: 'hash', ttlSeconds: 172800, sizeBytes: 256, value: null },
  { key: 'stats:rides:2026-07-25', type: 'hash', ttlSeconds: 172800, sizeBytes: 256, value: null },
  { key: 'lock:settlement:batch-42', type: 'string', ttlSeconds: 120, sizeBytes: 32, value: 'node-1' },
];

// ════════════════════════════════════════════════════════════════
// 17. MINIO
// ════════════════════════════════════════════════════════════════

const MOCK_MINIO_STATS = {
  totalBuckets: 5,
  totalObjects: 12340,
  totalSizeBytes: 48955678310,
  totalSizeDisplay: '45.6 GB',
  serverVersion: 'RELEASE.2024-06-13T22-53-53Z',
  serverUptime: '120 days',
  diskUsagePercent: 62,
};

const MINIO_BUCKET_NAMES = ['avatars', 'documents', 'receipts', 'exports', 'backups'];

const MOCK_MINIO_BUCKETS = MINIO_BUCKET_NAMES.map((name, i) => ({
  name,
  createdAt: pastTs(300),
  objectCount: [3500, 4200, 2800, 450, 1390][i],
  sizeBytes: [2147483648, 10737418240, 5368709120, 1073741824, 29728305718][i],
  sizeDisplay: ['2.0 GB', '10.0 GB', '5.0 GB', '1.0 GB', '27.7 GB'][i],
  versioning: i === 4,
  encryption: true,
  policy: i < 2 ? 'public-read' : 'private',
  lifecycle: i === 4 ? { enabled: true, expirationDays: 365 } : null,
}));

const MOCK_MINIO_OBJECTS = Array.from({ length: 10 }, (_, i) => ({
  key: [`avatar_${uuid(100 + i)}.jpg`, `license_${uuid(200 + i)}.pdf`, `receipt_${uuid(300 + i)}.pdf`, `export_2026_07_${20 + i}.csv`, `backup_2026_07_${20 + i}.tar.gz`][i % 5],
  bucket: MINIO_BUCKET_NAMES[i % 5],
  sizeBytes: [45000, 250000, 120000, 5000000, 1073741824][i % 5],
  contentType: ['image/jpeg', 'application/pdf', 'application/pdf', 'text/csv', 'application/gzip'][i % 5],
  lastModified: pastTs(i),
  etag: `"${uuid(2000 + i)}"`,
  metadata: {},
}));

// ════════════════════════════════════════════════════════════════
// 18. OBSERVABILITY
// ════════════════════════════════════════════════════════════════

const MOCK_OBSERVABILITY_OVERVIEW = {
  totalStorageSizeBytes: 134217728000,
  totalStorageSizeDisplay: '125 GB',
  logStorageSizeBytes: 48318382080,
  logStorageSizeDisplay: '45 GB',
  metricsStorageSizeBytes: 32212254720,
  metricsStorageSizeDisplay: '30 GB',
  traceStorageSizeBytes: 53687091200,
  traceStorageSizeDisplay: '50 GB',
  diskQuotaBytes: 536870912000,
  diskQuotaDisplay: '500 GB',
  diskUtilizationPercent: 25,
  ingestionRateMbPerMin: 2.5,
  estimatedDaysUntilFull: 120,
};

const MOCK_LOG_POLICIES = [
  { id: uuid(1800), name: 'Application Logs', logSource: 'app-*', retentionDays: 30, maxSizeGb: 50, currentSizeGb: 20, currentSizeDisplay: '20 GB', utilizationPercent: 40, compressionEnabled: true, isEnabled: false, lastPurgedAt: null, rowsPurgedLastRun: 0, createdAt: pastTs(180), updatedAt: pastTs(5) },
  { id: uuid(1801), name: 'Access Logs', logSource: 'access-*', retentionDays: 90, maxSizeGb: 40, currentSizeGb: 15, currentSizeDisplay: '15 GB', utilizationPercent: 37.5, compressionEnabled: true, isEnabled: false, lastPurgedAt: null, rowsPurgedLastRun: 0, createdAt: pastTs(180), updatedAt: pastTs(10) },
  { id: uuid(1802), name: 'Audit Logs', logSource: 'audit-*', retentionDays: 365, maxSizeGb: 30, currentSizeGb: 10, currentSizeDisplay: '10 GB', utilizationPercent: 33.3, compressionEnabled: true, isEnabled: false, lastPurgedAt: null, rowsPurgedLastRun: 0, createdAt: pastTs(180), updatedAt: pastTs(15) },
];

const MOCK_METRICS_STATS = {
  totalSeries: 4500,
  activeSeries: 3200,
  dataPointsPerSecond: 12000,
  storageSizeBytes: 32212254720,
  storageSizeDisplay: '30 GB',
  retentionDays: 90,
  scrapeIntervalSeconds: 15,
  targets: SERVICE_NAMES.length,
  activeTargets: SERVICE_NAMES.length - 1,
};

const MOCK_TRACE_QUOTAS = [
  { id: uuid(1810), serviceName: 'trip-service', dailyQuotaMb: 500, usedTodayMb: 125.3, samplingRate: 0.1, retentionDays: 14 },
  { id: uuid(1811), serviceName: 'payment-service', dailyQuotaMb: 300, usedTodayMb: 89.7, samplingRate: 0.2, retentionDays: 14 },
  { id: uuid(1812), serviceName: 'marketplace-service', dailyQuotaMb: 400, usedTodayMb: 156.2, samplingRate: 0.1, retentionDays: 7 },
];

const MOCK_CLEANUP_SCHEDULES = [
  { id: uuid(1820), name: 'Log Rotation', schedule: '0 1 * * *', lastRunAt: pastTs(1), nextRunAt: '2026-07-27T01:00:00Z', freedBytes: 2147483648, freedDisplay: '2 GB', status: 'Active', targetType: 'logs' },
  { id: uuid(1821), name: 'Metrics Downsampling', schedule: '0 2 * * 0', lastRunAt: pastTs(5), nextRunAt: '2026-08-02T02:00:00Z', freedBytes: 5368709120, freedDisplay: '5 GB', status: 'Active', targetType: 'metrics' },
  { id: uuid(1822), name: 'Trace Cleanup', schedule: '0 3 * * *', lastRunAt: pastTs(1), nextRunAt: '2026-07-27T03:00:00Z', freedBytes: 1073741824, freedDisplay: '1 GB', status: 'Active', targetType: 'traces' },
];

// ════════════════════════════════════════════════════════════════
// 19. TRACES
// ════════════════════════════════════════════════════════════════

const MOCK_TRACES_SEARCH = {
  traces: Array.from({ length: 10 }, (_, i) => ({
    traceId: uuid(1900 + i),
    rootServiceName: SERVICE_NAMES[i % SERVICE_NAMES.length],
    rootOperationName: ['POST /api/trips', 'GET /api/drivers', 'POST /api/payments/charge', 'GET /api/marketplace/network', 'POST /api/auth/login', 'GET /api/pricing/rules', 'POST /api/notifications/send', 'GET /api/geocoding/search', 'GET /api/trips/stats', 'POST /api/drivers/verify'][i],
    startTimeUnixNano: Date.parse(pastTs(i)) * 1000000,
    durationMs: 15 + Math.floor(Math.random() * 200),
    spanCount: 5 + (i % 8),
    serviceCount: 2 + (i % 4),
    errorCount: i === 4 ? 1 : 0,
  })),
  total: 10,
};

const MOCK_TRACE_DETAIL = {
  traceId: uuid(1900),
  rootSpan: {
    spanId: uuid(1950),
    operationName: 'POST /api/trips',
    serviceName: 'trip-service',
    startTimeUnixNano: Date.parse(ts(10, 0)) * 1000000,
    durationMs: 125,
    status: 'OK',
    tags: { 'http.method': 'POST', 'http.url': '/api/trips', 'http.status_code': 200 },
    children: [
      { spanId: uuid(1951), operationName: 'SELECT trips', serviceName: 'trip-service', startTimeUnixNano: Date.parse(ts(10, 0)) * 1000000 + 5000000, durationMs: 12, status: 'OK', tags: { 'db.type': 'postgresql' }, children: [] },
      { spanId: uuid(1952), operationName: 'POST /api/pricing/calculate', serviceName: 'pricing-service', startTimeUnixNano: Date.parse(ts(10, 0)) * 1000000 + 20000000, durationMs: 35, status: 'OK', tags: { 'http.method': 'POST' }, children: [] },
      { spanId: uuid(1953), operationName: 'POST /api/notifications', serviceName: 'notification-service', startTimeUnixNano: Date.parse(ts(10, 0)) * 1000000 + 60000000, durationMs: 45, status: 'OK', tags: { 'http.method': 'POST' }, children: [] },
    ],
  },
};

// ════════════════════════════════════════════════════════════════
// 20. ENV BACKUP
// ════════════════════════════════════════════════════════════════

const MOCK_ENV_BACKUPS = {
  items: Array.from({ length: 5 }, (_, i) => ({
    id: uuid(2000 + i),
    name: `env-backup-2026-07-${String(22 + i).padStart(2, '0')}`,
    environment: i < 3 ? 'production' : 'staging',
    status: 'Completed',
    createdAt: pastTs(4 - i),
    completedAt: pastTs(4 - i),
    sizeBytes: 524288 + i * 65536,
    serviceCount: 15,
    createdBy: 'admin@erbu.tn',
    notes: i === 0 ? 'Pre-deployment backup' : '',
    tags: i < 3 ? ['production', 'scheduled'] : ['staging', 'manual'],
    includesSecrets: false,
    checksumSha256: `sha256:${uuid(2050 + i).replace(/-/g, '')}`,
  })),
  total: 5,
  page: 1,
  pageSize: 20,
};

const MOCK_ENV_BACKUP_DETAIL = {
  ...MOCK_ENV_BACKUPS.items[0],
  services: SERVICE_NAMES.map((name, i) => ({
    serviceName: name,
    variableCount: 8 + i,
    hasSecrets: i < 5,
    lastModified: pastTs(i * 3),
  })),
  variables: Array.from({ length: 10 }, (_, i) => ({
    key: [`DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `STRIPE_KEY`, `MINIO_ENDPOINT`, `LOG_LEVEL`, `CORS_ORIGINS`, `SMTP_HOST`, `SENTRY_DSN`, `FEATURE_FLAGS`][i],
    value: i < 4 ? '********' : ['http://minio:9000', 'info', 'https://admin.erbu.tn', 'smtp.erbu.tn', 'https://sentry.erbu.tn/5', '{"darkMode":true}'][i - 4],
    isSecret: i < 4,
    service: SERVICE_NAMES[i % SERVICE_NAMES.length],
  })),
};

const MOCK_BACKUP_COMPARISON = {
  baseBackupId: uuid(2000),
  compareBackupId: uuid(2001),
  baseName: 'env-backup-2026-07-22',
  compareName: 'env-backup-2026-07-23',
  differences: [
    { key: 'LOG_LEVEL', service: 'trip-service', baseValue: 'info', compareValue: 'debug', type: 'Modified' },
    { key: 'FEATURE_NEW_PRICING', service: 'pricing-service', baseValue: null, compareValue: 'true', type: 'Added' },
    { key: 'LEGACY_MODE', service: 'auth-service', baseValue: 'true', compareValue: null, type: 'Removed' },
  ],
  totalChanges: 3,
  addedCount: 1,
  removedCount: 1,
  modifiedCount: 1,
};

// ════════════════════════════════════════════════════════════════
// 21. GEOSTUDIO MONITOR
// ════════════════════════════════════════════════════════════════

const MOCK_GEO_MONITOR_DASHBOARD = {
  kpi: { queryRatePerSec: 125.3, avgLatencyMs: 12, p99LatencyMs: 45, errorRatePct: 0.02, activeAlerts: 1, slowQueriesLast5m: 3, indexCount: 8, staleIndexCount: 0 },
  latencyHistory: Array.from({ length: 50 }, (_, i) => ({ timestamp: pastTs(49 - i), avgMs: +(8 + Math.sin(i * 0.3) * 5).toFixed(1), p50Ms: +(6 + Math.sin(i * 0.3) * 3).toFixed(1), p99Ms: +(30 + Math.sin(i * 0.3) * 15).toFixed(1) })),
  errorRateHistory: Array.from({ length: 50 }, (_, i) => ({ timestamp: pastTs(49 - i), errorRate: +(0.01 + Math.random() * 0.05).toFixed(3), totalRequests: 5000 + Math.floor(Math.random() * 2000), errorCount: Math.floor(Math.random() * 5) })),
  slowQueries: Array.from({ length: 5 }, (_, i) => ({ id: uuid(2100 + i), query: [`geo_search("restaurant near La Marsa")`, `reverse_geocode(36.81, 10.32)`, `autocomplete("avenue hab")`, `nearby_pois(36.80, 10.17, 2km)`, `route_search("Tunis to Sousse")`][i], durationMs: 500 + i * 200, timestamp: pastTs(0), source: SERVICE_NAMES[i % 5], indexName: `geo-index-${i}` })),
  indexFreshness: Array.from({ length: 8 }, (_, i) => ({ indexName: `geo-index-${i}`, documentCount: 5000 + i * 1500, lastUpdatedAt: pastTs(i % 3), lagSeconds: i * 30, status: i < 6 ? 'Fresh' : 'Stale' })),
  alerts: [
    { id: uuid(2110), severity: 'Warning', message: 'Slow query rate above threshold (3/5min)', source: 'query-monitor', createdAt: ts(14, 10), acknowledged: false },
    { id: uuid(2111), severity: 'Info', message: 'Index rebuild scheduled for geo-index-7', source: 'index-manager', createdAt: ts(12, 0), acknowledged: true },
  ],
  lastUpdatedAt: ts(14, 30),
};

const MOCK_GEO_ALERT_CONFIGS = Array.from({ length: 4 }, (_, i) => ({
  id: uuid(2120 + i),
  name: [`High Latency Alert`, `Error Rate Alert`, `Stale Index Alert`, `Slow Query Alert`][i],
  metric: ['avg_latency_ms', 'error_rate_pct', 'stale_index_count', 'slow_query_rate'][i],
  operator: ['>','>', '>', '>'][i],
  threshold: [100, 1.0, 2, 5][i],
  windowMinutes: [5, 5, 15, 5][i],
  severity: ['Critical', 'High', 'Medium', 'Medium'][i],
  enabled: true,
  notifyChannels: ['slack', 'email'],
  createdAt: pastTs(60),
}));

// ════════════════════════════════════════════════════════════════
// 22. GEOSTUDIO INGESTION
// ════════════════════════════════════════════════════════════════

const PIPELINE_NAMES = ['poi-ingestion', 'address-normalizer', 'boundary-import', 'route-indexer', 'elevation-sync'];
const PIPELINE_STATUSES_GEO = ['Running', 'Running', 'Running', 'Paused', 'Error'];

const MOCK_GEO_INGESTION_DASHBOARD = {
  kpi: { totalPipelines: 5, runningPipelines: 3, pausedPipelines: 1, errorPipelines: 1, totalDocumentsIngested: 45000, totalErrors: 23, avgThroughputDocsPerSec: 125.3, avgProcessingMs: 8.5 },
  pipelines: PIPELINE_NAMES.map((name, i) => ({
    id: uuid(2200 + i),
    name,
    status: (['running', 'running', 'running', 'paused', 'error'] as const)[i],
    source: ['OpenStreetMap', 'TunisiaGov', 'AdminBoundaries', 'RoutingGraph', 'SRTM'][i],
    destination: `geo-index-${i}`,
    documentCount: 5000 + i * 2500,
    errorCount: i === 4 ? 15 : i % 3,
    throughput: { documentsPerSecond: +(80 + i * 20).toFixed(1), bytesPerSecond: 1024000 + i * 500000, avgProcessingMs: +(5 + i * 2).toFixed(1) },
    lastDocumentAt: pastTs(i / 10),
    createdAt: pastTs(90),
    updatedAt: pastTs(i % 2),
    schedule: i < 3 ? '*/5 * * * *' : null,
    tags: [['poi', 'geo'], ['address', 'normalize'], ['boundary', 'admin'], ['route', 'graph'], ['elevation', 'srtm']][i],
  })),
  recentErrors: [
    { id: uuid(2210), pipelineId: uuid(2204), pipelineName: 'elevation-sync', message: 'Connection timeout to SRTM source', stackTrace: 'at HttpClient.SendAsync() at SrtmConnector.FetchTile()', documentId: null, occurredAt: ts(13, 45), severity: 'error' as const },
    { id: uuid(2211), pipelineId: uuid(2200), pipelineName: 'poi-ingestion', message: 'Invalid coordinates in document POI-45123', stackTrace: null, documentId: 'POI-45123', occurredAt: ts(12, 30), severity: 'warning' as const },
    { id: uuid(2212), pipelineId: uuid(2202), pipelineName: 'boundary-import', message: 'Duplicate boundary detected for zone Ariana', stackTrace: null, documentId: 'BND-7892', occurredAt: ts(11, 15), severity: 'warning' as const },
  ],
  lastUpdatedAt: ts(14, 30),
};

const MOCK_PIPELINE_ERRORS = MOCK_GEO_INGESTION_DASHBOARD.recentErrors;

const MOCK_PIPELINE_CONFIG = {
  pipelineId: uuid(2200),
  pipelineName: 'poi-ingestion',
  source: { type: 'http', url: 'https://api.openstreetmap.org/pois', format: 'geojson', pollIntervalSeconds: 300 },
  transform: { normalizeCoordinates: true, deduplication: true, enrichment: ['category-mapping', 'name-transliteration'] },
  destination: { indexName: 'geo-index-0', batchSize: 500, flushIntervalMs: 5000 },
  errorHandling: { maxRetries: 3, deadLetterQueue: 'dlq-poi-ingestion', alertOnError: true },
  scheduling: { enabled: true, cronExpression: '*/5 * * * *' },
};

// ════════════════════════════════════════════════════════════════
// 23. GEOSTUDIO INFRASTRUCTURE
// ════════════════════════════════════════════════════════════════

const MOCK_GEO_INFRA_DASHBOARD = {
  kpi: { totalNodes: 4, nodesOnline: 3, nodesDegraded: 1, nodesOffline: 0, avgCpuPct: 42.5, avgMemoryPct: 58.3, avgDiskPct: 45.2, totalNetworkInMbps: 125, totalNetworkOutMbps: 98 },
  nodes: Array.from({ length: 4 }, (_, i) => ({
    id: uuid(2300 + i),
    hostname: `geo-node-${i + 1}`,
    ipAddress: `10.0.1.${10 + i}`,
    status: i < 3 ? 'Online' : 'Degraded',
    cpuPercent: +(30 + i * 10 + Math.random() * 10).toFixed(1),
    memoryPercent: +(45 + i * 8).toFixed(1),
    diskPercent: +(35 + i * 5).toFixed(1),
    shardsCount: 8,
    documentsCount: 10000 + i * 5000,
    uptimeSeconds: 864000 + i * 100000,
    lastSeenAt: ts(14, 29),
    role: i === 0 ? 'Master' : 'Data',
  })),
  cache: { totalSizeBytes: 536870912, usedSizeBytes: 322122547, hitRate: 0.94, missRate: 0.06, evictionRate: 0.002, entries: 45000, avgTtlSeconds: 3600 },
  index: { totalIndices: 8, totalDocuments: 45000, totalSizeBytes: 2147483648, totalSizeDisplay: '2 GB', avgQueryTimeMs: 12, queriesPerSecond: 125.3, indexingRate: 50.2 },
  cluster: { clusterName: 'erbu-geo-cluster', health: 'green', numberOfNodes: 4, activeShards: 32, relocatingShards: 0, pendingTasks: 0, upSince: pastTs(30) },
  lastUpdatedAt: ts(14, 30),
};

const MOCK_GEO_INFRA_NODES = MOCK_GEO_INFRA_DASHBOARD.nodes;

// ════════════════════════════════════════════════════════════════
// 24. CHAOS (GEO)
// ════════════════════════════════════════════════════════════════

const MOCK_GEO_CHAOS_DASHBOARD = {
  faults: [
    { id: uuid(2400), name: 'Latency Injection', type: 'LatencyInjection', targetService: 'geocoding-service', status: 'Inactive', durationMs: 500, percentage: 10, createdAt: pastTs(30), lastActivatedAt: null },
    { id: uuid(2401), name: 'Error Rate Increase', type: 'ErrorInjection', targetService: 'search-service', status: 'Inactive', errorRate: 5, errorCode: 503, createdAt: pastTs(25), lastActivatedAt: null },
    { id: uuid(2402), name: 'Connection Drop', type: 'ConnectionDrop', targetService: 'index-service', status: 'Inactive', dropRate: 2, createdAt: pastTs(20), lastActivatedAt: null },
  ],
  scenarios: [
    { id: uuid(2410), name: 'Peak Load Resilience', description: 'Simulate peak hour conditions with degraded search', faults: [uuid(2400), uuid(2401)], status: 'Inactive', schedule: null, createdAt: pastTs(15), lastRunAt: null },
    { id: uuid(2411), name: 'Database Failover', description: 'Test database failover with connection drops', faults: [uuid(2402)], status: 'Inactive', schedule: null, createdAt: pastTs(10), lastRunAt: null },
  ],
  state: { killSwitchActive: false, activeFaultCount: 0, activeScenarioCount: 0, totalFaults: 3, totalScenarios: 2, lastKillSwitchAt: null, lastKillSwitchBy: null, featureFlagEnabled: false },
};

// ════════════════════════════════════════════════════════════════
// 25. SEARCH EXPLORER
// ════════════════════════════════════════════════════════════════

const MOCK_SEARCH_INDICES = Array.from({ length: 8 }, (_, i) => ({
  name: `geo-index-${i}`,
  documentCount: 5000 + i * 1500,
  sizeBytes: 268435456 + i * 67108864,
  sizeDisplay: `${(0.25 + i * 0.0625).toFixed(2)} GB`,
  status: 'Open',
  shardCount: 4,
  replicaCount: 1,
  createdAt: pastTs(120),
  lastUpdatedAt: pastTs(i % 3),
  mappingFields: 12 + i * 2,
}));

const MOCK_SAVED_QUERIES = [
  { id: uuid(2500), name: 'Restaurants near La Marsa', query: '{"type":"geo_search","term":"restaurant","center":{"lat":36.8783,"lng":10.3247},"radiusKm":2}', indexName: 'geo-index-0', createdAt: pastTs(30), lastUsedAt: pastTs(1), usageCount: 45 },
  { id: uuid(2501), name: 'Hotels in Tunis Centre', query: '{"type":"geo_search","term":"hotel","center":{"lat":36.7992,"lng":10.1658},"radiusKm":3}', indexName: 'geo-index-0', createdAt: pastTs(25), lastUsedAt: pastTs(2), usageCount: 32 },
  { id: uuid(2502), name: 'Pharmacies Sousse', query: '{"type":"geo_search","term":"pharmacie","center":{"lat":35.8254,"lng":10.6361},"radiusKm":5}', indexName: 'geo-index-0', createdAt: pastTs(20), lastUsedAt: pastTs(5), usageCount: 18 },
  { id: uuid(2503), name: 'Gas Stations Highway', query: '{"type":"geo_search","term":"station service","filters":{"highway":true}}', indexName: 'geo-index-1', createdAt: pastTs(15), lastUsedAt: pastTs(3), usageCount: 28 },
  { id: uuid(2504), name: 'Schools Ariana', query: '{"type":"geo_search","term":"école","center":{"lat":36.8602,"lng":10.1934},"radiusKm":4}', indexName: 'geo-index-0', createdAt: pastTs(10), lastUsedAt: pastTs(1), usageCount: 15 },
];

const MOCK_SEARCH_RESPONSE = {
  results: Array.from({ length: 10 }, (_, i) => ({
    id: uuid(2520 + i),
    score: +(0.95 - i * 0.05).toFixed(3),
    source: { name: [`Restaurant El Walima`, `Café Sidi Bou Said`, `Boulangerie Masmoudi`, `Pharmacie Centrale`, `Hôtel Africa`, `Supermarché Magasin Général`, `Banque BIAT`, `Mosquée Zitouna`, `École Primaire Ibn Khaldoun`, `Clinique La Marsa`][i], lat: +(36.78 + i * 0.005).toFixed(6), lng: +(10.17 + i * 0.008).toFixed(6), category: ['restaurant', 'cafe', 'bakery', 'pharmacy', 'hotel', 'supermarket', 'bank', 'mosque', 'school', 'clinic'][i], address: TUNIS_ADDRESSES[i % TUNIS_ADDRESSES.length] },
    highlights: { name: [`<em>Restaurant</em> El Walima`][0] },
  })),
  totalCount: 156,
  tookMs: 12,
  suggestions: ['restaurant tunis', 'restaurants la marsa', 'restaurant halal'],
};

// ════════════════════════════════════════════════════════════════
// 26. COLLECTIONS
// ════════════════════════════════════════════════════════════════

const COLLECTION_NAMES = ['Points of Interest', 'Address Database', 'Route Network', 'Boundaries', 'Elevation Data', 'Transit Stops'];

const MOCK_COLLECTIONS = {
  items: COLLECTION_NAMES.map((name, i) => ({
    id: uuid(2600 + i),
    name,
    description: `Collection for ${name.toLowerCase()} geographic data`,
    status: i < 5 ? 'Active' : 'Building',
    documentCount: 5000 + i * 3000,
    storageSizeBytes: 536870912 + i * 268435456,
    shardCount: 4,
    replicaCount: 1,
    createdAt: pastTs(120),
    updatedAt: pastTs(i),
    tags: [['poi', 'search'], ['address', 'geocoding'], ['routing', 'navigation'], ['admin', 'boundaries'], ['terrain', 'elevation'], ['transit', 'public-transport']][i],
  })),
  total: 6,
  page: 1,
  pageSize: 20,
};

const MOCK_COLLECTION_SUMMARY = {
  totalCollections: 6,
  totalDocuments: 52000,
  totalStorageBytes: 4294967296,
  totalStorageDisplay: '4.0 GB',
  activeCollections: 5,
  buildingCollections: 1,
};

const MOCK_COLLECTION_DETAIL = {
  ...MOCK_COLLECTIONS.items[0],
  schema: { fields: [{ name: 'name', type: 'text' }, { name: 'location', type: 'geo_point' }, { name: 'category', type: 'keyword' }, { name: 'address', type: 'text' }] },
  statistics: { avgDocumentSizeBytes: 512, insertRate: 50.2, queryRate: 125.3, lastOptimizedAt: pastTs(7) },
};

// ════════════════════════════════════════════════════════════════
// 27. HISTORY
// ════════════════════════════════════════════════════════════════

const MOCK_HISTORY_DASHBOARD = {
  stats: {
    totalQueries: 125000,
    avgLatencyMs: 12.5,
    p95LatencyMs: 35,
    p99LatencyMs: 45,
    errorRate: 0.002,
    uniqueUsers: 45,
    topQueries: Array.from({ length: 5 }, (_, i) => ({ queryText: ['restaurant', 'pharmacie', 'hotel', 'taxi', 'banque'][i], count: 5000 - i * 800, avgLatencyMs: 10 + i * 2, avgResultCount: 25 + i * 5 })),
    queryVolume: Array.from({ length: 24 }, (_, i) => ({ timestamp: pastTs(1 - i / 24), count: 2000 + Math.floor(Math.sin((i - 6) * 0.4) * 3000), avgLatencyMs: +(10 + Math.sin(i * 0.3) * 5).toFixed(1), errorCount: Math.floor(i * 0.3), p95LatencyMs: +(30 + Math.sin(i * 0.4) * 10).toFixed(1) })),
    slowQueries: Array.from({ length: 3 }, (_, i) => ({ query: [`complex_geo_search("${['hôpital urgences', 'route panoramique côte', 'zone industrielle'][i]}")`, ][0] || `slow_query_${i}`, durationMs: 800 + i * 300, timestamp: pastTs(i) })),
  },
  recentQueries: Array.from({ length: 30 }, (_, i) => ({
    id: uuid(2700 + i),
    queryText: ['restaurant tunis', 'reverse_geocode(36.81, 10.18)', 'pharmacie bardo', 'hotel hammamet', 'route tunis sousse', 'taxi aeroport', 'banque carthage', 'cafe marsa', 'supermarche ariana', 'clinique sousse'][i % 10],
    index: `geo-index-${i % 3}`,
    tookMs: 5 + i * 3,
    resultCount: 10 + i * 8,
    userId: uuid(1000 + (i % 10)),
    userName: ['Ahmed Ben Ali', 'Fatma Trabelsi', 'Mohamed Chaabane', 'Leila Bouzid', 'Karim Gharbi', null, 'Sonia Mejri', 'Youssef Hamdi', null, 'Amira Sassi'][i % 10],
    executedAt: pastTs(i / 10),
    statusCode: i % 20 === 0 ? 500 : 200,
    rankingProfile: i % 3 === 0 ? 'default' : null,
    filters: i % 4 === 0 ? { category: 'restaurant' } : {},
    source: ['web', 'api', 'mobile', 'admin'][i % 4],
    correlationId: i % 5 === 0 ? uuid(9000 + i) : null,
  })),
  lastUpdatedAt: ts(14, 30),
};

const MOCK_HISTORY_SEARCH = {
  items: MOCK_HISTORY_DASHBOARD.recentQueries.slice(0, 20),
  total: 20,
  page: 1,
  pageSize: 20,
};

const MOCK_QUERY_VOLUME = Array.from({ length: 48 }, (_, i) => ({
  timestamp: pastTs(2 - i / 24),
  count: 3000 + Math.floor(Math.sin(i * 0.3) * 1500),
  avgLatencyMs: +(10 + Math.random() * 10).toFixed(1),
}));

// ════════════════════════════════════════════════════════════════
// 28. KNOWLEDGE GRAPH
// ════════════════════════════════════════════════════════════════

const MOCK_GRAPH_STATS = {
  totalNodes: 1250,
  totalEdges: 3400,
  avgDegree: 2.7,
  density: 0.0043,
  connectedComponents: 12,
  nodesByType: { Place: 450, Category: 120, Region: 80, Route: 200, Service: 150, Person: 250 },
  edgesByType: { LOCATED_IN: 800, BELONGS_TO: 600, CONNECTS: 400, SERVES: 350, NEAR: 750, HAS_CATEGORY: 500 },
  lastUpdatedAt: ts(14, 0),
};

const MOCK_GRAPH_DATA = {
  nodes: Array.from({ length: 10 }, (_, i) => ({
    id: uuid(2800 + i),
    label: ['Tunis Centre', 'La Marsa', 'Restaurant', 'Hotel', 'Route Tunis-Sousse', 'Taxi Service', 'Gouvernorat Tunis', 'Pharmacie', 'École', 'Mosquée'][i],
    type: ['Region', 'Region', 'Category', 'Category', 'Route', 'Service', 'Region', 'Category', 'Category', 'Category'][i],
    properties: { createdAt: pastTs(90), documentsCount: 100 + i * 50 },
  })),
  edges: Array.from({ length: 15 }, (_, i) => ({
    id: uuid(2850 + i),
    source: uuid(2800 + (i % 10)),
    target: uuid(2800 + ((i + 3) % 10)),
    type: ['LOCATED_IN', 'BELONGS_TO', 'CONNECTS', 'SERVES', 'NEAR', 'HAS_CATEGORY'][i % 6],
    weight: +(0.5 + Math.random() * 0.5).toFixed(3),
    properties: {},
  })),
};

const MOCK_ENTITY_SEARCH = Array.from({ length: 5 }, (_, i) => ({
  id: uuid(2800 + i),
  label: ['Tunis Centre', 'La Marsa', 'Restaurant', 'Hotel', 'Route Tunis-Sousse'][i],
  type: ['Region', 'Region', 'Category', 'Category', 'Route'][i],
  score: +(0.95 - i * 0.1).toFixed(2),
  connections: 5 + i * 3,
}));

const MOCK_GRAPH_NODE = {
  ...MOCK_GRAPH_DATA.nodes[0],
  connections: MOCK_GRAPH_DATA.edges.filter(e => e.source === uuid(2800) || e.target === uuid(2800)),
  metadata: { createdAt: pastTs(90), updatedAt: pastTs(5), createdBy: 'system' },
};

const MOCK_ENTITY_NEIGHBORHOOD = {
  center: MOCK_GRAPH_DATA.nodes[0],
  neighbors: MOCK_GRAPH_DATA.nodes.slice(1, 5),
  edges: MOCK_GRAPH_DATA.edges.slice(0, 6),
  depth: 1,
};

// ════════════════════════════════════════════════════════════════
// 29. FEATURE STORE
// ════════════════════════════════════════════════════════════════

const MOCK_FEATURE_STORE_SUMMARY = {
  totalFeatures: 10,
  totalGroups: 4,
  freshCount: 7,
  staleCount: 2,
  expiredCount: 1,
  totalRows: 850000,
  avgNullPercentage: 2.3,
  importanceRanking: Array.from({ length: 10 }, (_, i) => ({
    featureId: uuid(2900 + i),
    featureName: ['query_frequency', 'click_through_rate', 'avg_session_duration', 'bounce_rate', 'geo_diversity_score', 'freshness_decay', 'popularity_rank', 'semantic_similarity', 'user_preference_vector', 'seasonal_trend'][i],
    importance: +(0.95 - i * 0.07).toFixed(3),
    rank: i + 1,
  })),
  groups: [
    { name: 'user-behavior', featureCount: 4, totalRows: 320000, lastUpdatedAt: pastTs(0) },
    { name: 'content-signals', featureCount: 3, totalRows: 250000, lastUpdatedAt: pastTs(1) },
    { name: 'embeddings', featureCount: 2, totalRows: 180000, lastUpdatedAt: pastTs(2) },
    { name: 'temporal', featureCount: 1, totalRows: 100000, lastUpdatedAt: pastTs(3) },
  ],
};

const MOCK_FEATURES = {
  items: Array.from({ length: 10 }, (_, i) => ({
    id: uuid(2900 + i),
    name: ['query_frequency', 'click_through_rate', 'avg_session_duration', 'bounce_rate', 'geo_diversity_score', 'freshness_decay', 'popularity_rank', 'semantic_similarity', 'user_preference_vector', 'seasonal_trend'][i],
    group: ['user-behavior', 'user-behavior', 'user-behavior', 'user-behavior', 'content-signals', 'content-signals', 'content-signals', 'embeddings', 'embeddings', 'temporal'][i],
    dataType: (['Float64', 'Float32', 'Float64', 'Float32', 'Float64', 'Float32', 'Int32', 'Vector', 'Vector', 'Float64'] as const)[i],
    dimensions: i === 7 ? 128 : i === 8 ? 256 : null,
    description: ['Query frequency for ranking', 'Click-through rate per result', 'Average session duration metric', 'Bounce rate indicator', 'Geographic diversity scoring', 'Content freshness decay factor', 'Popularity ranking signal', 'Semantic similarity measure', 'User preference vector', 'Seasonal trend factor'][i],
    source: ['query-logs', 'click-stream', 'session-data', 'analytics', 'geo-data', 'content-db', 'usage-stats', 'embeddings', 'user-profiles', 'time-series'][i],
    freshnessStatus: (['Fresh', 'Fresh', 'Fresh', 'Fresh', 'Fresh', 'Fresh', 'Fresh', 'Stale', 'Stale', 'Expired'] as const)[i],
    lastComputedAt: pastTs(i % 3),
    ttlSeconds: 14400,
    rowCount: 50000 + i * 10000,
    nullPercentage: +(0.5 + i * 0.4).toFixed(1),
    createdAt: pastTs(90 - i * 5),
    updatedAt: pastTs(i % 3),
    tags: [['ranking', 'core'], ['ctr', 'engagement'], ['session', 'duration'], ['bounce', 'quality'], ['geo', 'diversity'], ['freshness', 'decay'], ['popularity'], ['semantic', 'vector'], ['user', 'embedding'], ['temporal', 'trend']][i],
    version: i + 1,
  })),
  total: 10,
  page: 1,
  pageSize: 25,
};

// ════════════════════════════════════════════════════════════════
// 30. DIGITAL TWIN
// ════════════════════════════════════════════════════════════════

const MOCK_TWIN_DASHBOARD: {
  configs: Array<{ id: string; name: string; sourceEnvironment: string; targetEnvironment: string; isShadowMode: boolean; trafficPercentage: number; comparisonMetrics: string[]; divergenceThreshold: number; isActive: boolean; status: string; createdAt: string; updatedAt: string; lastSyncAt: string | null; divergenceCount: number; matchRate: number; totalComparisons: number }>;
  trafficComparisons: Array<{ timestamp: string; liveRequestCount: number; shadowRequestCount: number; liveAvgLatencyMs: number; shadowAvgLatencyMs: number; liveErrorRate: number; shadowErrorRate: number; matchRate: number; divergenceCount: number }>;
  divergenceMetrics: Array<{ timestamp: string; metricName: string; liveValue: number; shadowValue: number; delta: number; deltaPercent: number; level: string }>;
  recentDivergences: Array<{ id: string; queryText: string; executedAt: string; liveResultCount: number; shadowResultCount: number; resultCountDelta: number; liveLatencyMs: number; shadowLatencyMs: number; latencyDelta: number; topLiveDocs: string[]; topShadowDocs: string[]; overlapPercent: number; divergenceLevel: string }>;
  lastUpdatedAt: string;
} = {
  configs: [
    { id: uuid(3000), name: 'Production Mirror', sourceEnvironment: 'production', targetEnvironment: 'shadow', isShadowMode: true, trafficPercentage: 10, comparisonMetrics: ['latency', 'result_count', 'top_10_overlap'], divergenceThreshold: 5.0, isActive: true, status: 'Active', createdAt: pastTs(60), updatedAt: pastTs(1), lastSyncAt: ts(14, 25), divergenceCount: 12, matchRate: 96.8, totalComparisons: 45000 },
    { id: uuid(3001), name: 'Staging Preview', sourceEnvironment: 'staging', targetEnvironment: 'preview', isShadowMode: true, trafficPercentage: 25, comparisonMetrics: ['latency', 'result_count'], divergenceThreshold: 10.0, isActive: false, status: 'Paused', createdAt: pastTs(30), updatedAt: pastTs(5), lastSyncAt: pastTs(2), divergenceCount: 34, matchRate: 91.2, totalComparisons: 42000 },
    { id: uuid(3002), name: 'Canary Release', sourceEnvironment: 'production', targetEnvironment: 'canary', isShadowMode: false, trafficPercentage: 5, comparisonMetrics: ['latency', 'error_rate'], divergenceThreshold: 3.0, isActive: true, status: 'Active', createdAt: pastTs(7), updatedAt: pastTs(0), lastSyncAt: ts(14, 28), divergenceCount: 3, matchRate: 98.5, totalComparisons: 8200 },
  ],
  trafficComparisons: Array.from({ length: 10 }, (_, i) => ({
    timestamp: pastTs(i),
    liveRequestCount: 5000 + i * 200,
    shadowRequestCount: 480 + i * 20,
    liveAvgLatencyMs: 12 + i * 2,
    shadowAvgLatencyMs: 15 + i * 3,
    liveErrorRate: +(0.1 + i * 0.05).toFixed(2),
    shadowErrorRate: +(0.2 + i * 0.08).toFixed(2),
    matchRate: +(97 - i * 0.5).toFixed(1),
    divergenceCount: 2 + i,
  })),
  divergenceMetrics: Array.from({ length: 8 }, (_, i) => ({
    timestamp: pastTs(i),
    metricName: ['latency', 'result_count', 'top_10_overlap', 'error_rate', 'latency', 'result_count', 'top_10_overlap', 'error_rate'][i],
    liveValue: [18, 42, 95, 0.1, 22, 38, 92, 0.15][i],
    shadowValue: [24, 40, 88, 0.3, 28, 35, 85, 0.4][i],
    delta: [6, -2, -7, 0.2, 6, -3, -7, 0.25][i],
    deltaPercent: [33.3, -4.8, -7.4, 200, 27.3, -7.9, -7.6, 166.7][i],
    level: (['Low', 'Low', 'Medium', 'High', 'Low', 'Low', 'Medium', 'Critical'] as const)[i],
  })),
  recentDivergences: Array.from({ length: 5 }, (_, i) => ({
    id: uuid(3020 + i),
    queryText: ['restaurant tunis', 'pharmacie bardo', 'hotel hammamet', 'taxi aeroport', 'banque carthage'][i],
    executedAt: pastTs(i),
    liveResultCount: 10,
    shadowResultCount: 10 + i,
    resultCountDelta: i,
    liveLatencyMs: 15 + i * 3,
    shadowLatencyMs: 22 + i * 5,
    latencyDelta: 7 + i * 2,
    topLiveDocs: [uuid(2520 + i * 3), uuid(2521 + i * 3), uuid(2522 + i * 3)],
    topShadowDocs: [uuid(2522 + i * 3), uuid(2520 + i * 3), uuid(2523 + i * 3)],
    overlapPercent: +(95 - i * 3).toFixed(1),
    divergenceLevel: (['Low', 'Low', 'Medium', 'High', 'Critical'] as const)[i],
  })),
  lastUpdatedAt: ts(14, 30),
};

const MOCK_TWIN_SHADOW_QUERIES = Array.from({ length: 8 }, (_, i) => ({
  id: uuid(3030 + i),
  queryText: ['restaurant tunis', 'pharmacie bardo', 'hotel hammamet', 'taxi aeroport', 'banque carthage', 'cafe marsa', 'supermarche ariana', 'clinique sousse'][i],
  executedAt: pastTs(i),
  liveResults: Array.from({ length: 3 }, (_, j) => ({ documentId: uuid(2600 + i * 3 + j), title: `Result ${j + 1} for query ${i + 1}`, score: +(0.95 - j * 0.1).toFixed(3), position: j + 1 })),
  shadowResults: Array.from({ length: 3 }, (_, j) => ({ documentId: uuid(2600 + i * 3 + (j === 0 ? 1 : j === 1 ? 0 : j)), title: `Result ${(j === 0 ? 2 : j === 1 ? 1 : 3)} for query ${i + 1}`, score: +(0.93 - j * 0.08).toFixed(3), position: j + 1 })),
  liveLatencyMs: 12 + i * 2,
  shadowLatencyMs: 18 + i * 3,
  overlapPercent: +(90 + i).toFixed(1),
  positionChanges: i < 5 ? [{ documentId: uuid(2600 + i * 3), title: `Result 1 for query ${i + 1}`, livePosition: 1, shadowPosition: 2, delta: 1 }] : [],
}));

const MOCK_FEATURE_STATS = {
  featureId: uuid(2900),
  mean: 42.5,
  median: 38.2,
  stdDev: 12.8,
  min: 0,
  max: 150.3,
  p25: 28.1,
  p75: 55.9,
  p95: 82.4,
  p99: 120.6,
  distinctCount: 8432,
  nullCount: 245,
  totalCount: 50000,
  histogram: Array.from({ length: 10 }, (_, i) => ({ bucketStart: i * 15, bucketEnd: (i + 1) * 15, count: Math.floor(5000 - Math.abs(i - 5) * 800) })),
};

// ════════════════════════════════════════════════════════════════
// 31. QUALITY
// ════════════════════════════════════════════════════════════════

const MOCK_QUALITY_DASHBOARD = {
  reports: Array.from({ length: 4 }, (_, i) => ({
    id: uuid(3100 + i),
    reportType: ['Relevance', 'Freshness', 'Coverage', 'Consistency'][i],
    overallScore: +(88 + i * 2).toFixed(1),
    sampleSize: 1000 + i * 500,
    issues: [
      ['Low NDCG for "transport" category', 'Missing synonyms for local terms'],
      ['2 indices have stale data (>24h)', 'Freshness SLO at risk for poi-index'],
      ['Uncovered: transport en commun', 'Uncovered: location voiture'],
      ['Result inconsistency between replicas', 'Score drift detected on ranking model v3'],
    ][i],
    generatedAt: pastTs(i * 7),
    generatedBy: i % 2 === 0 ? 'Scheduled' : 'admin@erbu.tn',
  })),
  testResults: Array.from({ length: 6 }, (_, i) => ({
    id: uuid(3120 + i),
    testName: ['Relevance Test', 'Latency Test', 'Recall Test', 'Precision Test', 'Coverage Test', 'Freshness Test'][i],
    suite: ['relevance', 'performance', 'relevance', 'relevance', 'coverage', 'freshness'][i],
    status: (['Passed', 'Passed', 'Passed', 'Passed', 'Passed', 'Failed'] as const)[i],
    score: +(85 + i * 2).toFixed(1),
    threshold: 80,
    executedAt: pastTs(i % 3),
    durationMs: 5000 + i * 1000,
    errorMessage: i === 5 ? 'Freshness below threshold for 2 indices' : null,
    affectedQueries: i === 5 ? 342 : 0,
  })),
  regressionAlerts: [
    { id: uuid(3130), metricName: 'NDCG@10', previousValue: 0.85, currentValue: 0.82, changePercent: -3.5, severity: 'High' as const, detectedAt: pastTs(1), isAcknowledged: false, description: 'NDCG@10 dropped 3.5% after ranking model update', affectedCollection: 'poi-index' },
    { id: uuid(3131), metricName: 'P99 Latency', previousValue: 45, currentValue: 62, changePercent: 37.8, severity: 'Medium' as const, detectedAt: pastTs(3), isAcknowledged: true, description: 'P99 latency increased after index refresh', affectedCollection: 'address-index' },
  ],
  coverageMetrics: [
    { category: 'Restaurants', totalQueries: 2500, coveredQueries: 2450, coveragePercent: 98.0, avgRelevanceScore: 0.91, trend: 'Stable' as const },
    { category: 'Hotels', totalQueries: 1800, coveredQueries: 1750, coveragePercent: 97.2, avgRelevanceScore: 0.88, trend: 'Rising' as const },
    { category: 'Pharmacies', totalQueries: 1200, coveredQueries: 1150, coveragePercent: 95.8, avgRelevanceScore: 0.85, trend: 'Stable' as const },
    { category: 'Transport', totalQueries: 800, coveredQueries: 680, coveragePercent: 85.0, avgRelevanceScore: 0.72, trend: 'Falling' as const },
    { category: 'Banks', totalQueries: 600, coveredQueries: 580, coveragePercent: 96.7, avgRelevanceScore: 0.89, trend: 'Rising' as const },
  ],
  trendData: Array.from({ length: 12 }, (_, i) => ({
    date: pastTs(12 - i),
    relevanceScore: +(0.88 + Math.sin(i * 0.5) * 0.03).toFixed(3),
    coveragePercent: +(95 + Math.sin(i * 0.4) * 2).toFixed(1),
    freshnessScore: +(0.90 + Math.sin(i * 0.3) * 0.04).toFixed(3),
    consistencyScore: +(0.92 + Math.sin(i * 0.6) * 0.02).toFixed(3),
  })),
  overallScore: 92.5,
  lastEvaluatedAt: ts(14, 0),
};

const MOCK_QUALITY_REPORTS = MOCK_QUALITY_DASHBOARD.reports;
const MOCK_QUALITY_TESTS = MOCK_QUALITY_DASHBOARD.testResults;

// ════════════════════════════════════════════════════════════════
// 32. LEARNING
// ════════════════════════════════════════════════════════════════

const LEARNING_MODEL_STATUSES = ['Active', 'Trained', 'Evaluated', 'Approved'];

const MOCK_LEARNING_MODELS = Array.from({ length: 4 }, (_, i) => ({
  id: uuid(3200 + i),
  name: [`Ranking Model v3`, `Query Understanding v2`, `Personalization v1`, `Spell Correction v4`][i],
  type: ['Ranking', 'NLU', 'Personalization', 'SpellCheck'][i],
  status: LEARNING_MODEL_STATUSES[i],
  version: `${3 - i}.0.0`,
  accuracy: +(0.92 - i * 0.02).toFixed(3),
  trainingDataSize: 50000 + i * 15000,
  lastTrainedAt: pastTs(i * 7),
  trainDurationMinutes: 45 + i * 15,
  metrics: { precision: +(0.93 - i * 0.02).toFixed(3), recall: +(0.89 - i * 0.01).toFixed(3), f1: +(0.91 - i * 0.015).toFixed(3) },
  createdAt: pastTs(60 + i * 15),
  createdBy: 'ml-pipeline',
  deployedAt: i === 0 ? pastTs(5) : null,
}));

const MOCK_LEARNING_DASHBOARD = {
  models: MOCK_LEARNING_MODELS,
  trainingHistory: Array.from({ length: 10 }, (_, i) => ({
    id: uuid(3220 + i),
    modelId: uuid(3200 + (i % 4)),
    modelName: MOCK_LEARNING_MODELS[i % 4].name,
    status: i < 8 ? 'Completed' : 'Failed',
    startedAt: pastTs(i * 3),
    completedAt: pastTs(i * 3),
    durationMinutes: 30 + i * 10,
    accuracy: +(0.88 + Math.random() * 0.06).toFixed(3),
    triggeredBy: i % 2 === 0 ? 'Scheduled' : 'Manual',
  })),
  trainingChartData: Array.from({ length: 20 }, (_, i) => ({
    epoch: i + 1,
    loss: +(0.5 * Math.exp(-i * 0.15) + 0.05).toFixed(4),
    accuracy: +(1 - 0.5 * Math.exp(-i * 0.15)).toFixed(4),
    valLoss: +(0.5 * Math.exp(-i * 0.12) + 0.08).toFixed(4),
    valAccuracy: +(1 - 0.5 * Math.exp(-i * 0.12) - 0.03).toFixed(4),
  })),
  activeModelId: uuid(3200),
};

// ════════════════════════════════════════════════════════════════
// 33. EXPERIMENTS
// ════════════════════════════════════════════════════════════════

const MOCK_EXPERIMENTS_DASHBOARD = {
  experiments: Array.from({ length: 6 }, (_, i) => ({
    id: uuid(3300 + i),
    name: ['Ranking Algorithm A/B', 'New Autocomplete', 'Personalized Results', 'Semantic Search v2', 'Category Boost Test', 'Freshness Weight'][i],
    type: (['ab_test', 'ab_test', 'ab_test', 'ab_test', 'multivariate', 'ab_test'] as const)[i],
    status: (['Running', 'Completed', 'Completed', 'Completed', 'Draft', 'Draft'] as const)[i],
    hypothesis: ['New ranking algorithm improves NDCG by 5%', 'V2 autocomplete reduces typo rate by 20%', 'Personalized results increase CTR by 10%', 'Semantic search improves recall for long queries', 'Category boost improves local business visibility', 'Higher freshness weight improves news relevance'][i],
    primaryMetric: ['NDCG@10', 'typo_rate', 'CTR', 'recall@50', 'local_ctr', 'freshness_score'][i],
    trafficSplitPercent: [50, 50, 30, 50, 20, 10][i],
    statisticalSignificance: i < 4 ? +(90 + i * 2.5).toFixed(1) : null,
    isWinner: i === 1 ? true : i < 4 ? false : null,
    controlGroup: 'baseline',
    treatmentGroup: `variant_${i}`,
    createdBy: 'ml-team@erbu.tn',
    startedAt: pastTs(30 - i * 5),
    endedAt: i < 4 ? pastTs(i * 5) : undefined,
    conclusion: i === 1 ? 'New autocomplete significantly reduces typo rate. Deploying.' : undefined,
  })),
  runningCount: 1,
  completedCount: 3,
  draftCount: 2,
  overallSignificanceRate: 66.7,
};

const MOCK_EXPERIMENTS_LIST = MOCK_EXPERIMENTS_DASHBOARD.experiments;

const MOCK_EXPERIMENT_DETAIL = {
  experiment: MOCK_EXPERIMENTS_DASHBOARD.experiments[0],
  metrics: [
    { metricName: 'NDCG@10', controlValue: 0.82, treatmentValue: 0.87, absoluteDelta: 0.05, relativeDeltaPercent: 6.1, pValue: 0.03, confidenceLevel: 97.0, isSignificant: true, sampleSizeControl: 15000, sampleSizeTreatment: 15000 },
    { metricName: 'CTR', controlValue: 0.15, treatmentValue: 0.17, absoluteDelta: 0.02, relativeDeltaPercent: 13.3, pValue: 0.08, confidenceLevel: 92.0, isSignificant: false, sampleSizeControl: 15000, sampleSizeTreatment: 15000 },
    { metricName: 'Latency P50', controlValue: 12, treatmentValue: 14, absoluteDelta: 2, relativeDeltaPercent: 16.7, pValue: 0.01, confidenceLevel: 99.0, isSignificant: true, sampleSizeControl: 15000, sampleSizeTreatment: 15000 },
  ],
  timeline: [],
  dailyData: Array.from({ length: 14 }, (_, i) => ({
    date: pastTs(14 - i),
    controlMetricValue: +(0.82 + Math.sin(i * 0.3) * 0.02).toFixed(3),
    treatmentMetricValue: +(0.84 + Math.sin(i * 0.3) * 0.02).toFixed(3),
    cumulativeSignificance: +(85 + i * 1.2).toFixed(1),
    sampleSize: 3000 + i * 500,
  })),
};

// ════════════════════════════════════════════════════════════════
// 34. RANKING
// ════════════════════════════════════════════════════════════════

const MOCK_RANKING_PROFILES = [
  { id: uuid(3400), name: 'Default Ranking', description: 'Standard ranking profile for all queries', isDefault: true, isActive: true, weights: { relevance: 0.4, popularity: 0.2, freshness: 0.15, proximity: 0.15, quality: 0.1 } as Record<string, number>, boostFields: ['title', 'name', 'category'], penaltyFields: ['spam_score'], decayFunction: 'exponential', decayScale: 7, createdAt: pastTs(90), updatedAt: pastTs(5), createdBy: 'admin@erbu.tn' },
  { id: uuid(3401), name: 'Local Business', description: 'Optimized for local business search', isDefault: false, isActive: true, weights: { relevance: 0.3, popularity: 0.15, freshness: 0.1, proximity: 0.35, quality: 0.1 } as Record<string, number>, boostFields: ['proximity', 'reviews'], penaltyFields: ['spam_score', 'stale_flag'], decayFunction: 'gaussian', decayScale: 5, createdAt: pastTs(60), updatedAt: pastTs(10), createdBy: 'geo-team@erbu.tn' },
  { id: uuid(3402), name: 'News & Events', description: 'Prioritizes freshness for news content', isDefault: false, isActive: false, weights: { relevance: 0.3, popularity: 0.1, freshness: 0.4, proximity: 0.1, quality: 0.1 } as Record<string, number>, boostFields: ['publish_date', 'trending'], penaltyFields: ['outdated_flag'], decayFunction: 'linear', decayScale: 3, createdAt: pastTs(30), updatedAt: pastTs(3), createdBy: 'content-team@erbu.tn' },
];

const MOCK_RANKING_CONFIG = {
  availableDecayFunctions: ['exponential', 'gaussian', 'linear', 'none'],
  weightableFields: [
    { field: 'relevance', weight: 0.4, description: 'Text relevance score', min: 0, max: 1, step: 0.05 },
    { field: 'popularity', weight: 0.2, description: 'Popularity based on clicks/views', min: 0, max: 1, step: 0.05 },
    { field: 'freshness', weight: 0.15, description: 'Content freshness decay', min: 0, max: 1, step: 0.05 },
    { field: 'proximity', weight: 0.15, description: 'Geographic proximity', min: 0, max: 1, step: 0.05 },
    { field: 'quality', weight: 0.1, description: 'Content quality signal', min: 0, max: 1, step: 0.05 },
  ],
  boostableFields: ['title', 'name', 'category', 'proximity', 'reviews', 'publish_date', 'trending'],
  penaltyFields: ['spam_score', 'stale_flag', 'outdated_flag', 'low_quality'],
};

const MOCK_RANKING_PREVIEW = {
  profileId: uuid(3400),
  profileName: 'Default Ranking',
  query: 'restaurant tunis',
  hits: Array.from({ length: 5 }, (_, i) => ({
    id: uuid(2520 + i),
    title: ['Restaurant El Walima', 'Cafe Sidi Bou Said', 'Boulangerie Masmoudi', 'Restaurant Dar El Jeld', 'Le Grand Cafe'][i],
    score: +(0.95 - i * 0.08).toFixed(3),
    boostApplied: +(0.12 - i * 0.02).toFixed(3),
    penaltyApplied: +(0.01 + i * 0.005).toFixed(3),
    decayMultiplier: +(0.98 - i * 0.03).toFixed(3),
    finalScore: +(0.92 - i * 0.09).toFixed(3),
    fields: { category: 'restaurant', city: 'Tunis', rating: 4.5 - i * 0.3 },
  })),
  tookMs: 15,
  totalHits: 156,
};

// ════════════════════════════════════════════════════════════════
// 35. CONFIG (GEO-SEARCH ADMIN)
// ════════════════════════════════════════════════════════════════

const MOCK_CONFIG_FLAGS = [
  { id: uuid(3500), key: 'FaultInjectionEnabled', name: 'Fault Injection', description: 'Enable chaos fault injection module', status: 'disabled' as const, rolloutPercentage: null, environment: 'production', lastModifiedAt: pastTs(30), lastModifiedBy: 'admin@erbu.tn', tags: ['chaos', 'ops'], dependencies: [] },
  { id: uuid(3501), key: 'SemanticSearchEnabled', name: 'Semantic Search', description: 'Enable semantic search capabilities', status: 'enabled' as const, rolloutPercentage: null, environment: 'production', lastModifiedAt: pastTs(10), lastModifiedBy: 'admin@erbu.tn', tags: ['search', 'nlp'], dependencies: ['embedding-model'] },
  { id: uuid(3502), key: 'AutocompleteV2', name: 'Autocomplete V2', description: 'Use new autocomplete engine', status: 'rollout' as const, rolloutPercentage: 75, environment: 'production', lastModifiedAt: pastTs(5), lastModifiedBy: 'admin@erbu.tn', tags: ['search', 'ux'], dependencies: ['suggestion-index'] },
  { id: uuid(3503), key: 'PersonalizationEnabled', name: 'Personalization', description: 'Enable personalized search results', status: 'disabled' as const, rolloutPercentage: null, environment: 'staging', lastModifiedAt: pastTs(15), lastModifiedBy: 'ml-team@erbu.tn', tags: ['search', 'ml'], dependencies: ['user-profiles'] },
  { id: uuid(3504), key: 'RealtimeIndexing', name: 'Realtime Indexing', description: 'Enable real-time document indexing', status: 'enabled' as const, rolloutPercentage: null, environment: 'production', lastModifiedAt: pastTs(2), lastModifiedBy: 'admin@erbu.tn', tags: ['ingestion'], dependencies: [] },
];

const MOCK_CONFIG_SLOS = [
  { id: uuid(3510), name: 'Search Latency P99', description: 'P99 search latency must stay below 100ms', targetPercent: 99.0, currentPercent: 99.55, metricType: 'latency', windowDays: 30, errorBudgetRemainingPercent: 55.0, isBreaching: false, lastEvaluatedAt: pastTs(0), alertChannels: ['#search-alerts', 'oncall-search'] },
  { id: uuid(3511), name: 'Search Availability', description: 'Search API uptime must exceed 99.9%', targetPercent: 99.9, currentPercent: 99.95, metricType: 'availability', windowDays: 30, errorBudgetRemainingPercent: 50.0, isBreaching: false, lastEvaluatedAt: pastTs(0), alertChannels: ['#platform-alerts'] },
  { id: uuid(3512), name: 'Indexing Error Rate', description: 'Indexing error rate below 0.1%', targetPercent: 99.9, currentPercent: 99.98, metricType: 'error_rate', windowDays: 7, errorBudgetRemainingPercent: 80.0, isBreaching: false, lastEvaluatedAt: pastTs(0), alertChannels: ['#ingestion-alerts'] },
];

const MOCK_CONFIG_CAPABILITIES = [
  { id: uuid(3520), key: 'geo-search', name: 'GeoSearch', description: 'Geographic proximity search', isEnabled: true, requiredRole: 'Viewer', dependencies: ['geo-index-0'], category: 'search', lastModifiedAt: pastTs(30), lastModifiedBy: 'admin@erbu.tn' },
  { id: uuid(3521), key: 'autocomplete', name: 'Autocomplete', description: 'Real-time query autocomplete', isEnabled: true, requiredRole: 'Viewer', dependencies: ['suggestion-index'], category: 'search', lastModifiedAt: pastTs(20), lastModifiedBy: 'admin@erbu.tn' },
  { id: uuid(3522), key: 'semantic-search', name: 'Semantic Search', description: 'NLP-based semantic search', isEnabled: true, requiredRole: 'Operator', dependencies: ['embedding-model'], category: 'search', lastModifiedAt: pastTs(10), lastModifiedBy: 'ml-team@erbu.tn' },
  { id: uuid(3523), key: 'faceted-search', name: 'Faceted Search', description: 'Faceted filtering and aggregation', isEnabled: true, requiredRole: 'Viewer', dependencies: ['geo-index-0'], category: 'search', lastModifiedAt: pastTs(45), lastModifiedBy: 'admin@erbu.tn' },
];

const MOCK_CONFIG_SCHEMAS = [
  { id: uuid(3530), name: 'POI Schema', version: 3, status: 'active' as const, fields: [
    { name: 'id', type: 'string', required: true, description: 'Unique identifier', defaultValue: null, validationRegex: '^[a-f0-9-]{36}$' },
    { name: 'name', type: 'string', required: true, description: 'POI name', defaultValue: null, validationRegex: null },
    { name: 'latitude', type: 'float', required: true, description: 'GPS latitude', defaultValue: null, validationRegex: null },
    { name: 'longitude', type: 'float', required: true, description: 'GPS longitude', defaultValue: null, validationRegex: null },
    { name: 'category', type: 'string', required: true, description: 'POI category', defaultValue: 'general', validationRegex: null },
  ], createdAt: pastTs(90), createdBy: 'admin@erbu.tn', activatedAt: pastTs(85), description: 'Point of Interest document schema', compatibleVersions: [2, 3] },
  { id: uuid(3531), name: 'Address Schema', version: 2, status: 'active' as const, fields: [
    { name: 'id', type: 'string', required: true, description: 'Unique identifier', defaultValue: null, validationRegex: null },
    { name: 'street', type: 'string', required: true, description: 'Street address', defaultValue: null, validationRegex: null },
    { name: 'city', type: 'string', required: true, description: 'City name', defaultValue: null, validationRegex: null },
    { name: 'postalCode', type: 'string', required: false, description: 'Postal code', defaultValue: null, validationRegex: '^\\d{4}$' },
  ], createdAt: pastTs(60), createdBy: 'admin@erbu.tn', activatedAt: pastTs(55), description: 'Address document schema', compatibleVersions: [1, 2] },
  { id: uuid(3532), name: 'Event Schema', version: 1, status: 'draft' as const, fields: [
    { name: 'id', type: 'string', required: true, description: 'Unique identifier', defaultValue: null, validationRegex: null },
    { name: 'title', type: 'string', required: true, description: 'Event title', defaultValue: null, validationRegex: null },
    { name: 'date', type: 'datetime', required: true, description: 'Event date', defaultValue: null, validationRegex: null },
  ], createdAt: pastTs(10), createdBy: 'content-team@erbu.tn', activatedAt: null, description: 'Event document schema', compatibleVersions: [] },
];

const MOCK_CONFIG_OVERRIDES = [
  { id: uuid(3540), configKey: 'search.max_results', originalValue: '100', overrideValue: '200', reason: 'Increased for admin panel', appliedAt: pastTs(10), appliedBy: 'admin@erbu.tn', expiresAt: null, isActive: true, environment: 'production' },
  { id: uuid(3541), configKey: 'ingestion.batch_size', originalValue: '500', overrideValue: '1000', reason: 'Performance tuning', appliedAt: pastTs(5), appliedBy: 'admin@erbu.tn', expiresAt: '2026-08-01T00:00:00Z', isActive: true, environment: 'production' },
  { id: uuid(3542), configKey: 'cache.ttl_seconds', originalValue: '3600', overrideValue: '1800', reason: 'Reduced for freshness', appliedAt: pastTs(3), appliedBy: 'admin@erbu.tn', expiresAt: null, isActive: true, environment: 'production' },
  { id: uuid(3543), configKey: 'search.timeout_ms', originalValue: '5000', overrideValue: '3000', reason: 'Temporary during load test', appliedAt: pastTs(15), appliedBy: 'ops@erbu.tn', expiresAt: pastTs(10), isActive: false, environment: 'staging' },
];

const MOCK_CONFIG_ADRS = [
  { id: uuid(3550), number: 1, title: 'Adopt Elasticsearch for Search', status: 'accepted' as const, context: 'Need scalable full-text and geospatial search engine to replace PostgreSQL FTS. Must support Arabic/French analyzers.', decision: 'Use Elasticsearch 8.x with custom ICU analyzers for Arabic and French text.', consequences: 'Requires dedicated cluster management and monitoring. Adds operational complexity but enables sub-50ms search latency.', createdAt: pastTs(180), createdBy: 'tech-lead@erbu.tn', supersededBy: null, tags: ['infrastructure', 'search'] },
  { id: uuid(3551), number: 2, title: 'Implement ML Ranking Pipeline', status: 'accepted' as const, context: 'Need machine-learning-based ranking to improve search relevance beyond BM25 scoring.', decision: 'Build custom ranking pipeline with feature store, training pipeline, and online inference.', consequences: 'Additional infrastructure for ML training and serving. Requires feature engineering expertise.', createdAt: pastTs(120), createdBy: 'ml-lead@erbu.tn', supersededBy: null, tags: ['ml', 'ranking'] },
  { id: uuid(3552), number: 3, title: 'Internal Feature Flag System', status: 'proposed' as const, context: 'Need gradual feature rollout with percentage-based traffic splitting and per-environment control.', decision: 'Implement internal feature flag system with database-backed storage and runtime override support.', consequences: 'Development overhead for flag management UI. Avoids third-party dependency and data residency concerns.', createdAt: pastTs(30), createdBy: 'tech-lead@erbu.tn', supersededBy: null, tags: ['platform', 'devops'] },
];

const MOCK_CONFIG_TREE = [
  { key: 'search', value: null, dataType: 'section', children: [
    { key: 'search.max_results', value: '200', dataType: 'number', children: [], isOverridden: true, isSecret: false, description: 'Maximum results per query', lastModifiedAt: pastTs(10) },
    { key: 'search.timeout_ms', value: '5000', dataType: 'number', children: [], isOverridden: false, isSecret: false, description: 'Search timeout in milliseconds', lastModifiedAt: pastTs(30) },
    { key: 'search.default_page_size', value: '20', dataType: 'number', children: [], isOverridden: false, isSecret: false, description: 'Default page size', lastModifiedAt: pastTs(60) },
  ], isOverridden: false, isSecret: false, description: 'Search engine configuration', lastModifiedAt: pastTs(10) },
  { key: 'ingestion', value: null, dataType: 'section', children: [
    { key: 'ingestion.batch_size', value: '1000', dataType: 'number', children: [], isOverridden: true, isSecret: false, description: 'Batch size for document ingestion', lastModifiedAt: pastTs(5) },
    { key: 'ingestion.flush_interval_ms', value: '5000', dataType: 'number', children: [], isOverridden: false, isSecret: false, description: 'Flush interval in ms', lastModifiedAt: pastTs(45) },
  ], isOverridden: false, isSecret: false, description: 'Ingestion pipeline configuration', lastModifiedAt: pastTs(5) },
  { key: 'cache', value: null, dataType: 'section', children: [
    { key: 'cache.ttl_seconds', value: '1800', dataType: 'number', children: [], isOverridden: true, isSecret: false, description: 'Cache TTL in seconds', lastModifiedAt: pastTs(3) },
    { key: 'cache.max_entries', value: '50000', dataType: 'number', children: [], isOverridden: false, isSecret: false, description: 'Max cache entries', lastModifiedAt: pastTs(60) },
  ], isOverridden: false, isSecret: false, description: 'Cache layer configuration', lastModifiedAt: pastTs(3) },
];

const MOCK_CONFIG_DASHBOARD = {
  flags: MOCK_CONFIG_FLAGS,
  slos: MOCK_CONFIG_SLOS,
  capabilities: MOCK_CONFIG_CAPABILITIES,
  schemas: MOCK_CONFIG_SCHEMAS,
  overrides: MOCK_CONFIG_OVERRIDES,
  adrs: MOCK_CONFIG_ADRS,
  configTree: MOCK_CONFIG_TREE,
  lastUpdatedAt: ts(14, 30),
};

// ════════════════════════════════════════════════════════════════
// 36. SMOKE (COCKPIT)
// ════════════════════════════════════════════════════════════════

const MOCK_SMOKE_RESULTS = Array.from({ length: 8 }, (_, i) => ({
  id: uuid(3600 + i),
  suiteName: `Health Check ${SERVICE_NAMES[i % SERVICE_NAMES.length]}`,
  status: i < 6 ? 'Passed' : i === 6 ? 'Failed' : 'Skipped',
  passed: i < 6 ? 5 : i === 6 ? 3 : 0,
  totalTests: 5,
  durationSeconds: +(0.05 + i * 0.03).toFixed(2),
  startedAt: ts(14, 20),
  environment: i < 4 ? 'production' : 'staging',
  triggeredBy: i % 2 === 0 ? 'Scheduled' : 'admin@erbu.tn',
}));

const MOCK_SMOKE_HISTORY = Array.from({ length: 10 }, (_, i) => ({
  runId: uuid(3650 + i),
  executedAt: pastTs(i),
  totalTests: 8,
  passed: 8 - (i % 3 === 0 ? 1 : 0),
  failed: i % 3 === 0 ? 1 : 0,
  skipped: 0,
  durationMs: 2000 + i * 100,
  triggeredBy: i % 2 === 0 ? 'Scheduled' : 'admin@erbu.tn',
}));

// ════════════════════════════════════════════════════════════════
// 37. TRIP HEALTH
// ════════════════════════════════════════════════════════════════

const MOCK_TRIP_HEALTH_DASHBOARD = {
  kpi: { activeTrips: 23, activeTripsChange: 3, failedTrips: 2, failedTripsChange: -1, avgDurationMinutes: 18.5, avgDurationChange: 0.3, slaCompliancePercent: 96.8, slaComplianceChange: 0.5 },
  trips: Array.from({ length: 10 }, (_, i) => ({
    tripId: uuid(400 + i),
    tripNumber: `TRP-2026${String(2000 + i)}`,
    riderName: RIDER_NAMES[i % 12],
    driverName: `${DRIVER_NAMES[i % 15].first} ${DRIVER_NAMES[i % 15].last}`,
    status: i < 5 ? 'InProgress' : i < 8 ? 'Completed' : 'Failed',
    pickupAddress: ['Av. Habib Bourguiba, Tunis', 'Lac 2, Tunis', 'La Marsa Centre', 'Ariana, Tunis', 'Bardo, Tunis', 'Carthage, Tunis', 'Menzah 6, Tunis', 'Soukra, Ariana', 'Ennasr, Ariana', 'Megrine, Ben Arous'][i],
    dropoffAddress: ['La Marsa Centre', 'Aéroport Tunis-Carthage', 'Sidi Bou Said', 'Centre Ville, Tunis', 'Lac 1, Tunis', 'El Menzah 9, Tunis', 'Bab Souika, Tunis', 'Hammam Lif', 'La Goulette', 'El Mourouj'][i],
    startedAt: ts(14 - i, 0),
    durationMinutes: 10 + i * 3,
    fareAmount: +(5.5 + i * 2.3).toFixed(2),
    currency: 'TND',
    healthScore: i < 5 ? 95 - i * 2 : i < 8 ? 80 - i : 45,
    zone: ZONE_NAMES[i % ZONE_NAMES.length],
  })),
  services: [
    { name: 'trip-service', status: 'Healthy', latencyMs: 25, uptime: 99.98, lastChecked: ts(14, 30) },
    { name: 'payment-service', status: 'Healthy', latencyMs: 45, uptime: 99.95, lastChecked: ts(14, 30) },
    { name: 'matching-service', status: 'Degraded', latencyMs: 120, uptime: 98.5, lastChecked: ts(14, 30) },
    { name: 'notification-service', status: 'Healthy', latencyMs: 15, uptime: 99.99, lastChecked: ts(14, 30) },
    { name: 'geocoding-service', status: 'Healthy', latencyMs: 35, uptime: 99.92, lastChecked: ts(14, 30) },
  ],
  volumeHistory: Array.from({ length: 24 }, (_, i) => {
    const total = 10 + Math.floor(Math.sin((i - 6) * 0.4) * 15 + 15);
    const failed = i % 7 === 0 ? 2 : i % 5 === 0 ? 1 : 0;
    return { timestamp: ts(i, 0), tripCount: total, failureRate: total > 0 ? +(failed / total).toFixed(3) : 0 };
  }),
  health: {
    totalTripsToday: 342,
    activeTripsNow: 23,
    averageWaitTimeSeconds: 180,
    averageTripDurationMinutes: 18.5,
    completionRate: 92.1,
    cancellationRate: 5.3,
    averageSurgeMultiplier: 1.15,
    tripsByStatus: { InProgress: 23, Completed: 305, Cancelled: 12, Failed: 2 },
    peakHour: 18,
    revenueToday: 3210.75,
    currency: 'TND',
    lastUpdatedAt: ts(14, 30),
  },
};

const MOCK_TRIP_VOLUME = MOCK_TRIP_HEALTH_DASHBOARD.volumeHistory;
const MOCK_SERVICE_STATUSES = MOCK_TRIP_HEALTH_DASHBOARD.services;

// ════════════════════════════════════════════════════════════════
// 38. AUDIT (COCKPIT)
// ════════════════════════════════════════════════════════════════

const MOCK_AUDIT_SCENARIOS = Array.from({ length: 8 }, (_, i) => ({
  id: uuid(3800 + i),
  name: [`Payment Flow Audit`, `Trip Lifecycle Audit`, `Driver Onboarding Audit`, `Rating System Audit`, `Surge Pricing Audit`, `Cancellation Policy Audit`, `Refund Process Audit`, `Account Security Audit`][i],
  description: `Audit scenario for ${['payment processing flow', 'complete trip lifecycle', 'driver registration and verification', 'rating and review system', 'surge pricing calculations', 'cancellation and penalty policies', 'refund and chargeback handling', 'account security and authentication'][i]}`,
  status: i < 5 ? 'Active' : 'Draft',
  lastRunAt: i < 5 ? pastTs(i * 3) : null,
  passRate: i < 5 ? +(90 + i * 2).toFixed(1) : null,
  checkCount: 10 + i * 2,
  createdAt: pastTs(60 + i * 10),
  createdBy: 'audit-team@erbu.tn',
}));

const MOCK_AUDIT_DISCREPANCIES = Array.from({ length: 5 }, (_, i) => ({
  id: uuid(3820 + i),
  scenarioId: uuid(3800 + i),
  scenarioName: MOCK_AUDIT_SCENARIOS[i].name,
  severity: i < 2 ? 'High' : 'Medium',
  description: [
    'Payment amount mismatch between trip service and payment service',
    'Trip duration calculation differs by >5% between services',
    'Driver compliance status inconsistency',
    'Rating calculation rounding error',
    'Surge multiplier not applied consistently',
  ][i],
  expectedValue: ['12.50 TND', '18 min', 'Compliant', '4.5', '1.3x'][i],
  actualValue: ['13.20 TND', '22 min', 'PendingReview', '4.4', '1.0x'][i],
  detectedAt: pastTs(i * 2),
  status: i < 2 ? 'Open' : 'Resolved',
  resolvedAt: i >= 2 ? pastTs(i) : null,
}));

const MOCK_AUDIT_BASELINES = Array.from({ length: 3 }, (_, i) => ({
  id: uuid(3840 + i),
  name: `Baseline ${['Production Q2', 'Staging Latest', 'Pre-release'][i]}`,
  environment: ['production', 'staging', 'pre-release'][i],
  capturedAt: pastTs(i * 15),
  serviceCount: 15,
  snapshotSizeBytes: 1048576 + i * 524288,
  checksumSha256: `sha256:${uuid(3860 + i).replace(/-/g, '')}`,
  capturedBy: 'audit-system',
}));

const MOCK_AUDIT_CAPTURE_CONFIG = {
  enabled: true,
  captureInterval: '1h',
  retentionDays: 90,
  services: SERVICE_NAMES,
  excludePatterns: ['*.health', '*.metrics'],
  compressionEnabled: true,
  encryptionEnabled: true,
};

const MOCK_AUDIT_MISSION_CONTROL = {
  status: 'Healthy',
  lastAuditRunAt: ts(14, 0),
  nextScheduledAt: ts(15, 0),
  activeScenarios: 5,
  totalDiscrepancies: 5,
  openDiscrepancies: 2,
  avgPassRate: 94.5,
  coveragePercent: 78.3,
};

// ════════════════════════════════════════════════════════════════
// 39. STORIES
// ════════════════════════════════════════════════════════════════

const STORY_STATUSES = ['Inbox', 'Backlog', 'Ready', 'InProgress', 'InProgress', 'Done', 'Done', 'Done', 'Ready', 'Backlog', 'InProgress', 'Done'];
const STORY_PRIORITIES = ['Critical', 'High', 'Medium', 'High', 'Medium', 'Low', 'High', 'Medium', 'High', 'Medium', 'Low', 'Critical'];

const MOCK_STORIES = {
  items: Array.from({ length: 12 }, (_, i) => ({
    id: uuid(3900 + i),
    title: [
      'Implement real-time driver tracking',
      'Add payment retry mechanism',
      'Redesign rider onboarding flow',
      'Implement surge pricing algorithm',
      'Add support for scheduled rides',
      'Improve search autocomplete',
      'Add multi-currency support',
      'Implement driver rating system v2',
      'Add trip cost estimation',
      'Implement push notification service',
      'Add admin dashboard analytics',
      'Implement fraud detection system',
    ][i],
    description: `Story for implementing ${['real-time driver tracking', 'payment retry', 'rider onboarding', 'surge pricing', 'scheduled rides', 'search autocomplete', 'multi-currency', 'driver rating v2', 'trip cost estimation', 'push notifications', 'admin analytics', 'fraud detection'][i]}`,
    status: STORY_STATUSES[i],
    priority: STORY_PRIORITIES[i],
    assignee: i < 8 ? ['hamed@erbu.tn', 'karim@erbu.tn', 'sami@erbu.tn', 'leila@erbu.tn'][i % 4] : null,
    epic: ['Platform', 'Payments', 'UX', 'Pricing', 'Features', 'Search', 'Payments', 'Quality', 'Features', 'Infrastructure', 'Admin', 'Security'][i],
    storyPoints: [8, 5, 13, 8, 13, 5, 8, 5, 3, 8, 13, 21][i],
    labels: [['backend', 'real-time'], ['backend', 'payments'], ['frontend', 'ux'], ['backend', 'algorithm'], ['fullstack'], ['frontend', 'search'], ['backend', 'payments'], ['backend', 'quality'], ['backend', 'estimation'], ['backend', 'infra'], ['frontend', 'admin'], ['backend', 'security']][i],
    createdAt: pastTs(60 - i * 5),
    updatedAt: pastTs(i),
    completedAt: STORY_STATUSES[i] === 'Done' ? pastTs(i) : null,
    acceptanceCriteria: [`Driver position updates every 3 seconds`, `Retry up to 3 times with exponential backoff`, `Onboarding < 3 minutes`, `Surge multiplier accurate within 5%`][i % 4],
    blockedBy: i === 4 ? [uuid(3903)] : [],
  })),
  total: 12,
  page: 1,
  pageSize: 20,
};

// ════════════════════════════════════════════════════════════════
// 40. PLANNER
// ════════════════════════════════════════════════════════════════

const MOCK_PLANNER_TRIPS = [
  { id: uuid(4000), origin: 'Avenue Habib Bourguiba, Tunis', destination: 'La Marsa Centre', expectedDurationMinutes: 25, expectedDistanceKm: 18.5, expectedFare: 15.5, surgeMultiplier: 1.2, vehicleType: 'Sedan', isRoundTrip: false },
  { id: uuid(4001), origin: 'Lac 2, Tunis', destination: 'Aéroport Tunis-Carthage', expectedDurationMinutes: 15, expectedDistanceKm: 6.2, expectedFare: 8.0, surgeMultiplier: 1.0, vehicleType: 'Comfort', isRoundTrip: false },
  { id: uuid(4002), origin: 'Ariana Centre', destination: 'Bardo, Tunis', expectedDurationMinutes: 20, expectedDistanceKm: 10.8, expectedFare: 12.0, surgeMultiplier: 1.5, vehicleType: 'SUV', isRoundTrip: true },
];

const MOCK_LOCATION_SUGGESTIONS = [
  { placeId: 'place_001', description: 'Avenue Habib Bourguiba, Tunis', mainText: 'Avenue Habib Bourguiba', secondaryText: 'Tunis, Tunisie', lat: 36.7992, lng: 10.1658 },
  { placeId: 'place_002', description: 'La Marsa Centre, La Marsa', mainText: 'La Marsa Centre', secondaryText: 'La Marsa, Tunisie', lat: 36.8783, lng: 10.3247 },
  { placeId: 'place_003', description: 'Aéroport Tunis-Carthage', mainText: 'Aéroport Tunis-Carthage', secondaryText: 'Tunis, Tunisie', lat: 36.8510, lng: 10.2272 },
  { placeId: 'place_004', description: 'Lac 2, Les Berges du Lac', mainText: 'Lac 2', secondaryText: 'Les Berges du Lac, Tunisie', lat: 36.8325, lng: 10.2330 },
  { placeId: 'place_005', description: 'Sidi Bou Said', mainText: 'Sidi Bou Said', secondaryText: 'Sidi Bou Said, Tunisie', lat: 36.8687, lng: 10.3497 },
];

// ════════════════════════════════════════════════════════════════
// 41. CHAOS (COCKPIT)
// ════════════════════════════════════════════════════════════════

const MOCK_CHAOS_EXPERIMENTS = {
  items: Array.from({ length: 4 }, (_, i) => ({
    id: uuid(4100 + i),
    name: [`Network Partition Test`, `CPU Stress Test`, `Memory Leak Simulation`, `Disk I/O Saturation`][i],
    description: [`Test service resilience during network partition`, `Verify behavior under CPU stress`, `Simulate memory leak to test OOM handling`, `Test disk I/O saturation impact`][i],
    targetService: SERVICE_NAMES[i],
    faultType: ['NetworkPartition', 'CpuStress', 'MemoryLeak', 'DiskIO'][i],
    severity: i < 2 ? 'High' : 'Medium',
    status: i === 0 ? 'Running' : i < 3 ? 'Completed' : 'Scheduled',
    scheduledAt: i === 3 ? '2026-07-28T10:00:00Z' : pastTs(i * 3),
    startedAt: i < 3 ? pastTs(i * 3) : null,
    endedAt: i > 0 && i < 3 ? pastTs(i * 3) : null,
    durationSeconds: i > 0 && i < 3 ? 300 + i * 100 : null,
    rollbackOnFailure: true,
    hypothesis: [`Services should failover within 30s`, `Response time should stay below 2s`, `Service should restart cleanly`, `Throughput should degrade gracefully`][i],
    actualResult: i > 0 && i < 3 ? [`Failover completed in 25s`, `Response time peaked at 1.8s`, `Service restarted in 45s`][i - 1] : null,
    createdBy: 'sre-team@erbu.tn',
    approvedBy: 'tech-lead@erbu.tn',
  })),
  total: 4,
  page: 1,
  pageSize: 20,
};

const MOCK_CHAOS_METRICS = {
  experimentId: uuid(4100),
  errorRatePercent: 2.5,
  latencyP50Ms: 85,
  latencyP95Ms: 220,
  latencyP99Ms: 450,
  availabilityPercent: 97.5,
  recoveryTimeSeconds: 45,
  blastRadius: '3 services affected',
  affectedEndpoints: ['/api/trips/create', '/api/matching/assign', '/api/payments/charge'],
  steadyStateViolations: ['Latency P95 exceeded 200ms threshold', 'Error rate exceeded 2% for 45 seconds'],
};

// ════════════════════════════════════════════════════════════════
// 42. E2E
// ════════════════════════════════════════════════════════════════

const MOCK_E2E_SUITES = {
  items: [
    { id: uuid(4200), name: 'Rider Flow Suite', description: 'End-to-end tests for rider journey', testCount: 25, passRate: 96.0, lastRunAt: pastTs(0), avgDurationSeconds: 180, tags: ['rider', 'critical'] },
    { id: uuid(4201), name: 'Driver Flow Suite', description: 'End-to-end tests for driver journey', testCount: 20, passRate: 90.0, lastRunAt: pastTs(0), avgDurationSeconds: 150, tags: ['driver', 'critical'] },
    { id: uuid(4202), name: 'Payment Flow Suite', description: 'End-to-end tests for payment processing', testCount: 15, passRate: 100.0, lastRunAt: pastTs(0), avgDurationSeconds: 120, tags: ['payment', 'critical'] },
  ],
  total: 3,
};

const MOCK_E2E_RUNS = Array.from({ length: 5 }, (_, i) => ({
  id: uuid(4210 + i),
  suiteId: uuid(4200 + (i % 3)),
  suiteName: ['Rider Flow Suite', 'Driver Flow Suite', 'Payment Flow Suite'][i % 3],
  platform: i % 2 === 0 ? 'Android' : 'iOS',
  deviceName: ['Pixel 7 Pro', 'iPhone 15 Pro', 'Samsung S23', 'iPhone 15', 'Pixel 8'][i],
  status: i < 4 ? 'Completed' : 'Running',
  totalTests: [25, 20, 15][i % 3],
  passed: i < 4 ? [24, 18, 15][i % 3] : 10,
  failed: i < 4 ? [1, 2, 0][i % 3] : 0,
  skipped: 0,
  startedAt: pastTs(i),
  completedAt: i < 4 ? pastTs(i) : null,
  durationSeconds: i < 4 ? 150 + i * 20 : null,
  triggeredBy: i % 2 === 0 ? 'CI Pipeline' : 'admin@erbu.tn',
  environment: i < 3 ? 'staging' : 'production',
  videoUrl: i < 4 ? `/api/ops/e2e/runs/${uuid(4210 + i)}/video` : null,
  logUrl: `/api/ops/e2e/runs/${uuid(4210 + i)}/logs`,
}));

const MOCK_E2E_COVERAGE = {
  totalEndpoints: 150,
  coveredEndpoints: 120,
  coveragePercent: 80.0,
  byService: SERVICE_NAMES.slice(0, 8).map((name, i) => ({
    serviceName: name,
    totalEndpoints: 15 + i * 2,
    coveredEndpoints: 12 + i,
    coveragePercent: +(75 + i * 3).toFixed(1),
  })),
  uncoveredEndpoints: [
    { service: 'analytics-service', endpoint: 'POST /api/analytics/export', priority: 'Low' },
    { service: 'admin-gateway', endpoint: 'DELETE /api/admin/cache', priority: 'Medium' },
  ],
};

const MOCK_E2E_REGRESSIONS = Array.from({ length: 3 }, (_, i) => ({
  id: uuid(4230 + i),
  testName: [`Rider booking flow`, `Driver acceptance`, `Payment refund`][i],
  suiteName: ['Rider Flow Suite', 'Driver Flow Suite', 'Payment Flow Suite'][i],
  firstFailedAt: pastTs(i * 2),
  failureCount: 2 + i,
  errorMessage: [`Timeout waiting for driver assignment`, `Accept button not found`, `Refund amount mismatch`][i],
  status: i === 0 ? 'Open' : 'Investigating',
  assignedTo: i < 2 ? 'qa-team@erbu.tn' : null,
}));

// ════════════════════════════════════════════════════════════════
// 43. COVERAGE
// ════════════════════════════════════════════════════════════════

const MOCK_COVERAGE_OVERVIEW_DATA = {
  overallCoverage: 78.5,
  lineCoveragePercent: 82.3,
  coveredLines: 37035,
  totalLines: 45000,
  branchCoveragePercent: 71.2,
  coveredBranches: 6052,
  totalBranches: 8500,
  functionCoveragePercent: 85.1,
  coveredFunctions: 3404,
  totalFunctions: 4000,
  lastUpdatedAt: ts(14, 0),
};

const MOCK_COVERAGE_OVERVIEW = {
  ...MOCK_COVERAGE_OVERVIEW_DATA,
  byService: SERVICE_NAMES.slice(0, 10).map((name, i) => ({
    serviceName: name,
    lineCoveragePercent: +(70 + i * 3).toFixed(1),
    branchCoveragePercent: +(60 + i * 3).toFixed(1),
    functionCoveragePercent: +(75 + i * 2.5).toFixed(1),
    trend: i < 7 ? 'up' : 'down',
  })),
};

const MOCK_COVERAGE_MATRIX = SERVICE_NAMES.slice(0, 10).map((name, i) => ({
  serviceName: name,
  unit: +(75 + i * 2.5).toFixed(1),
  integration: +(60 + i * 3).toFixed(1),
  e2e: +(40 + i * 4).toFixed(1),
  smoke: +(85 + i * 1.5).toFixed(1),
  overall: +(70 + i * 2).toFixed(1),
}));

const MOCK_COVERAGE_TREND = Array.from({ length: 30 }, (_, i) => ({
  date: pastTs(29 - i),
  lineCoveragePercent: +(75 + i * 0.25).toFixed(1),
  branchCoveragePercent: +(65 + i * 0.2).toFixed(1),
  functionCoveragePercent: +(78 + i * 0.23).toFixed(1),
}));

const MOCK_COVERAGE_FILES = [
  { path: 'src/', name: 'src', isDirectory: true, lineCoveragePercent: 82.3, branchCoveragePercent: 71.2, functionCoveragePercent: 85.1, uncoveredLineRanges: [], children: [
    { path: 'src/services/', name: 'services', isDirectory: true, lineCoveragePercent: 85.1, branchCoveragePercent: 74.5, functionCoveragePercent: 88.0, uncoveredLineRanges: [], children: [] },
    { path: 'src/controllers/', name: 'controllers', isDirectory: true, lineCoveragePercent: 78.5, branchCoveragePercent: 65.3, functionCoveragePercent: 82.0, uncoveredLineRanges: [], children: [] },
    { path: 'src/models/', name: 'models', isDirectory: true, lineCoveragePercent: 90.2, branchCoveragePercent: 80.1, functionCoveragePercent: 92.5, uncoveredLineRanges: [], children: [] },
  ]},
];

const MOCK_COVERAGE_THRESHOLDS = [
  { id: uuid(4300), metric: 'lineCoverage', threshold: 80, scope: 'global', status: 'Met', currentValue: 82.3, action: 'block-merge' },
  { id: uuid(4301), metric: 'branchCoverage', threshold: 70, scope: 'global', status: 'Met', currentValue: 71.2, action: 'warn' },
  { id: uuid(4302), metric: 'functionCoverage', threshold: 80, scope: 'global', status: 'Met', currentValue: 85.1, action: 'block-merge' },
];

const MOCK_COVERAGE_REPORTS = Array.from({ length: 5 }, (_, i) => ({
  id: uuid(4310 + i),
  name: `Coverage Report ${pastTs(i * 7).split('T')[0]}`,
  generatedAt: pastTs(i * 7),
  lineCoveragePercent: +(78 + i * 0.9).toFixed(1),
  branchCoveragePercent: +(68 + i * 0.6).toFixed(1),
  functionCoveragePercent: +(80 + i * 1).toFixed(1),
  testCount: 450 + i * 15,
  status: 'Completed',
}));

const MOCK_COVERAGE_DASHBOARD = {
  overview: MOCK_COVERAGE_OVERVIEW,
  matrix: MOCK_COVERAGE_MATRIX,
  trend: MOCK_COVERAGE_TREND,
  fileTree: MOCK_COVERAGE_FILES,
  thresholds: MOCK_COVERAGE_THRESHOLDS,
  reports: MOCK_COVERAGE_REPORTS,
};

// ════════════════════════════════════════════════════════════════
// 44. INSTANCES
// ════════════════════════════════════════════════════════════════

const MOCK_INSTANCES = {
  items: Array.from({ length: 6 }, (_, i) => ({
    id: uuid(4400 + i),
    name: [`pixel-7-prod`, `samsung-s23-test`, `iphone-15-qa`, `emulator-android-ci`, `emulator-ios-ci`, `pixel-8-dev`][i],
    platform: i % 2 === 0 ? 'Android' : 'iOS',
    osVersion: i % 2 === 0 ? 'Android 14' : 'iOS 17.5',
    status: i < 4 ? 'Online' : i === 4 ? 'Busy' : 'Offline',
    isPhysical: i < 3 || i === 5,
    resolution: ['1080x2400', '1440x3088', '1179x2556', '1080x1920', '1170x2532', '1080x2400'][i],
    tags: [['production', 'e2e'], ['testing', 'qa'], ['qa', 'regression'], ['ci', 'emulator'], ['ci', 'emulator'], ['dev', 'manual']][i],
    lastUsedAt: pastTs(i % 3),
    appVersion: '2.5.0',
    ipAddress: `192.168.1.${100 + i}`,
    batteryLevel: 80 - i * 10,
  })),
  total: 6,
  page: 1,
  pageSize: 20,
};

const MOCK_DEVICE_GROUPS = [
  { id: uuid(4420), name: 'Production Devices', deviceIds: [uuid(4400), uuid(4401), uuid(4402)], description: 'Physical devices for production testing', createdAt: pastTs(60) },
  { id: uuid(4421), name: 'CI Emulators', deviceIds: [uuid(4403), uuid(4404)], description: 'Emulators for CI pipeline', createdAt: pastTs(60) },
];

// ════════════════════════════════════════════════════════════════
// 45. MOBILE
// ════════════════════════════════════════════════════════════════

const MOCK_MOBILE_DEVICES = [
  { id: uuid(4500), name: 'Pixel 7 Pro', platform: 'Android', osVersion: 'Android 14', appVersion: '2.5.0', status: 'Connected', serialNumber: 'PIXEL7PRO001', manufacturer: 'Google', model: 'Pixel 7 Pro', batteryLevel: 85, connectedVia: 'USB', appInstalled: true, lastConnectedAt: ts(14, 0) },
  { id: uuid(4501), name: 'Samsung Galaxy S23', platform: 'Android', osVersion: 'Android 14', appVersion: '2.5.0', status: 'Connected', serialNumber: 'SAMSUNG23001', manufacturer: 'Samsung', model: 'Galaxy S23', batteryLevel: 72, connectedVia: 'WiFi', appInstalled: true, lastConnectedAt: ts(14, 0) },
  { id: uuid(4502), name: 'iPhone 15 Pro', platform: 'iOS', osVersion: 'iOS 17.5', appVersion: '2.5.0', status: 'Connected', serialNumber: 'IPHONE15P001', manufacturer: 'Apple', model: 'iPhone 15 Pro', batteryLevel: 91, connectedVia: 'USB', appInstalled: true, lastConnectedAt: ts(14, 0) },
  { id: uuid(4503), name: 'Pixel 8', platform: 'Android', osVersion: 'Android 14', appVersion: '2.4.9', status: 'Disconnected', serialNumber: 'PIXEL8001', manufacturer: 'Google', model: 'Pixel 8', batteryLevel: 45, connectedVia: 'USB', appInstalled: true, lastConnectedAt: pastTs(1) },
];

const MOCK_MOBILE_KPI = {
  connectedDevices: 3,
  androidCount: 2,
  iosCount: 1,
  devicesAvailable: 2,
  devicesInUse: 1,
  devicesOffline: 1,
  lastMaestroPassRate: 93.8,
  activeRecordings: 0,
};

const MOCK_MAESTRO_FLOWS = [
  { id: uuid(4510), name: 'Login Flow', filePath: 'flows/login.yaml', platform: 'Android', estimatedDurationSeconds: 30, lastRunStatus: 'Passed', lastRunAt: ts(14, 0), tags: ['auth', 'critical'] },
  { id: uuid(4511), name: 'Book Ride Flow', filePath: 'flows/book-ride.yaml', platform: 'Android', estimatedDurationSeconds: 90, lastRunStatus: 'Passed', lastRunAt: ts(13, 30), tags: ['ride', 'critical'] },
  { id: uuid(4512), name: 'Payment Flow', filePath: 'flows/payment.yaml', platform: 'iOS', estimatedDurationSeconds: 60, lastRunStatus: 'Failed', lastRunAt: ts(13, 0), tags: ['payment', 'critical'] },
  { id: uuid(4513), name: 'Profile Update Flow', filePath: 'flows/profile.yaml', platform: 'Android', estimatedDurationSeconds: 35, lastRunStatus: 'Passed', lastRunAt: ts(12, 0), tags: ['profile'] },
];

const MOCK_MAESTRO_HISTORY = Array.from({ length: 8 }, (_, i) => ({
  id: uuid(4520 + i),
  flowId: uuid(4510 + (i % 4)),
  flowName: MOCK_MAESTRO_FLOWS[i % 4].name,
  status: i !== 5 ? 'Passed' : 'Failed',
  startedAt: pastTs(i / 4),
  completedAt: pastTs(i / 4),
  durationSeconds: 30 + (i % 4) * 20,
  deviceName: MOCK_MOBILE_DEVICES[i % 4].name,
  errorMessage: i === 5 ? 'Button "Pay Now" not found after 10s timeout' : null,
  screenshotUrl: null,
}));

const MOCK_ADB_DEVICES = ['PIXEL7PRO001', 'SAMSUNG23001', 'PIXEL8001'];

// ════════════════════════════════════════════════════════════════
// 46. REPORTS
// ════════════════════════════════════════════════════════════════

const MOCK_REPORTS = {
  items: Array.from({ length: 5 }, (_, i) => ({
    id: uuid(4600 + i),
    name: [`Daily Operations Report`, `Weekly Revenue Report`, `Monthly Driver Performance`, `Quarterly Business Review`, `Annual Compliance Report`][i],
    type: ['TripSummary', 'Revenue', 'DriverPerformance', 'RiderActivity', 'SLA'][i],
    format: i % 2 === 0 ? 'PDF' : 'CSV',
    status: ['Ready', 'Ready', 'Ready', 'Generating', 'Ready'][i],
    createdAt: pastTs(i * 7),
    completedAt: i !== 3 ? pastTs(i * 7) : null,
    fileSize: `${(0.5 + i * 0.25).toFixed(1)} MB`,
    generatedBy: 'report-scheduler',
    downloadUrl: `/api/ops/reports/${uuid(4600 + i)}/download`,
  })),
  total: 5,
  page: 1,
  pageSize: 20,
};

const MOCK_SCHEDULED_REPORTS = [
  { id: uuid(4620), name: 'Daily Operations', type: 'TripSummary', format: 'PDF', frequency: 'Daily', enabled: true, nextRunAt: '2026-07-27T06:00:00Z' },
  { id: uuid(4621), name: 'Weekly Revenue', type: 'Revenue', format: 'CSV', frequency: 'Weekly', enabled: true, nextRunAt: '2026-07-28T08:00:00Z' },
  { id: uuid(4622), name: 'Monthly Performance', type: 'DriverPerformance', format: 'PDF', frequency: 'Monthly', enabled: true, nextRunAt: '2026-08-01T09:00:00Z' },
];

// ════════════════════════════════════════════════════════════════
// 47. REPLAY DIFF
// ════════════════════════════════════════════════════════════════

const MOCK_REPLAY_TRIPS = {
  items: Array.from({ length: 5 }, (_, i) => ({
    id: uuid(400 + i),
    tripNumber: `TRP-2026${String(1000 + i)}`,
    pickupAddress: ['Av. Habib Bourguiba, Tunis', 'Lac 2, Tunis', 'La Marsa Centre', 'Ariana Centre', 'Bardo, Tunis'][i],
    dropoffAddress: ['La Marsa Centre', 'Aéroport Tunis-Carthage', 'Sidi Bou Said', 'Centre Ville, Tunis', 'Lac 1, Tunis'][i],
    status: 'completed',
    completedAt: pastTs(i),
    fareAmount: +(10 + i * 5).toFixed(2),
    currency: 'TND',
  })),
  total: 5,
};

const MOCK_DIFF_REPORT = {
  tripId: uuid(400),
  metrics: {
    timeDeviationSeconds: 45,
    timeDeviationPercent: 4.2,
    routeDeviationKm: 0.35,
    routeDeviationPercent: 2.8,
    costDifference: 0.30,
    costDifferencePercent: 2.4,
    verdict: 'Minor',
    waypointMismatches: 2,
  },
  baselineWaypoints: Array.from({ length: 10 }, (_, i) => ({ lat: +(36.80 + i * 0.002).toFixed(6), lng: +(10.17 + i * 0.003).toFixed(6), speedKmh: 30 + i * 5, timestamp: ts(10, i * 2) })),
  comparisonWaypoints: Array.from({ length: 10 }, (_, i) => ({ lat: +(36.80 + i * 0.002 + 0.0001).toFixed(6), lng: +(10.17 + i * 0.003 + 0.0001).toFixed(6), speedKmh: 28 + i * 5, timestamp: ts(10, i * 2 + 1) })),
  segments: Array.from({ length: 10 }, (_, i) => ({
    index: i,
    severity: i < 6 ? 'match' : i < 8 ? 'minor' : 'significant',
    deviationMeters: i < 6 ? +(i * 2.5).toFixed(1) : i < 8 ? +(20 + i * 5).toFixed(1) : +(50 + i * 10).toFixed(1),
    baselineLat: +(36.80 + i * 0.002).toFixed(6),
    baselineLng: +(10.17 + i * 0.003).toFixed(6),
    comparisonLat: +(36.80 + i * 0.002 + 0.0001).toFixed(6),
    comparisonLng: +(10.17 + i * 0.003 + 0.0001).toFixed(6),
  })),
  analyzedAt: ts(14, 0),
};

// ════════════════════════════════════════════════════════════════
// 48. SCENARIO BUILDER
// ════════════════════════════════════════════════════════════════

const MOCK_SCENARIOS = [
  { id: uuid(4800), name: 'Peak Hour Simulation', description: 'Simulate peak hour conditions', version: 3, updatedAt: pastTs(5), createdAt: pastTs(30) },
  { id: uuid(4801), name: 'New Driver Onboarding', description: 'Full driver onboarding scenario', version: 2, updatedAt: pastTs(3), createdAt: pastTs(20) },
  { id: uuid(4802), name: 'Payment Failure Recovery', description: 'Test payment failure and retry', version: 1, updatedAt: pastTs(10), createdAt: pastTs(10) },
];

const MOCK_SCENARIO_DETAIL = {
  ...MOCK_SCENARIOS[0],
  nodes: Array.from({ length: 8 }, (_, i) => ({
    id: uuid(4810 + i),
    label: ['Create Rider', 'Create Driver', 'Set Online', 'Request Trip', 'Assign Driver', 'Start Trip', 'Complete Trip', 'Process Payment'][i],
    type: i === 3 ? 'Condition' : i === 7 ? 'Assert' : 'Action',
    x: 100 + (i % 4) * 200,
    y: 100 + Math.floor(i / 4) * 200,
    isEntryPoint: i === 0,
    isTerminal: i === 7,
    status: 'idle',
    hasError: false,
    config: { timeout: 30 },
  })),
  edges: Array.from({ length: 7 }, (_, i) => ({
    id: uuid(4820 + i),
    sourceNodeId: uuid(4810 + i),
    targetNodeId: uuid(4810 + i + 1),
    label: i === 3 ? 'driver found' : '',
    condition: i === 3 ? 'status === "matched"' : '',
    order: i,
  })),
};

// ════════════════════════════════════════════════════════════════
// 49. PIPELINES
// ════════════════════════════════════════════════════════════════

const PIPELINE_NAMES_CI = ['monitoring-pipeline', 'dev-pipeline', 'test-pipeline', 'perf-pipeline', 'deploy-prod', 'deploy-staging', 'security-scan', 'quality-gate'];
const PIPELINE_BRANCHES = ['main', 'develop', 'develop', 'main', 'main', 'develop', 'main', 'develop'];
const PIPELINE_CI_STATUSES = ['Success', 'Success', 'Running', 'Success', 'Success', 'Failed', 'Success', 'Success'];

const MOCK_PIPELINE_RUNS = {
  items: Array.from({ length: 8 }, (_, i) => ({
    id: uuid(4900 + i),
    pipelineName: PIPELINE_NAMES_CI[i],
    branch: PIPELINE_BRANCHES[i],
    commitSha: `${String(i + 1).repeat(7)}abcdef`.slice(0, 7),
    commitMessage: [`Update monitoring config`, `Add driver endpoint`, `Fix rider tests`, `Performance improvements`, `Release v2.5.0`, `Fix staging config`, `Security patch update`, `Code quality improvements`][i],
    status: PIPELINE_CI_STATUSES[i],
    stages: [
      { name: 'Build', status: 'Success', durationSeconds: 45 + i * 5 },
      { name: 'Test', status: PIPELINE_CI_STATUSES[i] === 'Failed' && i === 5 ? 'Failed' : 'Success', durationSeconds: 120 + i * 10 },
      { name: 'Deploy', status: PIPELINE_CI_STATUSES[i], durationSeconds: PIPELINE_CI_STATUSES[i] === 'Running' ? null : 60 + i * 5 },
    ],
    triggeredBy: i % 2 === 0 ? 'push' : 'manual',
    startedAt: pastTs(i),
    completedAt: PIPELINE_CI_STATUSES[i] !== 'Running' ? pastTs(i) : null,
    durationSeconds: PIPELINE_CI_STATUSES[i] !== 'Running' ? 225 + i * 20 : null,
    artifactUrls: PIPELINE_CI_STATUSES[i] === 'Success' ? [`s3://artifacts/${PIPELINE_NAMES_CI[i]}/build-${i}`] : [],
    environment: i < 4 ? 'development' : i < 6 ? 'staging' : 'production',
  })),
  totalCount: 8,
};

const MOCK_ORCHESTRATOR_STATE = {
  status: 'Running',
  activePipelines: 1,
  queuedPipelines: 0,
  totalRuns24h: 24,
  successRate24h: 91.7,
  avgDurationSeconds: 225,
  workers: 4,
  busyWorkers: 1,
  lastUpdatedAt: ts(14, 30),
};

const MOCK_PIPELINE_SESSION = {
  sessionId: uuid(4950),
  startedAt: ts(0, 0),
  pipelines: PIPELINE_NAMES_CI,
  environment: 'all',
  concurrency: 4,
  timeout: 3600,
  notifyOnComplete: true,
  notifyChannels: ['slack'],
};

const MOCK_PIPELINE_FRAMEWORK_CONFIG = {
  name: 'monitoring-pipeline',
  stages: ['Build', 'Test', 'Deploy'],
  triggers: ['push', 'schedule'],
  schedule: '0 */4 * * *',
  timeout: 1800,
  retries: 2,
  environment: { NODE_ENV: 'production' },
  artifacts: { enabled: true, retention: '30d' },
  notifications: { slack: '#ci-notifications', email: 'devops@erbu.tn' },
};

const MOCK_PIPELINE_HISTORY = Array.from({ length: 20 }, (_, i) => ({
  pipelineId: uuid(4900 + (i % 8)),
  pipelineName: PIPELINE_NAMES_CI[i % 8],
  status: i % 7 === 0 ? 'Failed' : 'Success',
  durationSeconds: 200 + Math.floor(Math.random() * 100),
  startedAt: pastTs(i),
  branch: PIPELINE_BRANCHES[i % 8],
}));

const MOCK_PIPELINE_LOGS = Array.from({ length: 15 }, (_, i) => ({
  timestamp: ts(10, i * 2),
  level: i === 12 ? 'ERROR' : i % 5 === 0 ? 'WARN' : 'INFO',
  message: [
    'Starting build stage...',
    'Compiling TypeScript sources',
    'Build completed successfully',
    'Running unit tests...',
    'Test suite: 245 passed, 0 failed',
    'WARNING: Deprecated API usage detected',
    'Running integration tests...',
    'Integration tests completed',
    'Starting deployment...',
    'Uploading artifacts to S3',
    'Deploying to staging environment',
    'Health check passed',
    'ERROR: Connection timeout during health check',
    'Retrying health check...',
    'Deployment completed successfully',
  ][i],
  stage: i < 3 ? 'Build' : i < 8 ? 'Test' : 'Deploy',
}));

// ════════════════════════════════════════════════════════════════
// 50. GEO-SEARCH ADMIN SEARCH
// ════════════════════════════════════════════════════════════════

const MOCK_GEO_ADMIN_SEARCH = {
  results: Array.from({ length: 10 }, (_, i) => ({
    id: uuid(5000 + i),
    score: +(0.98 - i * 0.05).toFixed(3),
    source: {
      name: [`Avenue Habib Bourguiba`, `Mosquée Zitouna`, `Marché Central`, `Bab Bhar`, `Place de la Kasbah`, `Cathédrale Saint-Vincent-de-Paul`, `Parc du Belvédère`, `Musée du Bardo`, `Souk El Attarine`, `Porte de France`][i],
      type: ['street', 'mosque', 'market', 'landmark', 'square', 'church', 'park', 'museum', 'souk', 'landmark'][i],
      lat: +(36.795 + i * 0.003).toFixed(6),
      lng: +(10.165 + i * 0.005).toFixed(6),
      city: 'Tunis',
      country: 'Tunisie',
    },
  })),
  totalCount: 245,
  tookMs: 8,
  suggestions: ['habib bourguiba', 'marché central tunis', 'musée bardo'],
};

// ════════════════════════════════════════════════════════════════
// MOCK ROUTES TABLE
// ════════════════════════════════════════════════════════════════

const SUCCESS = { success: true, message: 'Operation completed' };

const MOCK_ROUTES: MockRoute[] = [
  // ── 1. Driver Management (specific paths first) ──
  { method: 'GET', pattern: '/api/admin/drivers/cities', response: DRIVER_CITIES },
  { method: 'GET', pattern: '/api/admin/drivers/{id}/compliance', response: MOCK_DRIVER_COMPLIANCE },
  { method: 'GET', pattern: '/api/admin/drivers/{id}/payouts', response: MOCK_DRIVER_PAYOUTS },
  { method: 'GET', pattern: '/api/admin/drivers/{id}/marketplace', response: MOCK_DRIVER_MARKETPLACE },
  { method: 'GET', pattern: '/api/admin/drivers/{id}/trips', response: MOCK_DRIVER_TRIPS },
  { method: 'GET', pattern: '/api/admin/drivers/{id}/payment-events', response: MOCK_DRIVER_PAYMENT_EVENTS },
  { method: 'GET', pattern: '/api/admin/drivers/{id}/invoices', response: MOCK_DRIVER_INVOICES },
  { method: 'GET', pattern: '/api/admin/drivers/{id}/tariffs', response: MOCK_DRIVER_TARIFFS },
  { method: 'GET', pattern: '/api/admin/drivers/{id}/creation', response: MOCK_DRIVER_CREATION },
  { method: 'GET', pattern: '/api/admin/drivers/{id}/wallet', response: MOCK_DRIVER_WALLET },
  { method: 'GET', pattern: '/api/admin/drivers/{id}/kyc', response: MOCK_DRIVER_KYC },
  { method: 'GET', pattern: '/api/admin/drivers/{id}/vehicle', response: MOCK_DRIVER_VEHICLE },
  { method: 'POST', pattern: '/api/admin/drivers/{id}/activate', response: { success: true, message: 'Driver activated' } },
  { method: 'POST', pattern: '/api/admin/drivers/{id}/suspend', response: { success: true, message: 'Driver suspended' } },
  { method: 'POST', pattern: '/api/admin/drivers/{id}/verify', response: { success: true, message: 'Driver verified' } },
  { method: 'POST', pattern: '/api/admin/drivers/bulk/activate', response: { succeeded: [uuid(100)], failed: [] } },
  { method: 'POST', pattern: '/api/admin/drivers/bulk/suspend', response: { succeeded: [uuid(100)], failed: [] } },
  { method: 'GET', pattern: '/api/admin/drivers/{id}', response: MOCK_DRIVER_DETAIL },
  { method: 'GET', pattern: '/api/admin/drivers', response: MOCK_DRIVERS_LIST },

  // ── 2. Rider Management ──
  { method: 'GET', pattern: '/api/admin/marketplace/riders', response: MOCK_MARKETPLACE_RIDERS },
  { method: 'PATCH', pattern: '/api/admin/riders/{id}/status', response: SUCCESS },
  { method: 'POST', pattern: '/api/admin/riders/{id}/suspend', response: SUCCESS },
  { method: 'POST', pattern: '/api/admin/riders/{id}/reactivate', response: SUCCESS },
  { method: 'GET', pattern: '/api/admin/riders/{id}', response: MOCK_RIDER_DETAIL },
  { method: 'GET', pattern: '/api/admin/riders', response: MOCK_RIDERS_LIST },

  // ── 3. Payment Monitor ──
  { method: 'GET', pattern: '/api/ops/payment-monitor/dashboard', response: MOCK_PAYMENT_DASHBOARD },
  { method: 'GET', pattern: '/api/ops/payment-monitor/events/{id}', response: MOCK_PAYMENT_EVENTS[0] },
  { method: 'GET', pattern: '/api/ops/payment-monitor/events', response: MOCK_PAYMENT_EVENTS_LIST },
  { method: 'GET', pattern: '/api/ops/payment-monitor/audit', response: MOCK_PAYMENT_AUDIT },
  { method: 'GET', pattern: '/api/ops/payment-monitor/virements', response: MOCK_VIREMENTS },
  { method: 'GET', pattern: '/api/ops/payment-monitor/volume', response: PAYMENT_VOLUME_HISTORY },

  // ── 4. Marketplace ──
  { method: 'GET', pattern: '/api/admin/marketplace/network/drivers', response: MOCK_DRIVER_NETWORK },
  { method: 'GET', pattern: '/api/admin/marketplace/reservations', response: MOCK_RESERVATIONS },
  { method: 'GET', pattern: '/api/admin/marketplace/liquidity/zones', response: MOCK_LIQUIDITY_ZONES },
  { method: 'GET', pattern: '/api/admin/marketplace/auctions', response: MOCK_AUCTIONS },
  { method: 'GET', pattern: '/api/admin/marketplace/audit/alerts', response: MOCK_AUDIT_ALERTS },
  { method: 'GET', pattern: '/api/admin/marketplace/alarms/rules', response: MOCK_ALARM_RULES },
  { method: 'GET', pattern: '/api/admin/marketplace/drivers/search', response: [MOCK_MARKETPLACE_DRIVER_PROFILE] },
  { method: 'GET', pattern: '/api/admin/marketplace/drivers/{id}/profile', response: MOCK_MARKETPLACE_DRIVER_PROFILE },

  // ── 5. Driver Monitor ──
  { method: 'GET', pattern: '/api/ops/driver-monitor/dashboard', response: MOCK_DRIVER_MONITOR_DASHBOARD },
  { method: 'GET', pattern: '/api/ops/driver-monitor/drivers', response: MOCK_DRIVER_MONITOR_LIST },

  // ── 6. Reputation ──
  { method: 'GET', pattern: '/api/ops/reputation/summary', response: MOCK_REPUTATION_SUMMARY },
  { method: 'GET', pattern: '/api/ops/reputation/scores/{id}/history', response: MOCK_SCORE_HISTORY },
  { method: 'POST', pattern: '/api/ops/reputation/scores/{id}/adjust', response: SUCCESS },
  { method: 'GET', pattern: '/api/ops/reputation/scores', response: MOCK_REPUTATION_SCORES },
  { method: 'PATCH', pattern: '/api/ops/reputation/fraud-alerts/{id}', response: SUCCESS },
  { method: 'GET', pattern: '/api/ops/reputation/fraud-alerts', response: MOCK_FRAUD_ALERTS },

  // ── 7. Auth Management ──
  { method: 'POST', pattern: '/api/auth/admin/users/{id}/lock', response: { success: true, message: 'User locked' } },
  { method: 'POST', pattern: '/api/auth/admin/users/{id}/unlock', response: { success: true, message: 'User unlocked' } },
  { method: 'POST', pattern: '/api/auth/admin/users/{id}/suspend', response: { success: true, message: 'User suspended' } },
  { method: 'POST', pattern: '/api/auth/admin/users/{id}/reactivate', response: { success: true, message: 'User reactivated' } },
  { method: 'POST', pattern: '/api/auth/admin/users/{id}/reset-password', response: { success: true, message: 'Password reset' } },
  { method: 'GET', pattern: '/api/auth/admin/users', response: MOCK_AUTH_USERS },
  { method: 'GET', pattern: '/api/auth/admin/tokens', response: MOCK_AUTH_TOKENS },
  { method: 'POST', pattern: '/api/auth/admin/tokens/{id}/revoke', response: SUCCESS },
  { method: 'GET', pattern: '/api/auth/admin/bans', response: MOCK_AUTH_BANS },
  { method: 'DELETE', pattern: '/api/auth/admin/bans/{id}', response: SUCCESS },
  { method: 'GET', pattern: '/api/auth/admin/diagnostics', response: MOCK_AUTH_DIAGNOSTICS },

  // ── 8. Support Tickets ──
  { method: 'GET', pattern: '/api/admin/support/tickets/{id}', response: MOCK_TICKET_DETAIL },
  { method: 'GET', pattern: '/api/admin/support/tickets', response: MOCK_TICKETS },
  { method: 'POST', pattern: '/api/admin/support/tickets', response: MOCK_TICKETS.items[0] },
  { method: 'PATCH', pattern: '/api/admin/support/tickets/{id}', response: SUCCESS },

  // ── 9. Alerts ──
  { method: 'GET', pattern: '/api/admin/alerts/rules', response: MOCK_ALERT_RULES },
  { method: 'GET', pattern: '/api/admin/alerts/preferences', response: MOCK_NOTIFICATION_PREFERENCES },
  { method: 'GET', pattern: '/api/admin/alerts', response: MOCK_ALERTS },
  { method: 'POST', pattern: '/api/admin/alerts/rules', response: MOCK_ALERT_RULES[0] },
  { method: 'PATCH', pattern: '/api/admin/alerts/{id}', response: SUCCESS },
  { method: 'DELETE', pattern: '/api/admin/alerts/rules/{id}', response: SUCCESS },

  // ── 10. Orchestrator ──
  { method: 'GET', pattern: '/api/admin/orchestrator/dashboard', response: MOCK_ORCHESTRATOR_DASHBOARD },
  { method: 'GET', pattern: '/api/admin/orchestrator/jobs/{id}', response: MOCK_ORCHESTRATOR_JOBS.items[0] },
  { method: 'GET', pattern: '/api/admin/orchestrator/jobs', response: MOCK_ORCHESTRATOR_JOBS },
  { method: 'GET', pattern: '/api/admin/orchestrator/services', response: MOCK_ORCHESTRATED_SERVICES },
  { method: 'GET', pattern: '/api/admin/orchestrator/deployments', response: MOCK_DEPLOYMENTS },
  { method: 'POST', pattern: '/api/admin/orchestrator/jobs/{id}/cancel', response: SUCCESS },
  { method: 'POST', pattern: '/api/admin/orchestrator/jobs/{id}/retry', response: SUCCESS },
  { method: 'POST', pattern: '/api/admin/orchestrator/deployments/{id}/rollback', response: SUCCESS },

  // ── 11. Services Dashboard ──
  { method: 'GET', pattern: '/api/admin/services/dashboard', response: MOCK_SERVICES_DASHBOARD },
  { method: 'GET', pattern: '/api/admin/services/list', response: MOCK_MICROSERVICES },
  { method: 'GET', pattern: '/api/admin/services/prometheus', response: MOCK_PROMETHEUS },
  { method: 'GET', pattern: '/api/admin/services/action-logs', response: MOCK_SERVICE_ACTION_LOGS },
  { method: 'POST', pattern: '/api/admin/services/control', response: { success: true, serviceName: SERVICE_NAMES[0], action: 'restart', message: 'Service restart initiated' } },

  // ── 12. Infrastructure Admin ──
  { method: 'GET', pattern: '/api/admin/infrastructure/dashboard', response: MOCK_INFRA_DASHBOARD },
  { method: 'GET', pattern: '/api/admin/infrastructure/nodes', response: MOCK_SERVER_NODES },
  { method: 'GET', pattern: '/api/admin/infrastructure/topology', response: MOCK_NETWORK_TOPOLOGY },
  { method: 'GET', pattern: '/api/admin/infrastructure/deployments', response: MOCK_INFRA_DEPLOYMENTS },
  { method: 'GET', pattern: '/api/admin/infrastructure/alerts', response: MOCK_RESOURCE_ALERTS },
  { method: 'POST', pattern: '/api/admin/infrastructure/ssh/execute', response: { stdout: 'uptime: 30 days, 2 users, load average: 0.42, 0.38, 0.35', stderr: '', exitCode: 0, executedAt: ts(14, 30) } },

  // ── 13. Pricing ──
  { method: 'GET', pattern: '/api/admin/pricing/rules', response: MOCK_PRICING_RULES },
  { method: 'GET', pattern: '/api/admin/pricing/surge', response: MOCK_SURGE_CONFIGS },
  { method: 'GET', pattern: '/api/admin/pricing/zones', response: MOCK_PRICING_ZONES },
  { method: 'GET', pattern: '/api/admin/pricing/ab-tests', response: MOCK_AB_TESTS },
  { method: 'POST', pattern: '/api/admin/pricing/simulate', response: MOCK_PRICING_SIMULATION },
  { method: 'POST', pattern: '/api/admin/pricing/rules', response: MOCK_PRICING_RULES[0] },
  { method: 'PUT', pattern: '/api/admin/pricing/rules/{id}', response: MOCK_PRICING_RULES[0] },
  { method: 'DELETE', pattern: '/api/admin/pricing/rules/{id}', response: SUCCESS },

  // ── 14. Trips ──
  { method: 'GET', pattern: '/api/admin/trips/stats', response: MOCK_TRIP_STATS },
  { method: 'GET', pattern: '/api/admin/trips/{id}/replay', response: MOCK_TRIP_REPLAY },
  { method: 'GET', pattern: '/api/admin/trips/{id}', response: MOCK_TRIP_DETAIL },
  { method: 'GET', pattern: '/api/admin/trips', response: MOCK_TRIPS },
  { method: 'POST', pattern: '/api/admin/trips/{id}/cancel', response: { success: true, message: 'Trip cancelled' } },
  { method: 'POST', pattern: '/api/admin/trips/{id}/refund', response: { success: true, message: 'Refund issued' } },

  // ── 15. Database ──
  { method: 'GET', pattern: '/api/devtools/pg/stats', response: MOCK_PG_STATS },
  { method: 'GET', pattern: '/api/devtools/pg/tables', response: MOCK_PG_TABLES },
  { method: 'GET', pattern: '/api/devtools/pg/pool', response: MOCK_PG_POOL },
  { method: 'GET', pattern: '/api/devtools/pg/backup/status', response: MOCK_PG_BACKUP },
  { method: 'GET', pattern: '/api/devtools/pg/purge/schedules', response: MOCK_PG_PURGE },

  // ── 16. Redis ──
  { method: 'GET', pattern: '/api/devtools/redis/stats', response: MOCK_REDIS_STATS },
  { method: 'GET', pattern: '/api/devtools/redis/key', response: MOCK_REDIS_KEY },
  { method: 'GET', pattern: '/api/devtools/redis/keys', response: MOCK_REDIS_KEYS },
  { method: 'GET', pattern: '/redis/keys', response: MOCK_REDIS_KEYS },

  // ── 17. MinIO ──
  { method: 'GET', pattern: '/api/devtools/minio/stats', response: MOCK_MINIO_STATS },
  { method: 'GET', pattern: '/api/devtools/minio/buckets', response: MOCK_MINIO_BUCKETS },
  { method: 'GET', pattern: '/api/devtools/minio/objects', response: MOCK_MINIO_OBJECTS },

  // ── 18. Observability ──
  { method: 'GET', pattern: '/api/devtools/observability/overview', response: MOCK_OBSERVABILITY_OVERVIEW },
  { method: 'GET', pattern: '/api/devtools/observability/logs/policies', response: MOCK_LOG_POLICIES },
  { method: 'GET', pattern: '/api/devtools/observability/metrics/stats', response: MOCK_METRICS_STATS },
  { method: 'GET', pattern: '/api/devtools/observability/traces/quotas', response: MOCK_TRACE_QUOTAS },
  { method: 'GET', pattern: '/api/devtools/observability/cleanup/schedules', response: MOCK_CLEANUP_SCHEDULES },

  // ── 19. Traces ──
  { method: 'GET', pattern: '/api/ops/traces/by-correlation/{id}', response: MOCK_TRACE_DETAIL },
  { method: 'GET', pattern: '/api/ops/traces/search', response: MOCK_TRACES_SEARCH },
  { method: 'GET', pattern: '/api/ops/traces/{id}', response: MOCK_TRACE_DETAIL },

  // ── 20. Env Backup ──
  { method: 'GET', pattern: '/api/devtools/env-backup/compare', response: MOCK_BACKUP_COMPARISON },
  { method: 'GET', pattern: '/api/devtools/env-backup/{id}', response: MOCK_ENV_BACKUP_DETAIL },
  { method: 'POST', pattern: '/api/devtools/env-backup/{id}/restore', response: { success: true, message: 'Restore initiated' } },
  { method: 'GET', pattern: '/api/devtools/env-backup', response: MOCK_ENV_BACKUPS },
  { method: 'POST', pattern: '/api/devtools/env-backup', response: MOCK_ENV_BACKUPS.items[0] },

  // ── 21. GeoStudio Home ──
  { method: 'GET', pattern: '/api/admin/geo-search/home/dashboard', response: {
    kpi: { totalDocuments: 2_450_000, queryRatePerSecond: 142.5, avgLatencyMs: 23, indexHealth: 'green', activePipelines: 4, errorRatePct: 0.12, uptimePct: 99.97, nodesOnline: 5 },
    recentActivity: [
      { id: uuid(9001), type: 'ingestion', message: 'Pipeline "tunis-addresses" completed — 12,500 docs indexed', timestamp: ts(14, 30), severity: 'info', module: 'Ingestion' },
      { id: uuid(9002), type: 'query', message: 'Slow query detected: avg 450ms on "sfax-poi" index', timestamp: ts(14, 15), severity: 'warning', module: 'Monitor' },
      { id: uuid(9003), type: 'config', message: 'Feature flag "fuzzy-matching-v2" enabled in production', timestamp: ts(13, 45), severity: 'info', module: 'Config' },
      { id: uuid(9004), type: 'alert', message: 'Node geo-node-3 disk usage at 87%', timestamp: ts(13, 20), severity: 'warning', module: 'Infrastructure' },
      { id: uuid(9005), type: 'deploy', message: 'Schema v3.2.1 deployed to all clusters', timestamp: ts(12, 0), severity: 'info', module: 'Config' },
    ],
    systemStatus: [
      { name: 'Search Engine', status: 'healthy', lastChecked: ts(15, 0), message: '5 nodes, all green' },
      { name: 'Ingestion Pipeline', status: 'healthy', lastChecked: ts(15, 0), message: '4 active pipelines' },
      { name: 'Knowledge Graph', status: 'healthy', lastChecked: ts(15, 0), message: '1.2M entities, 3.4M edges' },
      { name: 'Feature Store', status: 'healthy', lastChecked: ts(15, 0), message: '42 features, all fresh' },
      { name: 'Learning Service', status: 'degraded', lastChecked: ts(15, 0), message: 'Model training queue backed up' },
    ],
    lastUpdatedAt: ts(15, 0),
  }},

  // ── 21b. GeoStudio Monitor ──
  { method: 'GET', pattern: '/api/admin/geo-search/monitor/dashboard', response: MOCK_GEO_MONITOR_DASHBOARD },
  { method: 'GET', pattern: '/api/admin/geo-search/monitor/alert-configs', response: MOCK_GEO_ALERT_CONFIGS },
  { method: 'GET', pattern: '/api/admin/geo-search/monitor/slow-queries', response: MOCK_GEO_MONITOR_DASHBOARD.slowQueries },
  { method: 'POST', pattern: '/api/admin/geo-search/monitor/alerts/{id}/acknowledge', response: SUCCESS },

  // ── 22. GeoStudio Ingestion ──
  { method: 'GET', pattern: '/api/admin/geo-search/ingestion/dashboard', response: MOCK_GEO_INGESTION_DASHBOARD },
  { method: 'GET', pattern: '/api/admin/geo-search/ingestion/errors', response: MOCK_PIPELINE_ERRORS },
  { method: 'GET', pattern: '/api/admin/geo-search/ingestion/pipelines/{id}/config', response: MOCK_PIPELINE_CONFIG },
  { method: 'POST', pattern: '/api/admin/geo-search/ingestion/pipelines/{id}/start', response: SUCCESS },
  { method: 'POST', pattern: '/api/admin/geo-search/ingestion/pipelines/{id}/stop', response: SUCCESS },
  { method: 'POST', pattern: '/api/admin/geo-search/ingestion/pipelines/{id}/restart', response: SUCCESS },

  // ── 23. GeoStudio Infrastructure ──
  { method: 'GET', pattern: '/api/admin/geo-search/infrastructure/dashboard', response: MOCK_GEO_INFRA_DASHBOARD },
  { method: 'GET', pattern: '/api/admin/geo-search/infrastructure/nodes', response: MOCK_GEO_INFRA_NODES },

  // ── 24. Chaos (GEO) ──
  { method: 'GET', pattern: '/api/geo/chaos/dashboard', response: MOCK_GEO_CHAOS_DASHBOARD },
  { method: 'POST', pattern: '/api/geo/chaos/faults/{id}/activate', response: SUCCESS },
  { method: 'POST', pattern: '/api/geo/chaos/faults/{id}/deactivate', response: SUCCESS },
  { method: 'POST', pattern: '/api/geo/chaos/scenarios/{id}/run', response: SUCCESS },
  { method: 'POST', pattern: '/api/geo/chaos/kill-switch', response: SUCCESS },

  // ── 25. Search Explorer ──
  { method: 'GET', pattern: '/api/geo/search-explorer/indices', response: MOCK_SEARCH_INDICES },
  { method: 'GET', pattern: '/api/geo/search-explorer/saved-queries', response: MOCK_SAVED_QUERIES },
  { method: 'POST', pattern: '/api/geo/search-explorer/search', response: MOCK_SEARCH_RESPONSE },

  // ── 26. Collections ──
  { method: 'GET', pattern: '/api/admin/geo/collections/summary', response: MOCK_COLLECTION_SUMMARY },
  { method: 'GET', pattern: '/api/admin/geo/collections/{id}', response: MOCK_COLLECTION_DETAIL },
  { method: 'GET', pattern: '/api/admin/geo/collections', response: MOCK_COLLECTIONS },

  // ── 27. History ──
  { method: 'GET', pattern: '/api/geo/history/dashboard', response: MOCK_HISTORY_DASHBOARD },
  { method: 'GET', pattern: '/api/geo/history/search', response: MOCK_HISTORY_SEARCH },
  { method: 'GET', pattern: '/api/geo/history/volume', response: MOCK_QUERY_VOLUME },

  // ── 28. Knowledge Graph ──
  { method: 'GET', pattern: '/api/admin/geo/knowledge-graph/stats', response: MOCK_GRAPH_STATS },
  { method: 'GET', pattern: '/api/admin/geo/knowledge-graph/graph', response: MOCK_GRAPH_DATA },
  { method: 'GET', pattern: '/api/admin/geo/knowledge-graph/search', response: MOCK_ENTITY_SEARCH },
  { method: 'GET', pattern: '/api/admin/geo/knowledge-graph/nodes/{id}/neighborhood', response: MOCK_ENTITY_NEIGHBORHOOD },
  { method: 'GET', pattern: '/api/admin/geo/knowledge-graph/nodes/{id}', response: MOCK_GRAPH_NODE },

  // ── 29. Feature Store ──
  { method: 'GET', pattern: '/api/admin/geo/feature-store/summary', response: MOCK_FEATURE_STORE_SUMMARY },
  { method: 'GET', pattern: '/api/admin/geo/feature-store/features', response: MOCK_FEATURES },
  { method: 'GET', pattern: '/api/admin/geo/feature-store/features/{id}/stats', response: MOCK_FEATURE_STATS },
  { method: 'GET', pattern: '/api/admin/geo/feature-store/features/{id}', response: MOCK_FEATURES.items[0] },

  // ── 30. Digital Twin ──
  { method: 'GET', pattern: '/api/geo/digital-twin/dashboard', response: MOCK_TWIN_DASHBOARD },
  { method: 'GET', pattern: '/api/geo/digital-twin/configs/{id}', response: MOCK_TWIN_DASHBOARD.configs[0] },
  { method: 'GET', pattern: '/api/geo/digital-twin/configs/{id}/traffic', response: MOCK_TWIN_DASHBOARD.trafficComparisons },
  { method: 'GET', pattern: '/api/geo/digital-twin/configs/{id}/divergence', response: MOCK_TWIN_DASHBOARD.divergenceMetrics },
  { method: 'GET', pattern: '/api/geo/digital-twin/configs/{id}/shadow-queries', response: MOCK_TWIN_SHADOW_QUERIES },

  // ── 31. Quality ──
  { method: 'GET', pattern: '/api/geo/quality/dashboard', response: MOCK_QUALITY_DASHBOARD },
  { method: 'GET', pattern: '/api/geo/quality/reports', response: MOCK_QUALITY_REPORTS },
  { method: 'GET', pattern: '/api/geo/quality/tests', response: MOCK_QUALITY_TESTS },
  { method: 'POST', pattern: '/api/geo/quality/alerts/{id}/acknowledge', response: SUCCESS },
  { method: 'POST', pattern: '/api/geo/quality/run', response: SUCCESS },

  // ── 32. Learning ──
  { method: 'GET', pattern: '/api/geo/learning/dashboard', response: MOCK_LEARNING_DASHBOARD },
  { method: 'GET', pattern: '/api/geo/learning/models/{id}', response: MOCK_LEARNING_MODELS[0] },
  { method: 'GET', pattern: '/api/geo/learning/models', response: MOCK_LEARNING_MODELS },
  { method: 'POST', pattern: '/api/geo/learning/models/{id}/train', response: SUCCESS },
  { method: 'POST', pattern: '/api/geo/learning/models/{id}/promote', response: SUCCESS },
  { method: 'POST', pattern: '/api/geo/learning/models/{id}/rollback', response: SUCCESS },

  // ── 33. Experiments ──
  { method: 'GET', pattern: '/api/geo/experiments/dashboard', response: MOCK_EXPERIMENTS_DASHBOARD },
  { method: 'GET', pattern: '/api/geo/experiments/{id}/detail', response: MOCK_EXPERIMENT_DETAIL },
  { method: 'GET', pattern: '/api/geo/experiments/list', response: MOCK_EXPERIMENTS_LIST },
  { method: 'POST', pattern: '/api/geo/experiments/{id}/start', response: SUCCESS },
  { method: 'POST', pattern: '/api/geo/experiments/{id}/stop', response: SUCCESS },
  { method: 'POST', pattern: '/api/geo/experiments', response: MOCK_EXPERIMENTS_LIST[0] },

  // ── 34. Ranking ──
  { method: 'GET', pattern: '/api/geo/ranking/profiles', response: MOCK_RANKING_PROFILES },
  { method: 'GET', pattern: '/api/geo/ranking/config', response: MOCK_RANKING_CONFIG },
  { method: 'POST', pattern: '/api/geo/ranking/preview', response: MOCK_RANKING_PREVIEW },
  { method: 'GET', pattern: '/api/geo/ranking/compare', response: { profileAId: uuid(3400), profileAName: 'Default Ranking', profileBId: uuid(3401), profileBName: 'Local Business', query: 'restaurant tunis', hitsA: MOCK_RANKING_PREVIEW.hits, hitsB: MOCK_RANKING_PREVIEW.hits.map((h, i) => ({ ...h, id: uuid(2530 + i), finalScore: +(+h.finalScore - 0.05).toFixed(3) })), overlapPercent: 80.0, positionChanges: [{ documentId: uuid(2520), title: 'Restaurant El Walima', positionA: 1, positionB: 3, delta: 2 }, { documentId: uuid(2522), title: 'Boulangerie Masmoudi', positionA: 3, positionB: 1, delta: -2 }], tookMs: 28 } },

  // ── 35. Config (GEO-SEARCH ADMIN) ──
  { method: 'GET', pattern: '/api/geo-search/admin/config/dashboard', response: MOCK_CONFIG_DASHBOARD },
  { method: 'GET', pattern: '/api/geo-search/admin/config/flags', response: MOCK_CONFIG_FLAGS },
  { method: 'GET', pattern: '/api/geo-search/admin/config/slos', response: MOCK_CONFIG_SLOS },
  { method: 'GET', pattern: '/api/geo-search/admin/config/capabilities', response: MOCK_CONFIG_CAPABILITIES },
  { method: 'GET', pattern: '/api/geo-search/admin/config/schemas', response: MOCK_CONFIG_SCHEMAS },
  { method: 'GET', pattern: '/api/geo-search/admin/config/overrides', response: MOCK_CONFIG_OVERRIDES },
  { method: 'GET', pattern: '/api/geo-search/admin/config/adrs', response: MOCK_CONFIG_ADRS },
  { method: 'GET', pattern: '/api/geo-search/admin/config/tree', response: MOCK_CONFIG_TREE },
  { method: 'PATCH', pattern: '/api/geo-search/admin/config/flags/{id}', response: SUCCESS },
  { method: 'PATCH', pattern: '/api/geo-search/admin/config/overrides/{id}', response: SUCCESS },
  { method: 'POST', pattern: '/api/geo-search/admin/config/overrides', response: MOCK_CONFIG_OVERRIDES[0] },
  { method: 'DELETE', pattern: '/api/geo-search/admin/config/overrides/{id}', response: SUCCESS },

  // ── 36. Smoke (Cockpit) ──
  { method: 'GET', pattern: '/api/v1/cockpit/smoke/results', response: MOCK_SMOKE_RESULTS },
  { method: 'GET', pattern: '/api/v1/cockpit/smoke/history', response: MOCK_SMOKE_HISTORY },
  { method: 'POST', pattern: '/api/v1/cockpit/smoke/run', response: { runId: uuid(1), message: 'Smoke tests initiated' } },

  // ── 37. Trip Health ──
  { method: 'GET', pattern: '/api/ops/trip-health/dashboard', response: MOCK_TRIP_HEALTH_DASHBOARD },
  { method: 'GET', pattern: '/api/ops/trip-health/volume', response: MOCK_TRIP_VOLUME },
  { method: 'GET', pattern: '/api/ops/trip-health/services', response: MOCK_SERVICE_STATUSES },

  // ── 38. Audit (Cockpit) ──
  { method: 'GET', pattern: '/api/cockpit/audit/scenarios', response: MOCK_AUDIT_SCENARIOS },
  { method: 'GET', pattern: '/api/cockpit/audit/discrepancies', response: MOCK_AUDIT_DISCREPANCIES },
  { method: 'GET', pattern: '/api/cockpit/audit/baselines', response: MOCK_AUDIT_BASELINES },
  { method: 'GET', pattern: '/api/cockpit/audit/capture-config', response: MOCK_AUDIT_CAPTURE_CONFIG },
  { method: 'GET', pattern: '/api/cockpit/audit/mission-control', response: MOCK_AUDIT_MISSION_CONTROL },
  { method: 'POST', pattern: '/api/cockpit/audit/scenarios/{id}/run', response: SUCCESS },
  { method: 'POST', pattern: '/api/cockpit/audit/baselines', response: MOCK_AUDIT_BASELINES[0] },

  // ── 39. Stories ──
  { method: 'GET', pattern: '/api/cockpit/stories', response: MOCK_STORIES },
  { method: 'PATCH', pattern: '/api/cockpit/stories/{id}', response: SUCCESS },
  { method: 'POST', pattern: '/api/cockpit/stories', response: MOCK_STORIES.items[0] },

  // ── 40. Planner ──
  { method: 'GET', pattern: '/api/cockpit/planner/trips', response: MOCK_PLANNER_TRIPS },
  { method: 'GET', pattern: '/api/cockpit/planner/locations/autocomplete', response: MOCK_LOCATION_SUGGESTIONS },
  { method: 'POST', pattern: '/api/cockpit/planner/trips', response: MOCK_PLANNER_TRIPS[0] },
  { method: 'POST', pattern: '/api/cockpit/planner/trips/{id}/cancel', response: SUCCESS },

  // ── 41. Chaos (Cockpit) ──
  { method: 'GET', pattern: '/api/chaos/experiments/{id}/metrics', response: MOCK_CHAOS_METRICS },
  { method: 'GET', pattern: '/api/chaos/experiments/{id}', response: MOCK_CHAOS_EXPERIMENTS.items[0] },
  { method: 'GET', pattern: '/api/chaos/experiments', response: MOCK_CHAOS_EXPERIMENTS },
  { method: 'POST', pattern: '/api/chaos/experiments/{id}/start', response: SUCCESS },
  { method: 'POST', pattern: '/api/chaos/experiments/{id}/stop', response: SUCCESS },
  { method: 'POST', pattern: '/api/chaos/experiments', response: MOCK_CHAOS_EXPERIMENTS.items[0] },

  // ── 42. E2E ──
  { method: 'GET', pattern: '/api/ops/e2e/suites', response: MOCK_E2E_SUITES },
  { method: 'GET', pattern: '/api/ops/e2e/runs', response: MOCK_E2E_RUNS },
  { method: 'GET', pattern: '/api/ops/e2e/coverage', response: MOCK_E2E_COVERAGE },
  { method: 'GET', pattern: '/api/ops/e2e/regressions', response: MOCK_E2E_REGRESSIONS },
  { method: 'POST', pattern: '/api/ops/e2e/launch', response: { runId: uuid(1), message: 'Tests launched' } },

  // ── 43. Coverage ──
  { method: 'GET', pattern: '/api/ops/coverage/dashboard', response: MOCK_COVERAGE_DASHBOARD },
  { method: 'GET', pattern: '/api/ops/coverage/overview', response: MOCK_COVERAGE_OVERVIEW },
  { method: 'GET', pattern: '/api/ops/coverage/matrix', response: MOCK_COVERAGE_MATRIX },
  { method: 'GET', pattern: '/api/ops/coverage/trend', response: MOCK_COVERAGE_TREND },
  { method: 'GET', pattern: '/api/ops/coverage/files', response: MOCK_COVERAGE_FILES },
  { method: 'GET', pattern: '/api/ops/coverage/thresholds', response: MOCK_COVERAGE_THRESHOLDS },
  { method: 'GET', pattern: '/api/ops/coverage/reports', response: MOCK_COVERAGE_REPORTS },

  // ── 44. Instances ──
  { method: 'GET', pattern: '/api/ops/instances/groups', response: MOCK_DEVICE_GROUPS },
  { method: 'GET', pattern: '/api/ops/instances', response: MOCK_INSTANCES },
  { method: 'POST', pattern: '/api/ops/instances/{id}/reboot', response: { success: true, deviceId: uuid(4400), action: 'reboot', message: 'Device rebooting' } },

  // ── 45. Mobile ──
  { method: 'GET', pattern: '/api/ops/mobile/devices', response: MOCK_MOBILE_DEVICES },
  { method: 'GET', pattern: '/api/ops/mobile/kpi', response: MOCK_MOBILE_KPI },
  { method: 'GET', pattern: '/api/ops/mobile/maestro/flows', response: MOCK_MAESTRO_FLOWS },
  { method: 'GET', pattern: '/api/ops/mobile/maestro/history', response: MOCK_MAESTRO_HISTORY },
  { method: 'GET', pattern: '/api/ops/mobile/adb/devices', response: MOCK_ADB_DEVICES },
  { method: 'POST', pattern: '/api/ops/mobile/maestro/flows/{id}/run', response: SUCCESS },

  // ── 46. Reports ──
  { method: 'GET', pattern: '/api/ops/reports/schedules', response: MOCK_SCHEDULED_REPORTS },
  { method: 'GET', pattern: '/api/ops/reports', response: MOCK_REPORTS },
  { method: 'POST', pattern: '/api/ops/reports', response: MOCK_REPORTS.items[0] },
  { method: 'DELETE', pattern: '/api/ops/reports/{id}', response: SUCCESS },

  // ── 47. Replay Diff ──
  { method: 'GET', pattern: '/api/ops/replay-diff/trips/search', response: MOCK_REPLAY_TRIPS },
  { method: 'GET', pattern: '/api/ops/replay-diff/diffs/{id}', response: MOCK_DIFF_REPORT },
  { method: 'POST', pattern: '/api/ops/replay-diff/compare', response: MOCK_DIFF_REPORT },

  // ── 48. Scenario Builder ──
  { method: 'GET', pattern: '/api/ops/scenarios/{id}', response: MOCK_SCENARIO_DETAIL },
  { method: 'GET', pattern: '/api/ops/scenarios', response: MOCK_SCENARIOS },
  { method: 'POST', pattern: '/api/ops/scenarios', response: MOCK_SCENARIOS[0] },
  { method: 'POST', pattern: '/api/ops/scenarios/{id}/run', response: SUCCESS },

  // ── 49. Pipelines ──
  { method: 'GET', pattern: '/api/pipelines/orchestrator/state', response: MOCK_ORCHESTRATOR_STATE },
  { method: 'GET', pattern: '/api/pipelines/orchestrator/session', response: MOCK_PIPELINE_SESSION },
  { method: 'GET', pattern: '/api/pipelines/history', response: MOCK_PIPELINE_HISTORY },
  { method: 'GET', pattern: '/api/pipelines/{name}/config', response: MOCK_PIPELINE_FRAMEWORK_CONFIG },
  { method: 'GET', pattern: '/api/pipelines/{id}/logs', response: MOCK_PIPELINE_LOGS },
  { method: 'GET', pattern: '/api/pipelines/{id}', response: MOCK_PIPELINE_RUNS.items[0] },
  { method: 'GET', pattern: '/api/pipelines', response: MOCK_PIPELINE_RUNS },
  { method: 'POST', pattern: '/api/pipelines/{id}/cancel', response: SUCCESS },
  { method: 'POST', pattern: '/api/pipelines/{id}/retry', response: SUCCESS },

  // ── 50. Geo-Search Admin Search ──
  { method: 'GET', pattern: '/api/geo-search/admin/search', response: MOCK_GEO_ADMIN_SEARCH },
];

// ════════════════════════════════════════════════════════════════
// INTERCEPTOR EXPORT
// ════════════════════════════════════════════════════════════════

export const mockDataInterceptor: HttpInterceptorFn = (req, next) => {
  const raw = req.url;

  if (raw.endsWith('/health') || raw.endsWith('/health/')) {
    return of(new HttpResponse({ status: 200, body: { status: 'Healthy' } })).pipe(delay(30));
  }

  const url = raw.replace(/^https?:\/\/[^/]+/, '');

  const body = findMockResponse(req.method, url);
  if (body !== null) {
    return of(new HttpResponse({ status: 200, body })).pipe(delay(60 + Math.random() * 80));
  }

  if (url.includes('/api/')) {
    return of(new HttpResponse({ status: 200, body: {} })).pipe(delay(50));
  }

  return next(req);
};

export const mockFallbackInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((err) => {
      const url = req.url.replace(/^https?:\/\/[^/]+/, '');
      const body = findMockResponse(req.method, url);
      if (body !== null) {
        console.warn(`[MockFallback] ${req.method} ${url} → using mock (backend returned ${err.status})`);
        return of(new HttpResponse({ status: 200, body }));
      }
      if (url.includes('/api/')) {
        console.warn(`[MockFallback] ${req.method} ${url} → empty fallback (backend returned ${err.status})`);
        return of(new HttpResponse({ status: 200, body: {} }));
      }
      throw err;
    })
  );
};
