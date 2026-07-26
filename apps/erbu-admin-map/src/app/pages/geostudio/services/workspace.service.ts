import { Injectable, signal, computed, effect } from '@angular/core';

// ---------- Types ----------

export interface WorkspaceTab {
  id: string;
  moduleId: string;
  label: string;
  icon: string;
  route: string;
  isActive: boolean;
  isPinned: boolean;
  openedAt: number;
}

export interface WorkspaceLayout {
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  tabs: WorkspaceTab[];
  activeTabId: string | null;
}

const WORKSPACE_KEY = 'geo_studio_workspace';

const DEFAULT_LAYOUT: WorkspaceLayout = {
  sidebarWidth: 260,
  sidebarCollapsed: false,
  tabs: [],
  activeTabId: null,
};

@Injectable({ providedIn: 'root' })
export class WorkspaceService {
  // ---------- State ----------
  readonly tabs = signal<WorkspaceTab[]>([]);
  readonly activeTabId = signal<string | null>(null);
  readonly sidebarCollapsed = signal(false);
  readonly sidebarWidth = signal(260);

  readonly activeTab = computed(() => {
    const id = this.activeTabId();
    return this.tabs().find((t) => t.id === id) ?? null;
  });

  readonly openTabCount = computed(() => this.tabs().length);

  constructor() {
    this.loadState();

    // persist on every change
    effect(() => {
      const layout: WorkspaceLayout = {
        sidebarWidth: this.sidebarWidth(),
        sidebarCollapsed: this.sidebarCollapsed(),
        tabs: this.tabs(),
        activeTabId: this.activeTabId(),
      };
      localStorage.setItem(WORKSPACE_KEY, JSON.stringify(layout));
    });
  }

  // ---------- Tab management ----------

  openTab(moduleId: string, label: string, icon: string, route: string): void {
    const existing = this.tabs().find((t) => t.moduleId === moduleId);
    if (existing) {
      this.activateTab(existing.id);
      return;
    }

    const tab: WorkspaceTab = {
      id: `tab_${Date.now()}_${moduleId}`,
      moduleId,
      label,
      icon,
      route,
      isActive: true,
      isPinned: false,
      openedAt: Date.now(),
    };

    this.tabs.update((tabs) => [
      ...tabs.map((t) => ({ ...t, isActive: false })),
      tab,
    ]);
    this.activeTabId.set(tab.id);
  }

  closeTab(tabId: string): void {
    const idx = this.tabs().findIndex((t) => t.id === tabId);
    if (idx === -1) return;

    const tab = this.tabs()[idx];
    if (tab.isPinned) return;

    this.tabs.update((tabs) => tabs.filter((t) => t.id !== tabId));

    if (this.activeTabId() === tabId) {
      const remaining = this.tabs();
      if (remaining.length > 0) {
        const nextIdx = Math.min(idx, remaining.length - 1);
        this.activateTab(remaining[nextIdx].id);
      } else {
        this.activeTabId.set(null);
      }
    }
  }

  activateTab(tabId: string): void {
    this.tabs.update((tabs) =>
      tabs.map((t) => ({ ...t, isActive: t.id === tabId })),
    );
    this.activeTabId.set(tabId);
  }

  pinTab(tabId: string): void {
    this.tabs.update((tabs) =>
      tabs.map((t) => (t.id === tabId ? { ...t, isPinned: true } : t)),
    );
  }

  unpinTab(tabId: string): void {
    this.tabs.update((tabs) =>
      tabs.map((t) => (t.id === tabId ? { ...t, isPinned: false } : t)),
    );
  }

  closeOtherTabs(tabId: string): void {
    this.tabs.update((tabs) =>
      tabs.filter((t) => t.id === tabId || t.isPinned),
    );
    this.activateTab(tabId);
  }

  closeAllTabs(): void {
    this.tabs.update((tabs) => tabs.filter((t) => t.isPinned));
    const pinned = this.tabs();
    this.activeTabId.set(pinned.length > 0 ? pinned[0].id : null);
  }

  // ---------- Sidebar ----------

  toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  setSidebarWidth(width: number): void {
    this.sidebarWidth.set(Math.max(180, Math.min(400, width)));
  }

  // ---------- Persistence ----------

  private loadState(): void {
    try {
      const raw = localStorage.getItem(WORKSPACE_KEY);
      if (!raw) return;
      const layout: WorkspaceLayout = JSON.parse(raw);
      this.tabs.set(layout.tabs ?? []);
      this.activeTabId.set(layout.activeTabId ?? null);
      this.sidebarCollapsed.set(layout.sidebarCollapsed ?? false);
      this.sidebarWidth.set(layout.sidebarWidth ?? 260);
    } catch {
      // corrupt state, reset
      localStorage.removeItem(WORKSPACE_KEY);
    }
  }
}
