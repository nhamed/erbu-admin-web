import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  Observable,
  timer,
  switchMap,
  shareReplay,
  catchError,
  throwError,
  tap,
  finalize,
  of,
} from 'rxjs';
import { Environment } from '@erbu-admin-web/shared/data-access';

// ---------- DTOs ----------

export type FlagStatus = 'enabled' | 'disabled' | 'rollout';

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  status: FlagStatus;
  rolloutPercentage: number | null;
  environment: string;
  lastModifiedAt: string;
  lastModifiedBy: string;
  tags: string[];
  dependencies: string[];
}

export interface SloDefinition {
  id: string;
  name: string;
  description: string;
  targetPercent: number;
  currentPercent: number;
  metricType: string;
  windowDays: number;
  errorBudgetRemainingPercent: number;
  isBreaching: boolean;
  lastEvaluatedAt: string;
  alertChannels: string[];
}

export interface Capability {
  id: string;
  key: string;
  name: string;
  description: string;
  isEnabled: boolean;
  requiredRole: string;
  dependencies: string[];
  category: string;
  lastModifiedAt: string;
  lastModifiedBy: string;
}

export type SchemaStatus = 'draft' | 'active' | 'deprecated' | 'archived';

export interface ConfigSchema {
  id: string;
  name: string;
  version: number;
  status: SchemaStatus;
  fields: SchemaField[];
  createdAt: string;
  createdBy: string;
  activatedAt: string | null;
  description: string;
  compatibleVersions: number[];
}

export interface SchemaField {
  name: string;
  type: string;
  required: boolean;
  description: string;
  defaultValue: string | null;
  validationRegex: string | null;
}

export interface RuntimeOverride {
  id: string;
  configKey: string;
  originalValue: string;
  overrideValue: string;
  reason: string;
  appliedAt: string;
  appliedBy: string;
  expiresAt: string | null;
  isActive: boolean;
  environment: string;
}

export type AdrStatus = 'proposed' | 'accepted' | 'deprecated' | 'superseded';

export interface ArchitectureDecisionRecord {
  id: string;
  number: number;
  title: string;
  status: AdrStatus;
  context: string;
  decision: string;
  consequences: string;
  createdAt: string;
  createdBy: string;
  supersededBy: string | null;
  tags: string[];
}

export interface ConfigTreeNode {
  key: string;
  value: string | null;
  dataType: string;
  children: ConfigTreeNode[];
  isOverridden: boolean;
  isSecret: boolean;
  description: string;
  lastModifiedAt: string;
}

export interface ConfigDashboard {
  flags: FeatureFlag[];
  slos: SloDefinition[];
  capabilities: Capability[];
  schemas: ConfigSchema[];
  overrides: RuntimeOverride[];
  adrs: ArchitectureDecisionRecord[];
  configTree: ConfigTreeNode[];
  lastUpdatedAt: string;
}

// ---------- Service ----------

