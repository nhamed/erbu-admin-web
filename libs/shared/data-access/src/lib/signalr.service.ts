import { Injectable, inject, OnDestroy } from '@angular/core';
import { Subject, Observable, filter, map } from 'rxjs';
import {
  HubConnectionBuilder,
  HubConnection,
  HubConnectionState,
  LogLevel,
  HttpTransportType,
} from '@microsoft/signalr';
import { AuthService } from './auth.service';
import { Environment } from './environment';

export interface HubMessage<T = unknown> {
  method: string;
  args: T;
}

@Injectable({ providedIn: 'root' })
export class SignalRService implements OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly environment = inject<Environment>('ENVIRONMENT' as never);

  private readonly connections = new Map<string, HubConnection>();
  private readonly message$ = new Subject<HubMessage>();
  private readonly connectionState$ = new Subject<{ hubUrl: string; state: HubConnectionState }>();
  private reconnectAttempts = new Map<string, number>();

  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelays = [0, 1000, 2000, 5000, 10_000, 15_000, 30_000];

  async connectHub(hubPath: string): Promise<HubConnection> {
    const fullUrl = `${this.environment.gatewayUrl}${hubPath}`;

    const existing = this.connections.get(hubPath);
    if (existing?.state === HubConnectionState.Connected) {
      return existing;
    }

    if (existing) {
      await this.disconnectHub(hubPath);
    }

    const connection = new HubConnectionBuilder()
      .withUrl(fullUrl, {
        accessTokenFactory: () => this.authService.getToken() ?? '',
        transport: HttpTransportType.WebSockets | HttpTransportType.ServerSentEvents,
        withCredentials: true,
      })
      .withAutomaticReconnect(this.reconnectDelays)
      .configureLogging(this.environment.production ? LogLevel.Warning : LogLevel.Information)
      .build();

    connection.onreconnecting(() => {
      this.connectionState$.next({ hubUrl: hubPath, state: HubConnectionState.Reconnecting });
    });

    connection.onreconnected(() => {
      this.reconnectAttempts.set(hubPath, 0);
      this.connectionState$.next({ hubUrl: hubPath, state: HubConnectionState.Connected });
    });

    connection.onclose(() => {
      this.connectionState$.next({ hubUrl: hubPath, state: HubConnectionState.Disconnected });
      this.handleDisconnection(hubPath);
    });

    this.connections.set(hubPath, connection);

    try {
      await connection.start();
      this.reconnectAttempts.set(hubPath, 0);
      this.connectionState$.next({ hubUrl: hubPath, state: HubConnectionState.Connected });
    } catch (err) {
      this.connectionState$.next({ hubUrl: hubPath, state: HubConnectionState.Disconnected });
      this.handleDisconnection(hubPath);
      throw err;
    }

    return connection;
  }

  on<T>(method: string): Observable<T> {
    return this.message$.pipe(
      filter((msg) => msg.method === method),
      map((msg) => msg.args as T),
    );
  }

  registerHandler(hubPath: string, method: string): void {
    const connection = this.connections.get(hubPath);
    if (!connection) {
      throw new Error(`No connection found for hub: ${hubPath}`);
    }

    connection.on(method, (...args: unknown[]) => {
      this.message$.next({ method, args: args.length === 1 ? args[0] : args });
    });
  }

  async invoke<T = void>(hubPath: string, method: string, ...args: unknown[]): Promise<T> {
    const connection = this.connections.get(hubPath);
    if (!connection || connection.state !== HubConnectionState.Connected) {
      throw new Error(`Hub ${hubPath} is not connected`);
    }

    return connection.invoke<T>(method, ...args);
  }

  async disconnectHub(hubPath: string): Promise<void> {
    const connection = this.connections.get(hubPath);
    if (connection) {
      try {
        await connection.stop();
      } finally {
        this.connections.delete(hubPath);
        this.reconnectAttempts.delete(hubPath);
      }
    }
  }

  async disconnectAll(): Promise<void> {
    const paths = Array.from(this.connections.keys());
    await Promise.allSettled(paths.map((p) => this.disconnectHub(p)));
  }

  getConnectionState(hubPath: string): HubConnectionState {
    const connection = this.connections.get(hubPath);
    return connection?.state ?? HubConnectionState.Disconnected;
  }

  onConnectionState(hubPath: string): Observable<HubConnectionState> {
    return this.connectionState$.pipe(
      filter((e) => e.hubUrl === hubPath),
      map((e) => e.state),
    );
  }

  async connectSecureHub(): Promise<HubConnection> {
    return this.connectHub(this.environment.signalrHubs.secure);
  }

  async connectVoipHub(): Promise<HubConnection> {
    return this.connectHub(this.environment.signalrHubs.voip);
  }

  async connectOrchestratorHub(): Promise<HubConnection> {
    return this.connectHub(this.environment.signalrHubs.orchestrator);
  }

  async connectIngestionHub(): Promise<HubConnection> {
    return this.connectHub(this.environment.signalrHubs.ingestion);
  }

  async connectSearchOpsHub(): Promise<HubConnection> {
    return this.connectHub(this.environment.signalrHubs.searchOps);
  }

  private async handleDisconnection(hubPath: string): Promise<void> {
    const attempts = this.reconnectAttempts.get(hubPath) ?? 0;
    if (attempts >= this.maxReconnectAttempts) {
      this.connections.delete(hubPath);
      this.reconnectAttempts.delete(hubPath);
      return;
    }

    this.reconnectAttempts.set(hubPath, attempts + 1);
    const delay = this.reconnectDelays[Math.min(attempts, this.reconnectDelays.length - 1)];

    await new Promise((resolve) => setTimeout(resolve, delay));

    try {
      await this.connectHub(hubPath);
    } catch {
      // Reconnection attempt failed; the next onclose will trigger another retry
    }
  }

  ngOnDestroy(): void {
    this.disconnectAll();
    this.message$.complete();
    this.connectionState$.complete();
  }
}
