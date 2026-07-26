import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuditTunnel, TunnelState } from '@erbu-admin-web/shared/models';

export interface OpenTunnelRequest {
  name: string;
  localPort: number;
  remoteHost: string;
  remotePort: number;
}

@Injectable({ providedIn: 'root' })
export class AuditTunnelService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/devtools/tunnels';

  listTunnels(): Observable<AuditTunnel[]> {
    return this.http.get<AuditTunnel[]>(this.baseUrl);
  }

  openTunnel(request: OpenTunnelRequest): Observable<AuditTunnel> {
    return this.http.post<AuditTunnel>(this.baseUrl, request);
  }

  closeTunnel(tunnelId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${tunnelId}`);
  }

  getTunnelStatus(tunnelId: string): Observable<{ state: TunnelState; bytesTransferred: number }> {
    return this.http.get<{ state: TunnelState; bytesTransferred: number }>(
      `${this.baseUrl}/${tunnelId}/status`,
    );
  }
}