const REFRESH_INTERVAL_MS = 30_000;

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly http = inject(HttpClient);
  private readonly env = inject<Environment>('ENVIRONMENT' as never);

  private get apiBase(): string {
    return `${this.env.gatewayUrl}/api/geo-search/admin/config`;
  }

  // ---------- State signals ----------
  readonly flags = signal<FeatureFlag[]>([]);
  readonly slos = signal<SloDefinition[]>([]);
  readonly capabilities = signal<Capability[]>([]);
  readonly schemas = signal<ConfigSchema[]>([]);
  readonly overrides = signal<RuntimeOverride[]>([]);
  readonly adrs = signal<ArchitectureDecisionRecord[]>([]);
  readonly configTree = signal<ConfigTreeNode[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // ---------- Computed ----------
  readonly enabledFlagCount = computed(
    () => this.flags().filter((f) => f.status === 'enabled').length,
  );
  readonly disabledFlagCount = computed(
    () => this.flags().filter((f) => f.status === 'disabled').length,
  );
  readonly rolloutFlagCount = computed(
    () => this.flags().filter((f) => f.status === 'rollout').length,
  );
  readonly breachingSloCount = computed(
    () => this.slos().filter((s) => s.isBreaching).length,
  );
  readonly activeOverrideCount = computed(
    () => this.overrides().filter((o) => o.isActive).length,
  );
  readonly activeSchemaCount = computed(
    () => this.schemas().filter((s) => s.status === 'active').length,
  );

  // ---------- Polling ----------
  readonly dashboard$: Observable<ConfigDashboard> = timer(0, REFRESH_INTERVAL_MS).pipe(
    switchMap(() => this.http.get<ConfigDashboard>(`${this.apiBase}/dashboard`)),
    tap((d) => this.applyDashboard(d)),
    catchError((err) => {
      this.error.set('Failed to load configuration data.');
      return throwError(() => err);
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  // ---------- Flags ----------
  fetchFlags(): Observable<FeatureFlag[]> {
    return this.http.get<FeatureFlag[]>(`${this.apiBase}/flags`).pipe(
      tap((flags) => this.flags.set(flags)),
      catchError((err) => {
        this.error.set('Failed to load feature flags.');
        return throwError(() => err);
      }),
    );
  }

  toggleFlag(flagId: string, enabled: boolean): Observable<FeatureFlag> {
    return this.http
      .patch<FeatureFlag>(`${this.apiBase}/flags/${flagId}`, {
        status: enabled ? 'enabled' : 'disabled',
      })
      .pipe(
        tap((updated) => {
          this.flags.update((list) =>
            list.map((f) => (f.id === flagId ? updated : f)),
          );
        }),
        catchError((err) => {
          this.error.set('Failed to toggle feature flag.');
          return throwError(() => err);
        }),
      );
  }

  updateFlagRollout(flagId: string, percentage: number): Observable<FeatureFlag> {
    return this.http
      .patch<FeatureFlag>(`${this.apiBase}/flags/${flagId}`, {
        status: 'rollout',
        rolloutPercentage: percentage,
      })
      .pipe(
        tap((updated) => {
          this.flags.update((list) =>
            list.map((f) => (f.id === flagId ? updated : f)),
          );
        }),
        catchError((err) => {
          this.error.set('Failed to update flag rollout.');
          return throwError(() => err);
        }),
      );
  }

  // ---------- SLOs ----------
  fetchSlos(): Observable<SloDefinition[]> {
    return this.http.get<SloDefinition[]>(`${this.apiBase}/slos`).pipe(
      tap((slos) => this.slos.set(slos)),
      catchError((err) => {
        this.error.set('Failed to load SLO definitions.');
        return throwError(() => err);
      }),
    );
  }

  updateSlo(
    sloId: string,
    patch: { targetPercent?: number; windowDays?: number; alertChannels?: string[] },
  ): Observable<SloDefinition> {
    return this.http
      .patch<SloDefinition>(`${this.apiBase}/slos/${sloId}`, patch)
      .pipe(
        tap((updated) => {
          this.slos.update((list) =>
            list.map((s) => (s.id === sloId ? updated : s)),
          );
        }),
        catchError((err) => {
          this.error.set('Failed to update SLO.');
          return throwError(() => err);
        }),
      );
  }

  // ---------- Capabilities ----------
  fetchCapabilities(): Observable<Capability[]> {
    return this.http.get<Capability[]>(`${this.apiBase}/capabilities`).pipe(
      tap((caps) => this.capabilities.set(caps)),
      catchError((err) => {
        this.error.set('Failed to load capabilities.');
        return throwError(() => err);
      }),
    );
  }

  toggleCapability(capId: string, enabled: boolean): Observable<Capability> {
    return this.http
      .patch<Capability>(`${this.apiBase}/capabilities/${capId}`, { isEnabled: enabled })
      .pipe(
        tap((updated) => {
          this.capabilities.update((list) =>
            list.map((c) => (c.id === capId ? updated : c)),
          );
        }),
        catchError((err) => {
          this.error.set('Failed to toggle capability.');
          return throwError(() => err);
        }),
      );
  }

  // ---------- Schemas ----------
  fetchSchemas(): Observable<ConfigSchema[]> {
    return this.http.get<ConfigSchema[]>(`${this.apiBase}/schemas`).pipe(
      tap((schemas) => this.schemas.set(schemas)),
      catchError((err) => {
        this.error.set('Failed to load schemas.');
        return throwError(() => err);
      }),
    );
  }

  activateSchema(schemaId: string): Observable<ConfigSchema> {
    return this.http
      .post<ConfigSchema>(`${this.apiBase}/schemas/${schemaId}/activate`, {})
      .pipe(
        tap((updated) => {
          this.schemas.update((list) =>
            list.map((s) => (s.id === schemaId ? updated : s)),
          );
        }),
        catchError((err) => {
          this.error.set('Failed to activate schema.');
          return throwError(() => err);
        }),
      );
  }

  // ---------- Overrides ----------
  fetchOverrides(): Observable<RuntimeOverride[]> {
    return this.http.get<RuntimeOverride[]>(`${this.apiBase}/overrides`).pipe(
      tap((overrides) => this.overrides.set(overrides)),
      catchError((err) => {
        this.error.set('Failed to load runtime overrides.');
        return throwError(() => err);
      }),
    );
  }

  createOverride(override: {
    configKey: string;
    overrideValue: string;
    reason: string;
    expiresAt: string | null;
  }): Observable<RuntimeOverride> {
    return this.http
      .post<RuntimeOverride>(`${this.apiBase}/overrides`, override)
      .pipe(
        tap((created) => {
          this.overrides.update((list) => [created, ...list]);
        }),
        catchError((err) => {
          this.error.set('Failed to create override.');
          return throwError(() => err);
        }),
      );
  }

  revokeOverride(overrideId: string): Observable<void> {
    return this.http
      .delete<void>(`${this.apiBase}/overrides/${overrideId}`)
      .pipe(
        tap(() => {
          this.overrides.update((list) =>
            list.map((o) =>
              o.id === overrideId ? { ...o, isActive: false } : o,
            ),
          );
        }),
        catchError((err) => {
          this.error.set('Failed to revoke override.');
          return throwError(() => err);
        }),
      );
  }

  // ---------- ADRs ----------
  fetchAdrs(): Observable<ArchitectureDecisionRecord[]> {
    return this.http
      .get<ArchitectureDecisionRecord[]>(`${this.apiBase}/adrs`)
      .pipe(
        tap((adrs) => this.adrs.set(adrs)),
        catchError((err) => {
          this.error.set('Failed to load ADRs.');
          return throwError(() => err);
        }),
      );
  }

  // ---------- Config Tree ----------
  fetchConfigTree(): Observable<ConfigTreeNode[]> {
    return this.http.get<ConfigTreeNode[]>(`${this.apiBase}/tree`).pipe(
      tap((tree) => this.configTree.set(tree)),
      catchError((err) => {
        this.error.set('Failed to load config tree.');
        return throwError(() => err);
      }),
    );
  }

  // ---------- Utilities ----------
  clearError(): void {
    this.error.set(null);
  }

  private applyDashboard(d: ConfigDashboard): void {
    this.flags.set(d.flags);
    this.slos.set(d.slos);
    this.capabilities.set(d.capabilities);
    this.schemas.set(d.schemas);
    this.overrides.set(d.overrides);
    this.adrs.set(d.adrs);
    this.configTree.set(d.configTree);
    this.error.set(null);
  }
}
