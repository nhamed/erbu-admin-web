import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuditCaptureConfig, CaptureMode } from '@erbu-admin-web/shared/models';
import { AuditService, UpdateCaptureConfigRequest } from '../audit.service';

@Component({
  selector: 'app-capture-modes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatCardModule,
    MatCheckboxModule,
    MatSnackBarModule,
  ],
  templateUrl: './capture-modes.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host {
      display: block;
      padding: 16px;
    }

    .toolbar {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-bottom: 16px;
    }

    .configs-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
      gap: 16px;
    }

    .config-card {
      border: 1px solid rgba(0, 0, 0, 0.12);
      border-radius: 12px;
      padding: 20px;
    }

    .config-card.disabled {
      opacity: 0.5;
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .mode-badge {
      font-size: 12px;
      font-weight: 600;
      padding: 4px 12px;
      border-radius: 12px;
      text-transform: uppercase;
    }

    .mode-off { background: #e0e0e0; color: #616161; }
    .mode-passive { background: #e3f2fd; color: #1565c0; }
    .mode-active { background: #e8f5e9; color: #2e7d32; }
    .mode-full { background: #fff3e0; color: #e65100; }

    .card-header .spacer { flex: 1; }

    .form-section {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .form-row {
      display: flex;
      gap: 16px;
      align-items: center;
    }

    .form-row mat-form-field {
      flex: 1;
    }

    .checkboxes-row {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      padding: 8px 0;
    }

    .card-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 16px;
      padding-top: 12px;
      border-top: 1px solid rgba(0, 0, 0, 0.08);
    }

    .updated-info {
      font-size: 12px;
      color: rgba(0, 0, 0, 0.54);
    }

    .loading-overlay {
      display: flex;
      justify-content: center;
      padding: 48px;
    }

    .empty-state {
      text-align: center;
      padding: 48px;
      color: rgba(0, 0, 0, 0.38);
    }

    .empty-state mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      margin-bottom: 16px;
    }
  `],
})
export class CaptureModesComponent implements OnInit {
  private readonly auditService = inject(AuditService);
  private readonly snackBar = inject(MatSnackBar);

  readonly configs = signal<AuditCaptureConfig[]>([]);
  readonly isLoading = signal(false);
  readonly savingId = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  readonly captureModeOptions = Object.values(CaptureMode);

  ngOnInit(): void {
    this.loadConfigs();
  }

  loadConfigs(): void {
    this.isLoading.set(true);
    this.error.set(null);
    this.auditService.getCaptureConfig().subscribe({
      next: data => {
        this.configs.set(data);
        this.isLoading.set(false);
      },
      error: err => {
        this.error.set(err?.message ?? 'Failed to load capture configs');
        this.isLoading.set(false);
      },
    });
  }

  saveConfig(config: AuditCaptureConfig): void {
    this.savingId.set(config.id);
    const request: UpdateCaptureConfigRequest = {
      mode: config.mode,
      isEnabled: config.isEnabled,
      filterPattern: config.filterPattern,
      scheduleExpression: config.scheduleExpression,
      retentionDays: config.retentionDays,
      maxSnapshotsPerRun: config.maxSnapshotsPerRun,
      captureHeaders: config.captureHeaders,
      capturePayloads: config.capturePayloads,
      captureTimings: config.captureTimings,
    };

    this.auditService.updateCaptureConfig(config.id, request).subscribe({
      next: updated => {
        this.configs.update(list =>
          list.map(c => (c.id === updated.id ? updated : c)),
        );
        this.savingId.set(null);
        this.snackBar.open('Configuration saved', 'OK', { duration: 3000 });
      },
      error: err => {
        this.savingId.set(null);
        this.snackBar.open(err?.message ?? 'Failed to save', 'Dismiss', { duration: 5000 });
      },
    });
  }

  getModeClass(mode: CaptureMode): string {
    return 'mode-' + mode.toLowerCase();
  }

  updateConfigField<K extends keyof AuditCaptureConfig>(
    config: AuditCaptureConfig,
    field: K,
    value: AuditCaptureConfig[K],
  ): void {
    this.configs.update(list =>
      list.map(c => (c.id === config.id ? { ...c, [field]: value } : c)),
    );
  }
}
