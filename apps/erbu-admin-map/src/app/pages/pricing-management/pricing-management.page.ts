import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  signal,
  computed,
  inject,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  PricingService,
  PricingRule,
  PricingRuleType,
  PricingRuleStatus,
  PricingRuleFormData,
  SurgeConfig,
  SurgeConfigUpdate,
  AbTestConfig,
  PricingZone,
  PricingSimulation,
} from './pricing.service';

type ActiveTab = 'rules' | 'surge' | 'zones' | 'ab-tests' | 'simulator';

const EMPTY_FORM: PricingRuleFormData = {
  name: '',
  type: 'base-fare',
  status: 'draft',
  description: '',
  currency: 'EUR',
  value: 0,
  minValue: null,
  maxValue: null,
  priority: 0,
  zoneId: null,
  startTime: null,
  endTime: null,
  daysOfWeek: [],
  validFrom: null,
  validUntil: null,
};

@Component({
  selector: 'app-pricing-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pricing-management.page.html',
  styleUrl: './pricing-management.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PricingManagementPage implements OnInit {
  private readonly svc = inject(PricingService);
  private readonly destroyRef = inject(DestroyRef);

  // ---------- signals ----------
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly saving = signal(false);
  readonly activeTab = signal<ActiveTab>('rules');

  // Rules
  readonly rules = signal<PricingRule[]>([]);
  readonly filterType = signal<PricingRuleType | 'all'>('all');
  readonly filterStatus = signal<PricingRuleStatus | 'all'>('all');
  readonly searchQuery = signal('');
  readonly editingRule = signal<PricingRule | null>(null);
  readonly showRuleForm = signal(false);
  readonly ruleForm = signal<PricingRuleFormData>({ ...EMPTY_FORM });
  readonly deleteConfirm = signal<PricingRule | null>(null);

  // Surge
  readonly surgeConfigs = signal<SurgeConfig[]>([]);
  readonly editingSurge = signal<SurgeConfig | null>(null);

  // Zones
  readonly zones = signal<PricingZone[]>([]);

  // A/B Tests
  readonly abTests = signal<AbTestConfig[]>([]);

  // Simulator
  readonly simParams = signal({
    distanceKm: 5,
    durationMinutes: 15,
    zoneId: '',
    timeOfDay: '12:00',
    dayOfWeek: 1,
  });
  readonly simResult = signal<PricingSimulation | null>(null);
  readonly simulating = signal(false);

  // ---------- computed ----------
  readonly filteredRules = computed(() => {
    let list = this.rules();
    const type = this.filterType();
    const status = this.filterStatus();
    const query = this.searchQuery().toLowerCase().trim();

    if (type !== 'all') {
      list = list.filter((r) => r.type === type);
    }
    if (status !== 'all') {
      list = list.filter((r) => r.status === status);
    }
    if (query) {
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.description.toLowerCase().includes(query),
      );
    }
    return list;
  });

  readonly activeRulesCount = computed(
    () => this.rules().filter((r) => r.status === 'active').length,
  );
  readonly draftRulesCount = computed(
    () => this.rules().filter((r) => r.status === 'draft').length,
  );
  readonly activeSurgeZones = computed(
    () => this.surgeConfigs().filter((s) => s.isActive && s.currentMultiplier > 1).length,
  );
  readonly runningTests = computed(
    () => this.abTests().filter((t) => t.status === 'running').length,
  );

  readonly ruleTypes: PricingRuleType[] = [
    'base-fare',
    'per-km',
    'per-minute',
    'surge',
    'zone',
    'time-of-day',
    'ab-test',
  ];

  readonly ruleStatuses: PricingRuleStatus[] = ['active', 'draft', 'disabled', 'expired'];

  readonly dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // ---------- lifecycle ----------
  ngOnInit(): void {
    this.loadRules();
    this.loadSurgeConfigs();
    this.loadZones();
    this.loadAbTests();
  }

  // ---------- data loading ----------
  private loadRules(): void {
    this.loading.set(true);
    this.svc
      .fetchRules()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rules) => {
          this.rules.set(rules);
          this.loading.set(false);
          this.error.set(null);
        },
        error: (err) => {
          this.error.set(err?.message ?? 'Failed to load pricing rules');
          this.loading.set(false);
        },
      });
  }

  private loadSurgeConfigs(): void {
    this.svc
      .fetchSurgeConfigs()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (configs) => this.surgeConfigs.set(configs),
        error: () => {},
      });
  }

  private loadZones(): void {
    this.svc
      .fetchZones()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (zones) => this.zones.set(zones),
        error: () => {},
      });
  }

  private loadAbTests(): void {
    this.svc
      .fetchAbTests()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tests) => this.abTests.set(tests),
        error: () => {},
      });
  }

  // ---------- tab navigation ----------
  switchTab(tab: ActiveTab): void {
    this.activeTab.set(tab);
  }

  // ---------- rule CRUD ----------
  openNewRuleForm(): void {
    this.editingRule.set(null);
    this.ruleForm.set({ ...EMPTY_FORM });
    this.showRuleForm.set(true);
  }

  openEditRuleForm(rule: PricingRule): void {
    this.editingRule.set(rule);
    this.ruleForm.set({
      name: rule.name,
      type: rule.type,
      status: rule.status,
      description: rule.description,
      currency: rule.currency,
      value: rule.value,
      minValue: rule.minValue,
      maxValue: rule.maxValue,
      priority: rule.priority,
      zoneId: rule.zoneId,
      startTime: rule.startTime,
      endTime: rule.endTime,
      daysOfWeek: [...rule.daysOfWeek],
      validFrom: rule.validFrom,
      validUntil: rule.validUntil,
    });
    this.showRuleForm.set(true);
  }

  closeRuleForm(): void {
    this.showRuleForm.set(false);
    this.editingRule.set(null);
  }

  saveRule(): void {
    const form = this.ruleForm();
    if (!form.name.trim()) return;

    this.saving.set(true);
    const editing = this.editingRule();

    const obs$ = editing
      ? this.svc.updateRule(editing.id, form)
      : this.svc.createRule(form);

    obs$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (saved) => {
        if (editing) {
          this.rules.update((list) =>
            list.map((r) => (r.id === saved.id ? saved : r)),
          );
        } else {
          this.rules.update((list) => [...list, saved]);
        }
        this.showRuleForm.set(false);
        this.editingRule.set(null);
        this.saving.set(false);
      },
      error: (err) => {
        this.error.set(err?.message ?? 'Failed to save rule');
        this.saving.set(false);
      },
    });
  }

  requestDeleteRule(rule: PricingRule): void {
    this.deleteConfirm.set(rule);
  }

  cancelDelete(): void {
    this.deleteConfirm.set(null);
  }

  confirmDeleteRule(): void {
    const rule = this.deleteConfirm();
    if (!rule) return;

    this.deleteConfirm.set(null);
    this.svc
      .deleteRule(rule.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.rules.update((list) => list.filter((r) => r.id !== rule.id));
        },
        error: (err) => {
          this.error.set(err?.message ?? 'Failed to delete rule');
        },
      });
  }

  // ---------- rule form helpers ----------
  updateFormField<K extends keyof PricingRuleFormData>(
    field: K,
    value: PricingRuleFormData[K],
  ): void {
    this.ruleForm.update((f) => ({ ...f, [field]: value }));
  }

  onFormInput(field: keyof PricingRuleFormData, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.type === 'number' ? parseFloat(input.value) || 0 : input.value;
    this.updateFormField(field, value as never);
  }

  onFormSelect(field: keyof PricingRuleFormData, event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.updateFormField(field, select.value as never);
  }

  toggleDayOfWeek(day: number): void {
    this.ruleForm.update((f) => {
      const days = f.daysOfWeek.includes(day)
        ? f.daysOfWeek.filter((d) => d !== day)
        : [...f.daysOfWeek, day];
      return { ...f, daysOfWeek: days };
    });
  }

  isDaySelected(day: number): boolean {
    return this.ruleForm().daysOfWeek.includes(day);
  }

  // ---------- filters ----------
  setFilterType(type: PricingRuleType | 'all'): void {
    this.filterType.set(type);
  }

  setFilterStatus(status: PricingRuleStatus | 'all'): void {
    this.filterStatus.set(status);
  }

  onSearchChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  // ---------- surge config ----------
  openSurgeEditor(config: SurgeConfig): void {
    this.editingSurge.set(config);
  }

  closeSurgeEditor(): void {
    this.editingSurge.set(null);
  }

  saveSurgeConfig(config: SurgeConfig, update: SurgeConfigUpdate): void {
    this.saving.set(true);
    this.svc
      .updateSurgeConfig(config.id, update)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (saved) => {
          this.surgeConfigs.update((list) =>
            list.map((c) => (c.id === saved.id ? saved : c)),
          );
          this.editingSurge.set(null);
          this.saving.set(false);
        },
        error: (err) => {
          this.error.set(err?.message ?? 'Failed to save surge config');
          this.saving.set(false);
        },
      });
  }

  // ---------- A/B tests ----------
  toggleAbTest(test: AbTestConfig): void {
    const action = test.status === 'running' ? 'pause' : 'resume';
    this.svc
      .toggleAbTest(test.id, action)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.abTests.update((list) =>
            list.map((t) => (t.id === updated.id ? updated : t)),
          );
        },
        error: () => {},
      });
  }

  // ---------- fare simulator ----------
  updateSimParam(field: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.type === 'number' ? parseFloat(input.value) || 0 : input.value;
    this.simParams.update((p) => ({ ...p, [field]: value }));
  }

  runSimulation(): void {
    const params = this.simParams();
    if (!params.zoneId) return;

    this.simulating.set(true);
    this.simResult.set(null);

    this.svc
      .simulateFare(params)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.simResult.set(result);
          this.simulating.set(false);
        },
        error: (err) => {
          this.error.set(err?.message ?? 'Simulation failed');
          this.simulating.set(false);
        },
      });
  }

  // ---------- template helpers ----------
  ruleTypeLabel(type: PricingRuleType): string {
    const labels: Record<PricingRuleType, string> = {
      'base-fare': 'Base Fare',
      'per-km': 'Per KM',
      'per-minute': 'Per Minute',
      surge: 'Surge',
      zone: 'Zone',
      'time-of-day': 'Time of Day',
      'ab-test': 'A/B Test',
    };
    return labels[type] ?? type;
  }

  statusClass(status: PricingRuleStatus): string {
    switch (status) {
      case 'active':
        return 'status-active';
      case 'draft':
        return 'status-draft';
      case 'disabled':
        return 'status-disabled';
      case 'expired':
        return 'status-expired';
      default:
        return '';
    }
  }

  surgeMultiplierClass(multiplier: number): string {
    if (multiplier >= 2.0) return 'surge-high';
    if (multiplier >= 1.5) return 'surge-medium';
    if (multiplier > 1.0) return 'surge-low';
    return 'surge-none';
  }

  abTestStatusClass(status: string): string {
    switch (status) {
      case 'running':
        return 'abtest-running';
      case 'paused':
        return 'abtest-paused';
      case 'completed':
        return 'abtest-completed';
      case 'draft':
        return 'abtest-draft';
      default:
        return '';
    }
  }

  trackByRuleId(_: number, rule: PricingRule): string {
    return rule.id;
  }

  trackBySurgeId(_: number, config: SurgeConfig): string {
    return config.id;
  }

  trackByZoneId(_: number, zone: PricingZone): string {
    return zone.id;
  }

  trackByTestId(_: number, test: AbTestConfig): string {
    return test.id;
  }
}
