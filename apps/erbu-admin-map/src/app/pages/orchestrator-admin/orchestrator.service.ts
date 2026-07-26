import { Injectable, inject, signal, computed, OnDestroy, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, tap, throwError, finalize, Subject } from 'rxjs';

// ---------- DTOs ----------

export type JobStatus = 'Queued' | 'Running' | 'Completed' | 'Failed' | 'Cancelled' | 'Retrying';

export type ServiceState = 'Running' | 'Stopped' | 'Degraded' | 'Starting' | 'Stopping' | 'Unknown';

export type DeploymentStatus = 'Pending' | 'InProgress' | 'Deployed' | 'RolledBack' | 'Failed';

export interface OrchestratorJob {
  id: string;
  name: string;
  type: string;
  status: JobStatus;
  priority: number;
  progress: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  duration: number | null;
  retryCount: number;
  maxRetries: number;
  errorMessage: string | null;
  triggeredBy: string;
}

export interface JobDetail extends OrchestratorJob {
  description: string;
  inputPayload: Record<string, unknown>;
  outputPayload: Record<string, unknown> | null;
  logs: JobLogEntry[];
  steps: JobStep[];
  dependencies: string[];
}

export interface JobLogEntry {
  timestamp: string;
  level: 'Debug' | 'Info' | 'Warning' | 'Error';
  message: string;
  source: string;
}

export interface JobStep {
  name: string;
  status: JobStatus;
  startedAt: string | null;
  completedAt: string | null;
  duration: number | null;
  errorMessage: string | null;
}

export interface OrchestratedService {
  id: string;
  name: string;
  version: string;
  state: ServiceState;
  instanceCount: number;
  desiredInstances: number;
  cpuPercent: number;
  memoryMb: number;
  uptimeSeconds: number;
  lastHealthCheck: string;
  endpoint: string;
}

export interface Deployment {
  id: string;
  serviceName: string;
  version: string;
  previousVersion: string | null;
  status: DeploymentStatus;
  initiatedBy: string;
  startedAt: string;
  completedAt: string | null;
  rollbackAvailable: boolean;
  changelog: string;
}

export interface JobListResponse {
  items: OrchestratorJob[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OrchestratorDashboard {
  queueDepth: number;
  runningJobs: number;
  failedLast24h: number;
  avgDurationSeconds: number;
  serviceCount: number;
  healthyServices: number;
  pendingDeployments: number;
}

// ---- SignalR live event ----
export interface OrchestratorEvent {
  type: 'JobUpdate' | 'ServiceUpdate' | 'DeploymentUpdate' | 'Alert';
  payload: Record<string, unknown>;
  timestamp: string;
}

// ---------- Service ----------

const API_BASE = '/api/admin/orchestrator';
const JOBS_API = `${API_BASE}/jobs`;
const SERVICES_API = `${API_BASE}/services`;
const DEPLOYMENTS_API = `${API_BASE}/deployments`;
const HUB_URL = '/hubs/orchestrator';

@Injectable({ providedIn: 'root' })
export class OrchestratorService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);

  // ---- SignalR ----
  private hubConnection: unknown = null;
  private readonly liveEvents$ = new Subject<OrchestratorEvent>();
  readonly events$ = this.liveEvents$.asObservable();

  // ---- State signals ----
  readonly dashboard = signal<OrchestratorDashboard | null>(null);
  readonly jobs = signal<OrchestratorJob[]>([]);
  readonly selectedJob = signal<JobDetail | null>(null);
  readonly services = signal<OrchestratedService[]>([]);
  readonly deployments = signal<Deployment[]>([]);
  readonly loading = signal(false);
  readonly detailLoading = signal(false);
  readonly servicesLoading = signal(false);
  readonly deploymentsLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly totalJobs = signal(0);
  readonly hubConnected = signal(false);

  // ---- Computed ----
  readonly queuedJobs = computed(
    () => this.jobs().filter((j) => j.status === 'Queued').length,
  );
  readonly runningJobs = computed(
    () => this.jobs().filter((j) => j.status === 'Running').length,
  );
  readonly failedJobs = computed(
    () => this.jobs().filter((j) => j.status === 'Failed').length,
  );
  readonly healthyServiceCount = computed(
    () => this.services().filter((s) => s.state === 'Running').length,
  );
  readonly degradedServiceCount = computed(
    () => this.services().filter((s) => s.state === 'Degraded').length,
  );
  readonly pendingDeploymentCount = computed(
    () => this.deployments().filter((d) => d.status === 'Pending' || d.status === 'InProgress').length,
  );

