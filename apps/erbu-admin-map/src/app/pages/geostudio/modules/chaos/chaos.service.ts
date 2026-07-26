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
} from 'rxjs';
import { ChaosFault } from '@erbu-admin-web/shared/models';

// ---------- DTOs ----------

export type FaultType = 'Latency' | 'Error' | 'Kill' | 'PacketLoss' | 'CPUStress' | 'MemoryStress';
export type FaultSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

export interface ChaosScenario {
  id: string;
  name: string;
  description: string;
  faults: string[]; // fault IDs
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  lastExecutedAt: string | null;
  executionCount: number;
  schedule: string | null;
}

export interface ChaosState {
  killSwitchActive: boolean;
  activeFaultCount: number;
  activeScenarioCount: number;
  totalFaults: number;
  totalScenarios: number;
  lastKillSwitchAt: string | null;
  lastKillSwitchBy: string | null;
  featureFlagEnabled: boolean;
}

export interface ChaosDashboard {
  faults: ChaosFault[];
  scenarios: ChaosScenario[];
  state: ChaosState;
}

// ---------- Service ----------

const REFRESH_INTERVAL_MS = 15_000;
const API_BASE = '/api/geo/chaos';

@Injectable({ providedIn: 'root' })
export class ChaosService {
  private readonly http = inject(HttpClient);

  // ---------- state signals ----------
  readonly faults = signal<ChaosFault[]>([]);
  readonly scenarios = signal<ChaosScenario[]>([]);
  readonly state = signal<ChaosState>({
    killSwitchActive: false,
    activeFaultCount: 0,
    activeScenarioCount: 0,
    totalFaults: 0,
    totalScenarios: 0,
    lastKillSwitchAt: null,
    lastKillSwitchBy: null,
    featureFlagEnabled: false,
  });
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedFaultType = signal<FaultType | null>(null);
  readonly showActiveOnly = signal(false);

  // ---------- computed ----------
  readonly featureFlagEnabled = computed(() => this.state().featureFlagEnabled);
  readonly killSwitchActive = computed(() => this.state().killSwitchActive);

  readonly filteredFaults = computed(() => {
    let result = this.faults();
    const type = this.selectedFaultType();
    const activeOnly = this.showActiveOnly();
    if (type) {
      result = result.filter((f) => f.faultType === type);
    }
    if (activeOnly) {
      result = result.filter((f) => f.isActive);
    }
    return result;
  });

  readonly activeFaults = computed(() => this.faults().filter((f) => f.isActive));
  readonly inactiveFaults = computed(() => this.faults().filter((f) => !f.isActive));
  readonly activeScenarios = computed(() => this.scenarios().filter((s) => s.isActive));

  readonly faultsByType = computed(() => {
    const faults = this.faults();
    const counts: Record<string, number> = {};
    for (const f of faults) {
      counts[f.faultType] = (counts[f.faultType] ?? 0) + 1;
    }
    return counts;
  });

  readonly targetServices = computed(() => {
    const services = new Set<string>();
    for (const f of this.faults()) {
      services.add(f.targetService);
    }
    return [...services].sort();
  });

  // ---------- polling ----------
  readonly dashboard$: Observable<ChaosDashboard> = timer(0, REFRESH_INTERVAL_MS).pipe(
    switchMap(() => this.http.get<ChaosDashboard>(`${API_BASE}/dashboard`)),
    tap((d) => this.applyDashboard(d)),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  // ---------- commands ----------
  loadDashboard(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http
      .get<ChaosDashboard>(`${API_BASE}/dashboard`)
      .pipe(
        tap((d) => this.applyDashboard(d)),
        catchError((err) => {
          this.error.set('Failed to load chaos dashboard.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  /**
   * Kill-switch: NO confirmation by emergency design.
   * Immediately deactivates all active faults.
   */
  activateKillSwitch(): Observable<ChaosState> {
    return this.http.post<ChaosState>(`${API_BASE}/kill-switch`, {}).pipe(
      tap((newState) => {
        this.state.set(newState);
        // Deactivate all faults in local state
        this.faults.update((list) =>
          list.map((f) => ({ ...f, isActive: false })),
        );
      }),
      catchError((err) => {
        this.error.set('Failed to activate kill switch.');
        return throwError(() => err);
      }),
    );
  }

  activateFault(faultId: string): Observable<ChaosFault> {
    return this.http.post<ChaosFault>(`${API_BASE}/faults/${faultId}/activate`, {}).pipe(
      tap((fault) => this.updateFaultInList(fault)),
      catchError((err) => {
        this.error.set('Failed to activate fault.');
        return throwError(() => err);
      }),
    );
  }

  deactivateFault(faultId: string): Observable<ChaosFault> {
    return this.http.post<ChaosFault>(`${API_BASE}/faults/${faultId}/deactivate`, {}).pipe(
      tap((fault) => this.updateFaultInList(fault)),
      catchError((err) => {
        this.error.set('Failed to deactivate fault.');
        return throwError(() => err);
      }),
    );
  }

  activateScenario(scenarioId: string): Observable<ChaosScenario> {
    return this.http
      .post<ChaosScenario>(`${API_BASE}/scenarios/${scenarioId}/activate`, {})
      .pipe(
        tap((scenario) => this.updateScenarioInList(scenario)),
        catchError((err) => {
          this.error.set('Failed to activate scenario.');
          return throwError(() => err);
        }),
      );
  }

  deactivateScenario(scenarioId: string): Observable<ChaosScenario> {
    return this.http
      .post<ChaosScenario>(`${API_BASE}/scenarios/${scenarioId}/deactivate`, {})
      .pipe(
        tap((scenario) => this.updateScenarioInList(scenario)),
        catchError((err) => {
          this.error.set('Failed to deactivate scenario.');
          return throwError(() => err);
        }),
      );
  }

  setFaultTypeFilter(type: FaultType | null): void {
    this.selectedFaultType.set(type);
  }

  setActiveFilter(activeOnly: boolean): void {
    this.showActiveOnly.set(activeOnly);
  }

  clearError(): void {
    this.error.set(null);
  }

  // ---------- private ----------
  private applyDashboard(d: ChaosDashboard): void {
    this.faults.set(d.faults);
    this.scenarios.set(d.scenarios);
    this.state.set(d.state);
    this.error.set(null);
  }

  private updateFaultInList(updated: ChaosFault): void {
    this.faults.update((list) =>
      list.map((f) => (f.id === updated.id ? updated : f)),
    );
  }

  private updateScenarioInList(updated: ChaosScenario): void {
    this.scenarios.update((list) =>
      list.map((s) => (s.id === updated.id ? updated : s)),
    );
  }
}
