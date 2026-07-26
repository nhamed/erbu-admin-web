import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { ScenarioRunsComponent } from './sub-tabs/scenario-runs.component';
import { DiscrepanciesComponent } from './sub-tabs/discrepancies.component';
import { MissionControlComponent } from './sub-tabs/mission-control.component';
import { CaptureModesComponent } from './sub-tabs/capture-modes.component';
import { BaselinesComponent } from './sub-tabs/baselines.component';

@Component({
  selector: 'app-audit-tab',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatIconModule,
    MatBadgeModule,
    ScenarioRunsComponent,
    DiscrepanciesComponent,
    MissionControlComponent,
    CaptureModesComponent,
    BaselinesComponent,
  ],
  templateUrl: './audit-tab.page.html',
  styleUrl: './audit-tab.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditTabPage {
  readonly selectedTabIndex = signal(0);

  onTabChange(index: number): void {
    this.selectedTabIndex.set(index);
  }
}