  // ---- Dashboard ----
  loadDashboard(): void {
    this.http
      .get<OrchestratorDashboard>(`${API_BASE}/dashboard`)
      .pipe(
        tap((data) => this.dashboard.set(data)),
        catchError((err) => {
          this.error.set('Failed to load orchestrator dashboard.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  // ---- Jobs ----
  loadJobs(page = 1, pageSize = 25, statusFilter?: JobStatus, search?: string): void {
    this.loading.set(true);
    this.error.set(null);

    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (statusFilter) params = params.set('status', statusFilter);
    if (search) params = params.set('search', search);

    this.http
      .get<JobListResponse>(JOBS_API, { params })
      .pipe(
        tap((res) => {
          this.jobs.set(res.items);
          this.totalJobs.set(res.total);
        }),
        catchError((err) => {
          this.error.set('Failed to load jobs.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  loadJobDetail(id: string): void {
    this.detailLoading.set(true);
    this.http
      .get<JobDetail>(`${JOBS_API}/${id}`)
      .pipe(
        tap((detail) => this.selectedJob.set(detail)),
        catchError((err) => {
          this.error.set('Failed to load job details.');
          return throwError(() => err);
        }),
        finalize(() => this.detailLoading.set(false)),
      )
      .subscribe();
  }

  cancelJob(id: string): Observable<OrchestratorJob> {
    return this.http.post<OrchestratorJob>(`${JOBS_API}/${id}/cancel`, {}).pipe(
      tap((updated) => {
        this.jobs.update((list) =>
          list.map((j) => (j.id === id ? { ...j, status: updated.status } : j)),
        );
        if (this.selectedJob()?.id === id) {
          this.selectedJob.update((d) => (d ? { ...d, status: updated.status } : d));
        }
      }),
      catchError((err) => {
        this.error.set('Failed to cancel job.');
        return throwError(() => err);
      }),
    );
  }

  retryJob(id: string): Observable<OrchestratorJob> {
    return this.http.post<OrchestratorJob>(`${JOBS_API}/${id}/retry`, {}).pipe(
      tap((updated) => {
        this.jobs.update((list) =>
          list.map((j) => (j.id === id ? { ...j, status: updated.status, retryCount: updated.retryCount } : j)),
        );
        if (this.selectedJob()?.id === id) {
          this.selectedJob.update((d) => (d ? { ...d, status: updated.status, retryCount: updated.retryCount } : d));
        }
      }),
      catchError((err) => {
        this.error.set('Failed to retry job.');
        return throwError(() => err);
      }),
    );
  }

  // ---- Services ----
  loadServices(): void {
    this.servicesLoading.set(true);
    this.http
      .get<OrchestratedService[]>(SERVICES_API)
      .pipe(
        tap((data) => this.services.set(data)),
        catchError((err) => {
          this.error.set('Failed to load services.');
          return throwError(() => err);
        }),
        finalize(() => this.servicesLoading.set(false)),
      )
      .subscribe();
  }

  restartService(id: string): Observable<OrchestratedService> {
    return this.http.post<OrchestratedService>(`${SERVICES_API}/${id}/restart`, {}).pipe(
      tap((updated) => {
        this.services.update((list) =>
          list.map((s) => (s.id === id ? updated : s)),
        );
      }),
      catchError((err) => {
        this.error.set('Failed to restart service.');
        return throwError(() => err);
      }),
    );
  }

  scaleService(id: string, instances: number): Observable<OrchestratedService> {
    return this.http.post<OrchestratedService>(`${SERVICES_API}/${id}/scale`, { instances }).pipe(
      tap((updated) => {
        this.services.update((list) =>
          list.map((s) => (s.id === id ? updated : s)),
        );
      }),
      catchError((err) => {
        this.error.set('Failed to scale service.');
        return throwError(() => err);
      }),
    );
  }

  // ---- Deployments ----
  loadDeployments(): void {
    this.deploymentsLoading.set(true);
    this.http
      .get<Deployment[]>(DEPLOYMENTS_API)
      .pipe(
        tap((data) => this.deployments.set(data)),
        catchError((err) => {
          this.error.set('Failed to load deployments.');
          return throwError(() => err);
        }),
        finalize(() => this.deploymentsLoading.set(false)),
      )
      .subscribe();
  }

  rollbackDeployment(id: string): Observable<Deployment> {
    return this.http.post<Deployment>(`${DEPLOYMENTS_API}/${id}/rollback`, {}).pipe(
      tap((updated) => {
        this.deployments.update((list) =>
          list.map((d) => (d.id === id ? updated : d)),
        );
      }),
      catchError((err) => {
        this.error.set('Failed to rollback deployment.');
        return throwError(() => err);
      }),
    );
  }

  // ---- SignalR Hub ----
  async connectHub(): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || this.hubConnection) return;

    try {
      const signalR = await import('@microsoft/signalr');
      const connection = new signalR.HubConnectionBuilder()
        .withUrl(HUB_URL)
        .withAutomaticReconnect()
        .build();

      connection.on('JobUpdated', (event: OrchestratorEvent) => {
        this.liveEvents$.next(event);
        this.handleJobEvent(event);
      });

      connection.on('ServiceUpdated', (event: OrchestratorEvent) => {
        this.liveEvents$.next(event);
      });

      connection.on('DeploymentUpdated', (event: OrchestratorEvent) => {
        this.liveEvents$.next(event);
      });

      connection.on('OrchestratorAlert', (event: OrchestratorEvent) => {
        this.liveEvents$.next(event);
      });

      connection.onreconnecting(() => this.hubConnected.set(false));
      connection.onreconnected(() => this.hubConnected.set(true));
      connection.onclose(() => this.hubConnected.set(false));

      await connection.start();
      this.hubConnection = connection;
      this.hubConnected.set(true);
    } catch {
      this.hubConnected.set(false);
    }
  }

  async disconnectHub(): Promise<void> {
    if (this.hubConnection) {
      await (this.hubConnection as { stop(): Promise<void> }).stop();
      this.hubConnection = null;
      this.hubConnected.set(false);
    }
  }

  private handleJobEvent(event: OrchestratorEvent): void {
    const payload = event.payload as { id?: string; status?: JobStatus; progress?: number };
    if (!payload.id) return;

    this.jobs.update((list) =>
      list.map((j) =>
        j.id === payload.id
          ? { ...j, ...(payload.status ? { status: payload.status } : {}), ...(payload.progress !== undefined ? { progress: payload.progress } : {}) }
          : j,
      ),
    );
  }

  // ---- Utility ----
  clearSelection(): void {
    this.selectedJob.set(null);
  }

  clearError(): void {
    this.error.set(null);
  }

  ngOnDestroy(): void {
    this.disconnectHub();
    this.liveEvents$.complete();
  }
}
