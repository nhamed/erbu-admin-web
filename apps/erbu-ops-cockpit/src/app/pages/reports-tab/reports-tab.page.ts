import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import {
  ReportsService,
  ReportItem,
  ReportFormat,
  ReportType,
  ReportStatus,
  ScheduledReport,
} from './reports.service';

@Component({
  selector: 'app-reports-tab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    MatChipsModule,
    MatSlideToggleModule,
    MatTooltipModule,
    MatSnackBarModule,
  ],
  templateUrl: './reports-tab.page.html',
  styleUrl: './reports-tab.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsTabPage implements OnInit {
  protected readonly svc = inject(ReportsService);
  private readonly snack = inject(MatSnackBar);

  // ── Table config ───────────────────────────────────────────
  readonly displayedColumns = [
    'name',
    'type',
    'format',
    'status',
    'createdAt',
    'actions',
  ];

  // ── Generate form state ────────────────────────────────────
  readonly reportTypes: ReportType[] = [
    'TripSummary',
    'Revenue',
    'DriverPerformance',
    'RiderActivity',
    'Incidents',
    'SLA',
    'Custom',
  ];
  readonly formats: ReportFormat[] = ['PDF', 'CSV', 'JSON'];

  readonly genName = signal('');
  readonly genType = signal<ReportType>('TripSummary');
  readonly genFormat = signal<ReportFormat>('PDF');
  readonly genDateFrom = signal('');
  readonly genDateTo = signal('');
  readonly showGenerateForm = signal(false);

  // ── Filter ─────────────────────────────────────────────────
  readonly typeFilter = signal<ReportType | ''>('');

  // ── Preview ────────────────────────────────────────────────
  readonly previewReport = signal<ReportItem | null>(null);

  // ── Schedule form state ────────────────────────────────────
  readonly showSchedulePanel = signal(false);

  // ── Computed ───────────────────────────────────────────────
  readonly canGenerate = computed(
    () =>
      this.genName().trim().length > 0 &&
      this.genDateFrom().length > 0 &&
      this.genDateTo().length > 0 &&
      !this.svc.generating(),
  );

  ngOnInit(): void {
    this.svc.loadReports();
    this.svc.loadSchedules();
  }

  // ── Actions ────────────────────────────────────────────────

  onFilterChange(type: ReportType | ''): void {
    this.typeFilter.set(type);
    this.svc.loadReports(1, 25, type || undefined);
  }

  toggleGenerateForm(): void {
    this.showGenerateForm.update((v) => !v);
  }

  onGenerate(): void {
    if (!this.canGenerate()) return;

    this.svc
      .generate({
        name: this.genName(),
        type: this.genType(),
        format: this.genFormat(),
        dateFrom: this.genDateFrom(),
        dateTo: this.genDateTo(),
      })
      .subscribe({
        next: () => {
          this.snack.open('Report generation started.', 'OK', {
            duration: 3000,
          });
          this.showGenerateForm.set(false);
          this.resetGenerateForm();
        },
        error: () => {
          this.snack.open('Failed to generate report.', 'Dismiss', {
            duration: 5000,
          });
        },
      });
  }

  onPreview(report: ReportItem): void {
    this.previewReport.set(report);
    this.svc.getById(report.id).subscribe();
  }

  closePreview(): void {
    this.previewReport.set(null);
    this.svc.clearSelection();
  }

  onDownload(report: ReportItem): void {
    if (!report.downloadUrl) return;
    this.svc.download(report.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${report.name}.${report.format.toLowerCase()}`;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.snack.open('Download failed.', 'Dismiss', { duration: 5000 });
      },
    });
  }

  onShare(report: ReportItem): void {
    const email = prompt('Enter recipient email:');
    if (!email?.trim()) return;

    this.svc.shareReport(report.id, [email.trim()]).subscribe({
      next: () =>
        this.snack.open('Report shared.', 'OK', { duration: 3000 }),
      error: () =>
        this.snack.open('Failed to share report.', 'Dismiss', {
          duration: 5000,
        }),
    });
  }

  onDelete(report: ReportItem): void {
    if (!confirm(`Delete report "${report.name}"?`)) return;
    this.svc.deleteReport(report.id).subscribe({
      next: () =>
        this.snack.open('Report deleted.', 'OK', { duration: 3000 }),
    });
  }

  // ── Schedules ──────────────────────────────────────────────

  toggleSchedulePanel(): void {
    this.showSchedulePanel.update((v) => !v);
  }

  onToggleSchedule(schedule: ScheduledReport): void {
    this.svc.toggleSchedule(schedule.id, !schedule.enabled).subscribe();
  }

  onDeleteSchedule(schedule: ScheduledReport): void {
    if (!confirm(`Delete schedule "${schedule.name}"?`)) return;
    this.svc.deleteSchedule(schedule.id).subscribe({
      next: () =>
        this.snack.open('Schedule deleted.', 'OK', { duration: 3000 }),
    });
  }

  // ── Helpers ────────────────────────────────────────────────

  statusIcon(status: ReportStatus): string {
    switch (status) {
      case 'Ready':
        return 'check_circle';
      case 'Generating':
      case 'Pending':
        return 'hourglass_empty';
      case 'Failed':
        return 'error';
      case 'Expired':
        return 'schedule';
      default:
        return 'help_outline';
    }
  }

  statusClass(status: ReportStatus): string {
    switch (status) {
      case 'Ready':
        return 'status-ready';
      case 'Generating':
      case 'Pending':
        return 'status-pending';
      case 'Failed':
        return 'status-failed';
      case 'Expired':
        return 'status-expired';
      default:
        return '';
    }
  }

  formatFileSize(bytes: number | null): string {
    if (bytes == null) return '--';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private resetGenerateForm(): void {
    this.genName.set('');
    this.genType.set('TripSummary');
    this.genFormat.set('PDF');
    this.genDateFrom.set('');
    this.genDateTo.set('');
  }
}
