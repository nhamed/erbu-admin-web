import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AppShellComponent } from '@erbu-admin-web/shared/ui';

interface CockpitTab {
  path: string;
  label: string;
  icon: string;
  testId: string;
}

@Component({
  selector: 'erbu-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatToolbarModule,
    MatTabsModule,
    MatIconModule,
    MatButtonModule,
    AppShellComponent,
  ],
  template: `
    <erbu-app-shell appTitle="Erbu Ops Cockpit" [showSidenav]="false">
      <nav mat-tab-nav-bar [tabPanel]="tabPanel" class="cockpit-tab-nav">
        @for (tab of tabs; track tab.path) {
          <a mat-tab-link
             [routerLink]="tab.path"
             routerLinkActive
             #rla="routerLinkActive"
             [active]="rla.isActive"
             [attr.data-testid]="tab.testId">
            <mat-icon class="tab-icon">{{ tab.icon }}</mat-icon>
            {{ tab.label }}
          </a>
        }
      </nav>

      <div mat-tab-nav-panel #tabPanel class="cockpit-content">
        <router-outlet />
      </div>
    </erbu-app-shell>
  `,
  styles: [`
    .cockpit-tab-nav {
      background: var(--erbu-bg-surface, #1e1e1e);
      border-bottom: 1px solid var(--erbu-border, #333);
    }

    .tab-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      margin-right: 6px;
      vertical-align: middle;
    }

    .cockpit-content {
      padding: 16px;
      height: calc(100vh - 112px);
      overflow: auto;
    }

  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  readonly title = 'Erbu Ops Cockpit';

  readonly tabs: CockpitTab[] = [
    { path: 'smoke',            label: 'Smoke',            icon: 'local_fire_department', testId: 'WEB-CPT-001' },
    { path: 'pipelines',        label: 'Pipelines',        icon: 'account_tree',          testId: 'WEB-CPT-002' },
    { path: 'stories',          label: 'Stories',           icon: 'auto_stories',          testId: 'WEB-CPT-003' },
    { path: 'planner',          label: 'Planner',           icon: 'calendar_month',        testId: 'WEB-CPT-004' },
    { path: 'audit',            label: 'Audit',             icon: 'policy',                testId: 'WEB-CPT-005' },
    { path: 'trip-health',      label: 'Trip Health',       icon: 'monitor_heart',         testId: 'WEB-CPT-006' },
    { path: 'chaos',            label: 'Chaos',             icon: 'science',               testId: 'WEB-CPT-007' },
    { path: 'e2e',              label: 'E2E',               icon: 'integration_instructions', testId: 'WEB-CPT-008' },
    { path: 'coverage',         label: 'Coverage',          icon: 'pie_chart',             testId: 'WEB-CPT-009' },
    { path: 'instances',        label: 'Instances',         icon: 'devices',               testId: 'WEB-CPT-010' },
    { path: 'mobile',           label: 'Mobile',            icon: 'smartphone',            testId: 'WEB-CPT-011' },
    { path: 'reports',          label: 'Reports',           icon: 'summarize',             testId: 'WEB-CPT-012' },
    { path: 'replay-diff',      label: 'ReplayDiff',        icon: 'difference',            testId: 'WEB-CPT-013' },
    { path: 'scenario-builder', label: 'Scenario Builder',  icon: 'construction',          testId: 'WEB-CPT-014' },
  ];
}
