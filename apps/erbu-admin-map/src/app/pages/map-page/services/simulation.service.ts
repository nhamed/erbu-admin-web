import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface SimulationConfig {
  driverCount: number;
  riderCount: number;
  areaCenter: { lat: number; lng: number };
  areaRadiusKm: number;
  speedMultiplier: number;
  scenario: string;
}

export interface SimulationStatus {
  isRunning: boolean;
  simulationId: string | null;
  startedAt: string | null;
  activeDrivers: number;
  activeRiders: number;
  tripsGenerated: number;
  elapsedSeconds: number;
  scenario: string | null;
}

/**
 * SimulationService
 *
 * Proxies to the DevTools API for launching and managing map simulations.
 * The DevTools API runs locally during development and provides synthetic
 * driver/rider movements for testing the real-time map.
 */
@Injectable()
export class SimulationService {
  private readonly http = inject(HttpClient);

  private readonly _status = signal<SimulationStatus>({
    isRunning: false,
    simulationId: null,
    startedAt: null,
    activeDrivers: 0,
    activeRiders: 0,
    tripsGenerated: 0,
    elapsedSeconds: 0,
    scenario: null,
  });
  readonly status = this._status.asReadonly();

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  private get baseUrl(): string {
    return '/api/simulation';
  }

  /**
   * Launch a new simulation with the given config.
   */
  async launchSim(config: SimulationConfig): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const result = await firstValueFrom(
        this.http.post<{ simulationId: string }>(
          `${this.baseUrl}/start`,
          config,
        ),
      );

      this._status.update((s) => ({
        ...s,
        isRunning: true,
        simulationId: result.simulationId,
        startedAt: new Date().toISOString(),
        scenario: config.scenario,
      }));

      this.startPolling();
    } catch (err) {
      this._error.set(
        err instanceof Error ? err.message : 'Failed to launch simulation',
      );
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Stop the currently running simulation.
   */
  async stopSim(): Promise<void> {
    const simId = this._status().simulationId;
    if (!simId) return;

    this._loading.set(true);
    this._error.set(null);

    try {
      await firstValueFrom(
        this.http.post(`${this.baseUrl}/stop/${simId}`, null),
      );

      this.stopPolling();
      this._status.set({
        isRunning: false,
        simulationId: null,
        startedAt: null,
        activeDrivers: 0,
        activeRiders: 0,
        tripsGenerated: 0,
        elapsedSeconds: 0,
        scenario: null,
      });
    } catch (err) {
      this._error.set(
        err instanceof Error ? err.message : 'Failed to stop simulation',
      );
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Fetch the current simulation status from DevTools API.
   */
  async getSimStatus(): Promise<SimulationStatus> {
    try {
      const status = await firstValueFrom(
        this.http.get<SimulationStatus>(`${this.baseUrl}/status`),
      );
      this._status.set(status);
      this._error.set(null);
      return status;
    } catch (err) {
      this._error.set(
        err instanceof Error ? err.message : 'Failed to fetch sim status',
      );
      return this._status();
    }
  }

  /** Clean up polling on destroy. */
  dispose(): void {
    this.stopPolling();
  }

  // ------------------------------------------------------------------
  // Private
  // ------------------------------------------------------------------

  private startPolling(): void {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      this.getSimStatus();
    }, 3000);
  }

  private stopPolling(): void {
    if (this.pollTimer !== null) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
