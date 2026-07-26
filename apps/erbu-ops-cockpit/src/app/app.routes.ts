import { Routes } from '@angular/router';

export const appRoutes: Routes = [
  // Default redirect
  { path: '', redirectTo: 'smoke', pathMatch: 'full' },

  // WEB-CPT-001: Smoke
  {
    path: 'smoke',
    loadComponent: () =>
      import('./pages/smoke-tab/smoke-tab.page').then((m) => m.SmokeTabPage),
  },

  // WEB-CPT-002: Pipelines
  {
    path: 'pipelines',
    loadComponent: () =>
      import('./pages/pipelines-tab/pipelines-tab.page').then((m) => m.PipelinesTabPage),
  },

  // WEB-CPT-003: Stories
  {
    path: 'stories',
    loadComponent: () =>
      import('./pages/stories-tab/stories-tab.page').then((m) => m.StoriesTabPage),
  },

  // WEB-CPT-004: Planner
  {
    path: 'planner',
    loadComponent: () =>
      import('./pages/planner-tab/planner-tab.page').then((m) => m.PlannerTabPage),
  },

  // WEB-CPT-005: Audit
  {
    path: 'audit',
    loadComponent: () =>
      import('./pages/audit-tab/audit-tab.page').then((m) => m.AuditTabPage),
  },

  // WEB-CPT-006: Trip Health
  {
    path: 'trip-health',
    loadComponent: () =>
      import('./pages/trip-health-tab/trip-health-tab.page').then((m) => m.TripHealthTabPage),
  },

  // WEB-CPT-007: Chaos
  {
    path: 'chaos',
    loadComponent: () =>
      import('./pages/chaos-tab/chaos-tab.page').then((m) => m.ChaosTabPage),
  },

  // WEB-CPT-008: E2E
  {
    path: 'e2e',
    loadComponent: () =>
      import('./pages/e2e-tab/e2e-tab.page').then((m) => m.E2ETabPage),
  },

  // WEB-CPT-009: Coverage
  {
    path: 'coverage',
    loadComponent: () =>
      import('./pages/coverage-tab/coverage-tab.page').then((m) => m.CoverageTabPage),
  },

  // WEB-CPT-010: Instances
  {
    path: 'instances',
    loadComponent: () =>
      import('./pages/instances-tab/instances-tab.page').then((m) => m.InstancesTabPage),
  },

  // WEB-CPT-011: Mobile
  {
    path: 'mobile',
    loadComponent: () =>
      import('./pages/mobile-tab/mobile-tab.page').then((m) => m.MobileTabPage),
  },

  // WEB-CPT-012: Reports
  {
    path: 'reports',
    loadComponent: () =>
      import('./pages/reports-tab/reports-tab.page').then((m) => m.ReportsTabPage),
  },

  // WEB-CPT-013: ReplayDiff
  {
    path: 'replay-diff',
    loadComponent: () =>
      import('./pages/replay-diff-tab/replay-diff-tab.page').then((m) => m.ReplayDiffTabPage),
  },

  // WEB-CPT-014: Scenario Builder
  {
    path: 'scenario-builder',
    loadComponent: () =>
      import('./pages/scenario-builder-tab/scenario-builder-tab.page').then(
        (m) => m.ScenarioBuilderTabPage,
      ),
  },

  // Wildcard fallback
  { path: '**', redirectTo: 'smoke' },
];
