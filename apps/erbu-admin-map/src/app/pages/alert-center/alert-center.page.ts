import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
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
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';

import {
  AlertCenterService,
  Alert,
  CrashAlertDetail,
  AlertSeverity,
  AlertStatus,
  AlertSource,
  AlertRule,
  NotificationPreferences,
} from './alert-center.service';

@Component({
  selector: 'app-alert-center',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTabsModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatCheckboxModule,
    MatBadgeModule,
    MatDividerModule,
  ],
  templateUrl: './alert-center.page.html',
  styleUrl: './alert-center.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertCenterPage implements OnInit {
  protected readonly svc = inject(AlertCenterService);

  // ---- Local UI state ----
  readonly activeTab = signal<'feed' | 'rules' | 'preferences'>('feed');
  readonly severityFilter = signal<AlertSeverity | ''>('');
  readonly statusFilter = signal<AlertStatus | ''>('');
  readonly sourceFilter = signal<AlertSource | ''>('');
  readonly currentPage = signal(1);
  readonly pageSize = signal(50);

  // ---- Filter options ----
  readonly severities: AlertSeverity[] = ['Info', 'Warning', 'Error', 'Critical'];
  readonly alertStatuses: AlertStatus[] = ['Active', 'Acknowledged', 'Dismissed', 'Resolved'];
  readonly sources: AlertSource[] = [
    'System',
    'CrashDetection',
    'DriverService',
    'PaymentService',
    'TripService',
    'Orchestrator',
    'Infrastructure',
  ];

  // ---- Alert feed columns ----
  readonly alertColumns: string[] = [
    'severity',
    'title',
    'source',
    'status',
    'createdAt',
    'actions',
  ];

  // ---- Rules columns ----
  readonly rulesColumns: string[] = [
    'name',
    'severity',
    'source',
    'condition',
    'enabled',
    'actions',
  ];

  // ---- Computed KPIs ----
  readonly kpiCards = computed(() => [
    {
      label: 'Active Alerts',
      value: this.svc.activeAlerts(),
      icon: 'notifications_active',
      variant: 'warning',
    },
    {
      label: 'Critical',
      value: this.svc.criticalAlerts(),
      icon: 'report',
      variant: 'danger',
    },
    {
      label: 'Acknowledged',
      value: this.svc.acknowledgedAlerts(),
      icon: 'done',
      variant: 'info',
    },
    {
      label: 'Active Rules',
      value: this.svc.enabledRules(),
      icon: 'rule',
      variant: 'neutral',
    },
  ]);

  // ---- Crash alert detection ----
  readonly isCrashAlert = computed(() => {
    const selected = this.svc.selectedAlert();
    return selected !== null && 'deviceId' in selected;
  });

  readonly crashDetail = computed(() => {
    const selected = this.svc.selectedAlert();
    return selected && 'deviceId' in selected ? selected as CrashAlertDetail : null;
  });

  // ---- Lifecycle ----
  ngOnInit(): void {
    this.loadAlerts();
    this.svc.loadRules();
    this.svc.loadPreferences();
  }

  // ---- Tab switching ----
  onTabChange(index: number): void {
    const tabs: Array<'feed' | 'rules' | 'preferences'> = ['feed', 'rules', 'preferences'];
    this.activeTab.set(tabs[index] ?? 'feed');
  }

  // ---- Feed actions ----
  onSeverityChange(severity: AlertSeverity | ''): void {
    this.severityFilter.set(severity);
    this.currentPage.set(1);
    this.loadAlerts();
  }

  onStatusChange(status: AlertStatus | ''): void {
    this.statusFilter.set(status);
    this.currentPage.set(1);
    this.loadAlerts();
  }

  onSourceChange(source: AlertSource | ''): void {
    this.sourceFilter.set(source);
    this.currentPage.set(1);
    this.loadAlerts();
  }

  onSelectAlert(alert: Alert): void {
    this.svc.loadAlertDetail(alert.id);
  }

  onCloseDetail(): void {
    this.svc.clearSelection();
  }

  onAcknowledge(alert: Alert): void {
    this.svc.acknowledgeAlert(alert.id).subscribe();
  }

  onDismiss(alert: Alert): void {
    this.svc.dismissAlert(alert.id).subscribe();
  }

  onResolve(alert: Alert, resolution: string): void {
    if (!resolution.trim()) return;
    this.svc.resolveAlert(alert.id, resolution).subscribe();
  }

  // ---- Rules actions ----
  onToggleRule(rule: AlertRule): void {
    this.svc.toggleRule(rule.id, !rule.enabled).subscribe();
  }

  onDeleteRule(rule: AlertRule): void {
    this.svc.deleteRule(rule.id).subscribe();
  }

  // ---- Preferences ----
  onSavePreferences(prefs: NotificationPreferences): void {
    this.svc.updatePreferences(prefs).subscribe();
  }

  // ---- Helpers ----
  severityClass(severity: AlertSeverity): string {
    switch (severity) {
      case 'Info':
        return 'severity-info';
      case 'Warning':
        return 'severity-warning';
      case 'Error':
        return 'severity-error';
      case 'Critical':
        return 'severity-critical';
      default:
        return '';
    }
  }

  severityIcon(severity: AlertSeverity): string {
    switch (severity) {
      case 'Info':
        return 'info';
      case 'Warning':
        return 'warning';
      case 'Error':
        return 'error';
      case 'Critical':
        return 'report';
      default:
        return 'help';
    }
  }

  alertStatusClass(status: AlertStatus): string {
    switch (status) {
      case 'Active':
        return 'alert-active';
      case 'Acknowledged':
        return 'alert-acknowledged';
      case 'Dismissed':
        return 'alert-dismissed';
      case 'Resolved':
        return 'alert-resolved';
      default:
        return '';
    }
  }

  trackByAlertId(_: number, alert: Alert): string {
    return alert.id;
  }

  trackByRuleId(_: number, rule: AlertRule): string {
    return rule.id;
  }

  // ---- Private ----
  private loadAlerts(): void {
    const severity = this.severityFilter();
    const status = this.statusFilter();
    const source = this.sourceFilter();
    this.svc.loadAlerts(
      this.currentPage(),
      this.pageSize(),
      severity || undefined,
      status || undefined,
      source || undefined,
    );
  }
}
