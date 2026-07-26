import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  ConfigService,
  FeatureFlag,
  Capability,
  RuntimeOverride,
  ArchitectureDecisionRecord,
  ConfigTreeNode,
  AdrStatus,
} from './config.service';
import { FlagsTabComponent } from './tabs/flags-tab.component';
import { SloTabComponent } from './tabs/slo-tab.component';
import { SchemasTabComponent } from './tabs/schemas-tab.component';

export type ConfigTab = 'flags' | 'slos' | 'capabilities' | 'schemas' | 'overrides' | 'adrs';

@Component({
  selector: 'app-geostudio-config',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    FlagsTabComponent,
    SloTabComponent,
    SchemasTabComponent,
  ],
  templateUrl: './config.component.html',
  styleUrl: './config.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfigComponent implements OnInit, OnDestroy {
  private readonly svc = inject(ConfigService);
  private readonly destroyRef = inject(DestroyRef);

  // ---------- State ----------
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly lastUpdated = signal<string>('');
  readonly activeTab = signal<ConfigTab>('flags');

  // ---------- Delegated from service ----------
  readonly capabilities = this.svc.capabilities;
  readonly overrides = this.svc.overrides;
  readonly adrs = this.svc.adrs;
  readonly configTree = this.svc.configTree;

  // Config tree expansion state
  readonly expandedTreeKeys = signal<Set<string>>(new Set());
  readonly selectedTreeNode = signal<ConfigTreeNode | null>(null);

  // Capabilities
  readonly capabilitySearch = signal('');
  readonly filteredCapabilities = computed(() => {
    let caps = this.capabilities();
    const term = this.capabilitySearch().toLowerCase();
    if (term) {
      caps = caps.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          c.key.toLowerCase().includes(term) ||
          c.category.toLowerCase().includes(term),
      );
    }
    return caps;
  });
  readonly capabilityCategories = computed(() => {
    const caps = this.capabilities();
    const cats = new Set(caps.map((c) => c.category));
    return Array.from(cats).sort();
  });

  // Overrides
  readonly activeOverrides = computed(
    () => this.overrides().filter((o) => o.isActive),
  );
  readonly expiredOverrides = computed(
    () => this.overrides().filter((o) => !o.isActive),
  );

  // Override creation form
  readonly showOverrideForm = signal(false);
  readonly newOverrideKey = signal('');
  readonly newOverrideValue = signal('');
  readonly newOverrideReason = signal('');
  readonly newOverrideExpiry = signal('');

  // ADR
  readonly expandedAdrId = signal<string | null>(null);

  // Tab definitions
  readonly tabs: { key: ConfigTab; label: string; icon: string }[] = [
    { key: 'flags', label: 'Flags', icon: 'flag' },
    { key: 'slos', label: 'SLOs', icon: 'speed' },
    { key: 'capabilities', label: 'Capabilities', icon: 'extension' },
    { key: 'schemas', label: 'Schemas', icon: 'schema' },
    { key: 'overrides', label: 'Overrides', icon: 'tune' },
    { key: 'adrs', label: 'ADRs', icon: 'gavel' },
  ];

  // ---------- Lifecycle ----------
  ngOnInit(): void {
    this.svc.dashboard$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.lastUpdated.set(new Date().toLocaleTimeString());
          this.loading.set(false);
          this.error.set(null);
        },
        error: (err) => {
          this.error.set(err?.message ?? 'Failed to load configuration data');
          this.loading.set(false);
        },
      });
  }

  ngOnDestroy(): void {
    // cleanup handled by takeUntilDestroyed
  }

  // ---------- Tab navigation ----------
  setActiveTab(tab: ConfigTab): void {
    this.activeTab.set(tab);
  }

  // ---------- Config tree ----------
  toggleTreeNode(key: string): void {
    this.expandedTreeKeys.update((keys) => {
      const next = new Set(keys);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  isTreeNodeExpanded(key: string): boolean {
    return this.expandedTreeKeys().has(key);
  }

  selectTreeNode(node: ConfigTreeNode): void {
    this.selectedTreeNode.set(node);
  }

  // ---------- Capabilities ----------
  onCapabilitySearchChange(value: string): void {
    this.capabilitySearch.set(value);
  }

  toggleCapability(cap: Capability): void {
    this.svc.toggleCapability(cap.id, !cap.isEnabled).subscribe();
  }

  // ---------- Overrides ----------
  toggleOverrideForm(): void {
    this.showOverrideForm.update((v) => !v);
  }

  createOverride(): void {
    const key = this.newOverrideKey();
    const value = this.newOverrideValue();
    const reason = this.newOverrideReason();
    if (!key || !value || !reason) return;

    this.svc
      .createOverride({
        configKey: key,
        overrideValue: value,
        reason,
        expiresAt: this.newOverrideExpiry() || null,
      })
      .subscribe({
        next: () => {
          this.newOverrideKey.set('');
          this.newOverrideValue.set('');
          this.newOverrideReason.set('');
          this.newOverrideExpiry.set('');
          this.showOverrideForm.set(false);
        },
      });
  }

  revokeOverride(overrideId: string): void {
    this.svc.revokeOverride(overrideId).subscribe();
  }

  // ---------- ADRs ----------
  toggleAdrExpand(adrId: string): void {
    this.expandedAdrId.update((current) =>
      current === adrId ? null : adrId,
    );
  }

  adrStatusClass(status: AdrStatus): string {
    switch (status) {
      case 'accepted':
        return 'badge-success';
      case 'proposed':
        return 'badge-info';
      case 'deprecated':
        return 'badge-warning';
      case 'superseded':
        return 'badge-muted';
      default:
        return '';
    }
  }

  adrStatusIcon(status: AdrStatus): string {
    switch (status) {
      case 'accepted':
        return 'check_circle';
      case 'proposed':
        return 'pending';
      case 'deprecated':
        return 'warning';
      case 'superseded':
        return 'swap_horiz';
      default:
        return 'gavel';
    }
  }

  // ---------- Track-by functions ----------
  trackByCapId(_: number, cap: Capability): string {
    return cap.id;
  }

  trackByOverrideId(_: number, o: RuntimeOverride): string {
    return o.id;
  }

  trackByAdrId(_: number, adr: ArchitectureDecisionRecord): string {
    return adr.id;
  }

  trackByNodeKey(_: number, node: ConfigTreeNode): string {
    return node.key;
  }
}
