import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';

import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';

import { WorkspaceService, WorkspaceTab } from './services/workspace.service';
import { SearchAdminService, SearchResult } from './services/search-admin.service';
import { GeoNotificationService, GeoNotification } from './services/geo-notification.service';

// ---------- Module definitions ----------

export interface ModuleDefinition {
  id: string;
  label: string;
  icon: string;
  route: string;
  group: ModuleGroupKey;
}

export type ModuleGroupKey = 'OPERATE' | 'EXPLORE' | 'DATA_GRAPH' | 'QUALITY_LEARNING' | 'PLATFORM';

export interface ModuleGroupDef {
  key: ModuleGroupKey;
  label: string;
  icon: string;
  modules: ModuleDefinition[];
}

const MODULE_GROUPS: ModuleGroupDef[] = [
  {
    key: 'OPERATE',
    label: 'Operate',
    icon: 'engineering',
    modules: [
      { id: 'monitor', label: 'Monitor', icon: 'monitor_heart', route: 'monitor', group: 'OPERATE' },
      { id: 'ingestion', label: 'Ingestion', icon: 'input', route: 'ingestion', group: 'OPERATE' },
      { id: 'infrastructure', label: 'Infrastructure', icon: 'dns', route: 'infrastructure', group: 'OPERATE' },
      { id: 'chaos', label: 'Chaos', icon: 'bolt', route: 'chaos', group: 'OPERATE' },
    ],
  },
  {
    key: 'EXPLORE',
    label: 'Explore',
    icon: 'explore',
    modules: [
      { id: 'search-explorer', label: 'Search Explorer', icon: 'manage_search', route: 'search-explorer', group: 'EXPLORE' },
      { id: 'collections', label: 'Collections', icon: 'folder_special', route: 'collections', group: 'EXPLORE' },
      { id: 'history', label: 'History', icon: 'history', route: 'history', group: 'EXPLORE' },
    ],
  },
  {
    key: 'DATA_GRAPH',
    label: 'Data & Graph',
    icon: 'hub',
    modules: [
      { id: 'knowledge-graph', label: 'Knowledge Graph', icon: 'account_tree', route: 'knowledge-graph', group: 'DATA_GRAPH' },
      { id: 'feature-store', label: 'Feature Store', icon: 'dataset', route: 'feature-store', group: 'DATA_GRAPH' },
      { id: 'digital-twin', label: 'Digital Twin', icon: 'content_copy', route: 'digital-twin', group: 'DATA_GRAPH' },
    ],
  },
  {
    key: 'QUALITY_LEARNING',
    label: 'Quality & Learning',
    icon: 'school',
    modules: [
      { id: 'quality', label: 'Quality', icon: 'verified', route: 'quality', group: 'QUALITY_LEARNING' },
      { id: 'learning', label: 'Learning', icon: 'model_training', route: 'learning', group: 'QUALITY_LEARNING' },
      { id: 'experiments', label: 'Experiments', icon: 'science', route: 'experiments', group: 'QUALITY_LEARNING' },
      { id: 'ranking', label: 'Ranking', icon: 'leaderboard', route: 'ranking', group: 'QUALITY_LEARNING' },
    ],
  },
  {
    key: 'PLATFORM',
    label: 'Platform',
    icon: 'settings_applications',
    modules: [
      { id: 'config', label: 'Config', icon: 'tune', route: 'config', group: 'PLATFORM' },
      { id: 'settings', label: 'Settings', icon: 'settings', route: 'settings', group: 'PLATFORM' },
      { id: 'governance', label: 'Governance', icon: 'gavel', route: 'governance', group: 'PLATFORM' },
    ],
  },
];

@Component({
  selector: 'app-geostudio-shell',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatBadgeModule,
    MatTooltipModule,
    MatMenuModule,
    MatButtonModule,
  ],
  templateUrl: './geostudio-shell.page.html',
  styleUrl: './geostudio-shell.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GeoStudioShellPage implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly workspace = inject(WorkspaceService);
  readonly search = inject(SearchAdminService);
  readonly notifications = inject(GeoNotificationService);

  // ---------- State ----------
  readonly moduleGroups = MODULE_GROUPS;
  readonly allModules = MODULE_GROUPS.flatMap((g) => g.modules);
  readonly activeModuleId = signal<string>('monitor');
  readonly searchFocused = signal(false);
  readonly searchQuery = signal('');

  readonly activeModule = computed(() =>
    this.allModules.find((m) => m.id === this.activeModuleId()) ?? this.allModules[0],
  );

  // ---------- Lifecycle ----------

  ngOnInit(): void {
    // Subscribe to search autocomplete
    this.search.autocomplete$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe();

    // Track active module from route
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        const segments = event.urlAfterRedirects.split('/');
        const lastSegment = segments[segments.length - 1];
        const mod = this.allModules.find((m) => m.route === lastSegment);
        if (mod) {
          this.activeModuleId.set(mod.id);
        }
      });
  }

  // ---------- Navigation ----------

  navigateToModule(mod: ModuleDefinition): void {
    this.workspace.openTab(mod.id, mod.label, mod.icon, mod.route);
    this.router.navigate([mod.route], { relativeTo: this.route });
    this.activeModuleId.set(mod.id);
  }

  onTabClick(tab: WorkspaceTab): void {
    this.workspace.activateTab(tab.id);
    this.router.navigate([tab.route], { relativeTo: this.route });
    this.activeModuleId.set(tab.moduleId);
  }

  onTabClose(event: Event, tab: WorkspaceTab): void {
    event.stopPropagation();
    this.workspace.closeTab(tab.id);
    const active = this.workspace.activeTab();
    if (active) {
      this.router.navigate([active.route], { relativeTo: this.route });
      this.activeModuleId.set(active.moduleId);
    }
  }

  isModuleActive(moduleId: string): boolean {
    return this.activeModuleId() === moduleId;
  }

  // ---------- Search ----------

  onSearchInput(query: string): void {
    this.searchQuery.set(query);
    this.search.search(query);
  }

  onSearchFocus(): void {
    this.searchFocused.set(true);
  }

  onSearchBlur(): void {
    // Delay to allow click on results
    setTimeout(() => this.searchFocused.set(false), 200);
  }

  onSearchResultClick(result: SearchResult): void {
    this.searchFocused.set(false);
    this.search.clearSearch();
    this.searchQuery.set('');
    this.router.navigate([result.route], { relativeTo: this.route });
  }

  // ---------- Notifications ----------

  onNotificationClick(notification: GeoNotification): void {
    this.notifications.markAsRead(notification.id);
    if (notification.actionRoute) {
      this.router.navigate([notification.actionRoute], { relativeTo: this.route });
    }
    this.notifications.closeDropdown();
  }

  // ---------- Track functions ----------

  trackByModuleId(_: number, mod: ModuleDefinition): string {
    return mod.id;
  }

  trackByGroupKey(_: number, group: ModuleGroupDef): string {
    return group.key;
  }

  trackByTabId(_: number, tab: WorkspaceTab): string {
    return tab.id;
  }

  trackByNotifId(_: number, n: GeoNotification): string {
    return n.id;
  }

  trackByResultId(_: number, r: SearchResult): string {
    return r.id;
  }
}
