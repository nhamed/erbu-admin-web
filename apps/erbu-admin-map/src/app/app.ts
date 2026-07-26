import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatSidenavModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
  ],
  selector: 'erbu-root',
  template: `
    <mat-toolbar color="primary" class="map-toolbar">
      <button mat-icon-button (click)="sidenavOpen = !sidenavOpen">
        <mat-icon>menu</mat-icon>
      </button>
      <span>Erbu Admin Map</span>
      <span class="spacer"></span>
    </mat-toolbar>
    <mat-sidenav-container class="map-sidenav-container">
      <mat-sidenav [opened]="sidenavOpen" mode="side" class="map-sidenav">
        <mat-nav-list>
          @for (link of navLinks; track link.path) {
            <a mat-list-item
               [routerLink]="link.path"
               routerLinkActive="active-link">
              <mat-icon matListItemIcon>{{ link.icon }}</mat-icon>
              <span>{{ link.label }}</span>
            </a>
          }
        </mat-nav-list>
      </mat-sidenav>
      <mat-sidenav-content>
        <router-outlet />
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [`
    .map-toolbar { position: fixed; top: 0; z-index: 1000; }
    .spacer { flex: 1 1 auto; }
    .map-sidenav-container { position: absolute; top: 64px; bottom: 0; left: 0; right: 0; }
    .map-sidenav { width: 240px; }
    .active-link { background: rgba(255,255,255,0.1); }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  sidenavOpen = true;

  readonly navLinks = [
    { path: 'map', label: 'Live Map', icon: 'map' },
    { path: 'drivers', label: 'Drivers', icon: 'person' },
    { path: 'riders', label: 'Riders', icon: 'hail' },
    { path: 'payments', label: 'Payments', icon: 'payments' },
    { path: 'marketplace', label: 'Marketplace', icon: 'store' },
    { path: 'driver-monitor', label: 'Driver Monitor', icon: 'monitor_heart' },
    { path: 'reputation', label: 'Reputation', icon: 'stars' },
    { path: 'auth-management', label: 'Auth', icon: 'security' },
    { path: 'support', label: 'Support', icon: 'support_agent' },
    { path: 'alerts', label: 'Alerts', icon: 'notifications' },
    { path: 'orchestrator', label: 'Orchestrator', icon: 'hub' },
    { path: 'services', label: 'Services', icon: 'dns' },
    { path: 'infrastructure', label: 'Infrastructure', icon: 'cloud' },
    { path: 'pricing', label: 'Pricing', icon: 'attach_money' },
    { path: 'trips', label: 'Trips', icon: 'directions_car' },
    { path: 'database', label: 'Database', icon: 'storage' },
    { path: 'redis', label: 'Redis', icon: 'memory' },
    { path: 'minio', label: 'MinIO', icon: 'cloud_upload' },
    { path: 'observability', label: 'Observability', icon: 'insights' },
    { path: 'traces', label: 'Traces', icon: 'timeline' },
    { path: 'env-backup', label: 'Env Backup', icon: 'backup' },
    { path: 'geostudio', label: 'GeoStudio', icon: 'explore' },
  ];
}
