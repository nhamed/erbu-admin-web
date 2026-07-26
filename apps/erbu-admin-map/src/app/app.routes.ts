import { Routes } from '@angular/router';

export const appRoutes: Routes = [
  // Default redirect
  { path: '', redirectTo: 'map', pathMatch: 'full' },

  // WEB-MAP-001: Live Map
  {
    path: 'map',
    loadComponent: () =>
      import('./pages/map-page/map-page.component').then((m) => m.MapPageComponent),
  },

  // WEB-MAP-002: Driver Management
  {
    path: 'drivers',
    loadComponent: () =>
      import('./pages/driver-management/driver-management.page').then(
        (m) => m.DriverManagementPage,
      ),
  },

  // WEB-MAP-003: Payment Monitor
  {
    path: 'payments',
    loadComponent: () =>
      import('./pages/payment-monitor/payment-monitor.page').then(
        (m) => m.PaymentMonitorPage,
      ),
  },

  // WEB-MAP-004: Marketplace Admin
  {
    path: 'marketplace',
    loadComponent: () =>
      import('./pages/marketplace-admin/marketplace-admin.page').then(
        (m) => m.MarketplaceAdminPage,
      ),
  },

  // WEB-MAP-005: Driver Monitor
  {
    path: 'driver-monitor',
    loadComponent: () =>
      import('./pages/driver-monitor/driver-monitor.page').then(
        (m) => m.DriverMonitorPage,
      ),
  },

  // WEB-MAP-006: Reputation Admin
  {
    path: 'reputation',
    loadComponent: () =>
      import('./pages/reputation-admin/reputation-admin.page').then(
        (m) => m.ReputationAdminPage,
      ),
  },

  // WEB-MAP-007: Auth Management
  {
    path: 'auth-management',
    loadComponent: () =>
      import('./pages/auth-management/auth-management.page').then(
        (m) => m.AuthManagementPage,
      ),
  },

  // WEB-MAP-008: Rider Management
  {
    path: 'riders',
    loadComponent: () =>
      import('./pages/rider-management/rider-management.page').then(
        (m) => m.RiderManagementPage,
      ),
  },

  // WEB-MAP-009: Support Ticket
  {
    path: 'support',
    loadComponent: () =>
      import('./pages/support-ticket/support-ticket.page').then(
        (m) => m.SupportTicketPage,
      ),
  },

  // WEB-MAP-010: Alert Center
  {
    path: 'alerts',
    loadComponent: () =>
      import('./pages/alert-center/alert-center.page').then(
        (m) => m.AlertCenterPage,
      ),
  },

  // WEB-MAP-011: Orchestrator Admin
  {
    path: 'orchestrator',
    loadComponent: () =>
      import('./pages/orchestrator-admin/orchestrator-admin.page').then(
        (m) => m.OrchestratorAdminPage,
      ),
  },

  // WEB-MAP-012: Services Dashboard
  {
    path: 'services',
    loadComponent: () =>
      import('./pages/services-dashboard/services-dashboard.page').then(
        (m) => m.ServicesDashboardPage,
      ),
  },

  // WEB-MAP-013: Infrastructure Admin
  {
    path: 'infrastructure',
    loadComponent: () =>
      import('./pages/infrastructure-admin/infrastructure-admin.page').then(
        (m) => m.InfrastructureAdminPage,
      ),
  },

  // WEB-MAP-014: Pricing Management
  {
    path: 'pricing',
    loadComponent: () =>
      import('./pages/pricing-management/pricing-management.page').then(
        (m) => m.PricingManagementPage,
      ),
  },

  // WEB-MAP-015: Trip Management
  {
    path: 'trips',
    loadComponent: () =>
      import('./pages/trip-management/trip-management.page').then(
        (m) => m.TripManagementPage,
      ),
  },

  // WEB-MAP-016: Database Management
  {
    path: 'database',
    loadComponent: () =>
      import('./pages/database-management/database-management.page').then(
        (m) => m.DatabaseManagementPage,
      ),
  },

  // WEB-MAP-017: Redis Keys
  {
    path: 'redis',
    loadComponent: () =>
      import('./pages/redis-keys/redis-keys.page').then(
        (m) => m.RedisKeysPage,
      ),
  },

  // WEB-MAP-018: MinIO Objects
  {
    path: 'minio',
    loadComponent: () =>
      import('./pages/minio-objects/minio-objects.page').then(
        (m) => m.MinioObjectsPage,
      ),
  },

  // WEB-MAP-019: Observability Storage
  {
    path: 'observability',
    loadComponent: () =>
      import('./pages/observability-storage/observability-storage.page').then(
        (m) => m.ObservabilityStoragePage,
      ),
  },

  // WEB-MAP-020: Correlation Trace
  {
    path: 'traces',
    loadComponent: () =>
      import('./pages/correlation-trace/correlation-trace.page').then(
        (m) => m.CorrelationTracePage,
      ),
  },

  // WEB-MAP-021: Env Backup
  {
    path: 'env-backup',
    loadComponent: () =>
      import('./pages/env-backup/env-backup.page').then(
        (m) => m.EnvBackupPage,
      ),
  },

  // GeoStudio shell with 17 child modules + viz
  {
    path: 'geostudio',
    loadChildren: () =>
      import('./pages/geostudio/geostudio-shell.routes').then(
        (m) => m.geoStudioRoutes,
      ),
  },

  // Wildcard fallback
  { path: '**', redirectTo: 'map' },
];
