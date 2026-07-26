import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { DriverNetworkNode, SignalStrength } from '@erbu-admin-web/shared/models';
import { MarketplaceService } from '../marketplace.service';

const AUTO_REFRESH_MS = 15_000;

@Component({
  selector: 'app-driver-network-tab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './driver-network.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DriverNetworkComponent implements OnInit, OnDestroy {
  readonly svc = inject(MarketplaceService);
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  // ── Filters ──────────────────────────────────────────────────
  readonly signalFilter = signal<SignalStrength | ''>('');
  readonly tripFilter = signal<'all' | 'onTrip' | 'available'>('all');

  readonly signalOptions = Object.values(SignalStrength);

  // ── Filtered data ────────────────────────────────────────────
  readonly filteredNodes = computed(() => {
    let nodes = this.svc.networkNodes();
    const sig = this.signalFilter();
    const trip = this.tripFilter();

    if (sig) {
      nodes = nodes.filter(n => n.signalStrength === sig);
    }
    if (trip === 'onTrip') {
      nodes = nodes.filter(n => n.isOnTrip);
    } else if (trip === 'available') {
      nodes = nodes.filter(n => !n.isOnTrip && n.signalStrength !== SignalStrength.Disconnected);
    }
    return nodes;
  });

  // ── Table config ─────────────────────────────────────────────
  readonly displayedColumns: string[] = [
    'driverName',
    'vehicleType',
    'status',
    'signalStrength',
    'rating',
    'totalTripsToday',
    'earningsToday',
    'lastPingAt',
  ];

  // ── Lifecycle ────────────────────────────────────────────────
  ngOnInit(): void {
    this.svc.loadNetworkNodes();
    this.refreshTimer = setInterval(() => this.svc.loadNetworkNodes(), AUTO_REFRESH_MS);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // ── Actions ──────────────────────────────────────────────────
  onRefresh(): void {
    this.svc.loadNetworkNodes();
  }

  onSignalFilterChange(value: SignalStrength | ''): void {
    this.signalFilter.set(value);
  }

  onTripFilterChange(value: 'all' | 'onTrip' | 'available'): void {
    this.tripFilter.set(value);
  }

  // ── Helpers ──────────────────────────────────────────────────
  signalClass(strength: SignalStrength): string {
    switch (strength) {
      case SignalStrength.Excellent:
        return 'signal-excellent';
      case SignalStrength.Good:
        return 'signal-good';
      case SignalStrength.Fair:
        return 'signal-fair';
      case SignalStrength.Poor:
        return 'signal-poor';
      case SignalStrength.Disconnected:
        return 'signal-disconnected';
      default:
        return '';
    }
  }

  signalIcon(strength: SignalStrength): string {
    switch (strength) {
      case SignalStrength.Excellent:
        return 'signal_wifi_4_bar';
      case SignalStrength.Good:
        return 'network_wifi_3_bar';
      case SignalStrength.Fair:
        return 'network_wifi_2_bar';
      case SignalStrength.Poor:
        return 'network_wifi_1_bar';
      case SignalStrength.Disconnected:
        return 'signal_wifi_off';
      default:
        return 'wifi';
    }
  }

  trackByDriverId(_: number, node: DriverNetworkNode): string {
    return node.driverId;
  }
}
