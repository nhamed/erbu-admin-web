import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  inject,
  signal,
  computed,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { AlarmRule, AlarmCondition, AlarmSeverity } from '@erbu-admin-web/shared/models';
import { MarketplaceService, AlarmRuleFormData } from '../marketplace.service';

@Component({
  selector: 'app-alarm-engine-tab',
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
    MatInputModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatSlideToggleModule,
    MatMenuModule,
    MatSnackBarModule,
  ],
  templateUrl: './alarm-engine.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlarmEngineComponent implements OnInit {
  readonly svc = inject(MarketplaceService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly snackBar = inject(MatSnackBar);

  // ── Form state ───────────────────────────────────────────────
  readonly showForm = signal(false);
  readonly editingRule = signal<AlarmRule | null>(null);
  readonly saving = signal(false);

  // ── Form fields ──────────────────────────────────────────────
  readonly formName = signal('');
  readonly formDescription = signal('');
  readonly formMetric = signal('');
  readonly formCondition = signal<AlarmCondition>(AlarmCondition.GreaterThan);
  readonly formThreshold = signal(0);
  readonly formEvalPeriod = signal(5);
  readonly formConsecutiveBreaches = signal(1);
  readonly formSeverity = signal<AlarmSeverity>(AlarmSeverity.Warning);
  readonly formEnabled = signal(true);
  readonly formChannels = signal('');

  // ── Dropdown options ─────────────────────────────────────────
  readonly conditionOptions = Object.values(AlarmCondition);
  readonly severityOptions = Object.values(AlarmSeverity);

  readonly metricOptions: string[] = [
    'marketplace.wait_time_avg',
    'marketplace.surge_multiplier_max',
    'marketplace.supply_demand_ratio',
    'marketplace.cancellation_rate',
    'marketplace.fulfillment_rate',
    'marketplace.bid_count_per_auction',
    'marketplace.driver_disconnect_rate',
    'marketplace.reservation_no_show_rate',
    'marketplace.avg_driver_eta',
    'marketplace.payment_failure_rate',
  ];

  // ── Table config ─────────────────────────────────────────────
  readonly displayedColumns: string[] = [
    'isInAlarm',
    'name',
    'metric',
    'condition',
    'severity',
    'currentValue',
    'lastEvaluatedAt',
    'isEnabled',
    'actions',
  ];

  // ── Lifecycle ────────────────────────────────────────────────
  ngOnInit(): void {
    this.svc.loadAlarmRules();
  }

  // ── Form actions ─────────────────────────────────────────────
  openCreateForm(): void {
    this.resetForm();
    this.editingRule.set(null);
    this.showForm.set(true);
  }

  openEditForm(rule: AlarmRule): void {
    this.editingRule.set(rule);
    this.formName.set(rule.name);
    this.formDescription.set(rule.description);
    this.formMetric.set(rule.metric);
    this.formCondition.set(rule.condition);
    this.formThreshold.set(rule.threshold);
    this.formEvalPeriod.set(rule.evaluationPeriodMinutes);
    this.formConsecutiveBreaches.set(rule.consecutiveBreaches);
    this.formSeverity.set(rule.severity);
    this.formEnabled.set(rule.isEnabled);
    this.formChannels.set(rule.notificationChannels.join(', '));
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.editingRule.set(null);
  }

  submitForm(): void {
    const data: AlarmRuleFormData = {
      name: this.formName(),
      description: this.formDescription(),
      metric: this.formMetric(),
      condition: this.formCondition(),
      threshold: this.formThreshold(),
      evaluationPeriodMinutes: this.formEvalPeriod(),
      consecutiveBreaches: this.formConsecutiveBreaches(),
      severity: this.formSeverity(),
      isEnabled: this.formEnabled(),
      notificationChannels: this.formChannels()
        .split(',')
        .map(c => c.trim())
        .filter(c => c.length > 0),
    };

    this.saving.set(true);
    const editing = this.editingRule();

    const op$ = editing
      ? this.svc.updateAlarmRule(editing.id, data)
      : this.svc.createAlarmRule(data);

    op$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.showForm.set(false);
        this.editingRule.set(null);
        this.snackBar.open(
          editing ? 'Alarm rule updated' : 'Alarm rule created',
          'OK',
          { duration: 3000 },
        );
        this.svc.loadAlarmRules();
      },
      error: () => {
        this.saving.set(false);
        this.snackBar.open('Failed to save alarm rule', 'Dismiss', { duration: 5000 });
      },
    });
  }

  // ── Rule actions ─────────────────────────────────────────────
  toggleRule(rule: AlarmRule): void {
    this.svc
      .toggleAlarmRule(rule.id, !rule.isEnabled)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () =>
          this.snackBar.open(
            `Rule "${rule.name}" ${rule.isEnabled ? 'disabled' : 'enabled'}`,
            'OK',
            { duration: 3000 },
          ),
        error: () =>
          this.snackBar.open('Failed to toggle rule', 'Dismiss', { duration: 5000 }),
      });
  }

  deleteRule(rule: AlarmRule): void {
    if (!confirm(`Delete alarm rule "${rule.name}"?`)) return;

    this.svc
      .deleteAlarmRule(rule.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.snackBar.open('Rule deleted', 'OK', { duration: 3000 }),
        error: () =>
          this.snackBar.open('Failed to delete rule', 'Dismiss', { duration: 5000 }),
      });
  }

  // ── Helpers ──────────────────────────────────────────────────
  severityClass(severity: AlarmSeverity): string {
    switch (severity) {
      case AlarmSeverity.Info:
        return 'severity-info';
      case AlarmSeverity.Warning:
        return 'severity-warning';
      case AlarmSeverity.Error:
        return 'severity-error';
      case AlarmSeverity.Critical:
        return 'severity-critical';
      default:
        return '';
    }
  }

  conditionDisplay(condition: AlarmCondition): string {
    switch (condition) {
      case AlarmCondition.GreaterThan:
        return '>';
      case AlarmCondition.LessThan:
        return '<';
      case AlarmCondition.GreaterThanOrEqual:
        return '>=';
      case AlarmCondition.LessThanOrEqual:
        return '<=';
      case AlarmCondition.Equal:
        return '=';
      case AlarmCondition.NotEqual:
        return '!=';
      default:
        return condition;
    }
  }

  readonly isFormValid = computed(() =>
    !!(this.formName() && this.formMetric() && this.formThreshold() !== null),
  );

  trackById(_: number, rule: AlarmRule): string {
    return rule.id;
  }

  private resetForm(): void {
    this.formName.set('');
    this.formDescription.set('');
    this.formMetric.set('');
    this.formCondition.set(AlarmCondition.GreaterThan);
    this.formThreshold.set(0);
    this.formEvalPeriod.set(5);
    this.formConsecutiveBreaches.set(1);
    this.formSeverity.set(AlarmSeverity.Warning);
    this.formEnabled.set(true);
    this.formChannels.set('');
  }
}
