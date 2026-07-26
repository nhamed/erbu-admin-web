import { Routes } from '@angular/router';
import { GeoStudioShellPage } from './geostudio-shell.page';

export const geoStudioRoutes: Routes = [
  {
    path: '',
    component: GeoStudioShellPage,
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },

      // --- OPERATE ---
      {
        path: 'home',
        loadComponent: () =>
          import('./modules/home/home.component').then((m) => m.HomeComponent),
        data: { moduleId: 'home', group: 'OPERATE' },
      },
      {
        path: 'monitor',
        loadComponent: () =>
          import('./modules/monitor/monitor.component').then((m) => m.MonitorComponent),
        data: { moduleId: 'monitor', group: 'OPERATE' },
      },
      {
        path: 'ingestion',
        loadComponent: () =>
          import('./modules/ingestion/ingestion.component').then((m) => m.IngestionComponent),
        data: { moduleId: 'ingestion', group: 'OPERATE' },
      },
      {
        path: 'infrastructure',
        loadComponent: () =>
          import('./modules/infrastructure/infrastructure.component').then((m) => m.InfrastructureComponent),
        data: { moduleId: 'infrastructure', group: 'OPERATE' },
      },
      {
        path: 'chaos',
        loadComponent: () =>
          import('./modules/chaos/chaos.component').then((m) => m.ChaosComponent),
        data: { moduleId: 'chaos', group: 'OPERATE' },
      },

      // --- EXPLORE ---
      {
        path: 'search-explorer',
        loadComponent: () =>
          import('./modules/search-explorer/search-explorer.component').then((m) => m.SearchExplorerComponent),
        data: { moduleId: 'search-explorer', group: 'EXPLORE' },
      },
      {
        path: 'collections',
        loadComponent: () =>
          import('./modules/collections/collections.component').then((m) => m.CollectionsComponent),
        data: { moduleId: 'collections', group: 'EXPLORE' },
      },
      {
        path: 'history',
        loadComponent: () =>
          import('./modules/history/history.component').then((m) => m.HistoryComponent),
        data: { moduleId: 'history', group: 'EXPLORE' },
      },

      // --- DATA & GRAPH ---
      {
        path: 'knowledge-graph',
        loadComponent: () =>
          import('./modules/knowledge-graph/knowledge-graph.component').then((m) => m.KnowledgeGraphComponent),
        data: { moduleId: 'knowledge-graph', group: 'DATA_GRAPH' },
      },
      {
        path: 'feature-store',
        loadComponent: () =>
          import('./modules/feature-store/feature-store.component').then((m) => m.FeatureStoreComponent),
        data: { moduleId: 'feature-store', group: 'DATA_GRAPH' },
      },
      {
        path: 'digital-twin',
        loadComponent: () =>
          import('./modules/digital-twin/digital-twin.component').then((m) => m.DigitalTwinComponent),
        data: { moduleId: 'digital-twin', group: 'DATA_GRAPH' },
      },

      // --- QUALITY & LEARNING ---
      {
        path: 'quality',
        loadComponent: () =>
          import('./modules/quality/quality.component').then((m) => m.QualityComponent),
        data: { moduleId: 'quality', group: 'QUALITY_LEARNING' },
      },
      {
        path: 'learning',
        loadComponent: () =>
          import('./modules/learning/learning.component').then((m) => m.LearningComponent),
        data: { moduleId: 'learning', group: 'QUALITY_LEARNING' },
      },
      {
        path: 'experiments',
        loadComponent: () =>
          import('./modules/experiments/experiments.component').then((m) => m.ExperimentsComponent),
        data: { moduleId: 'experiments', group: 'QUALITY_LEARNING' },
      },
      {
        path: 'ranking',
        loadComponent: () =>
          import('./modules/ranking/ranking.component').then((m) => m.RankingComponent),
        data: { moduleId: 'ranking', group: 'QUALITY_LEARNING' },
      },

      // --- PLATFORM ---
      {
        path: 'config',
        loadComponent: () =>
          import('./modules/config/config.component').then((m) => m.ConfigComponent),
        data: { moduleId: 'config', group: 'PLATFORM' },
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./modules/settings/settings.component').then((m) => m.SettingsComponent),
        data: { moduleId: 'settings', group: 'PLATFORM' },
      },
      {
        path: 'governance',
        loadComponent: () =>
          import('./modules/governance/governance.component').then((m) => m.GovernanceComponent),
        data: { moduleId: 'governance', group: 'PLATFORM' },
      },
    ],
  },
];
