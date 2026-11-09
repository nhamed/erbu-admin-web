import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subscription, timer } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';
import {
  ExecutionCommandService,
  ExecutionJob,
  ExecutionJobCreateRequest,
  ExecutionOperation,
} from './execution-command.service';

@Component({
  selector: 'ops-execution-jobs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './execution-jobs.page.html',
  styleUrl: './execution-jobs.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExecutionJobsPage {
  private readonly service = inject(ExecutionCommandService);
  private readonly destroyRef = inject(DestroyRef);
  private polling?: Subscription;

  readonly operations: ExecutionOperation[] = [
    'E2E_RUN',
    'RESILIENCE_RUN',
    'STRYKER_RUN',
    'BASELINE_VERIFY',
  ];
  operation: ExecutionOperation = 'E2E_RUN';
  argumentValue = 'standard-trip';
  secondaryArgumentValue = '';
  requestedEnvironment = 'isolated';
  readonly job = signal<ExecutionJob | null>(null);
  readonly busy = signal(false);
  readonly status = signal('Aucune commande lancée.');
  readonly error = signal<string | null>(null);

  constructor() {
    this.destroyRef.onDestroy(() => this.polling?.unsubscribe());
  }

  create(): void {
    const argument = this.argumentValue.trim();
    if (!argument || this.busy()) return;
    if (this.requiresSecondaryArgument() && !this.secondaryArgumentValue.trim()) {
      this.error.set(
        this.operation === 'STRYKER_RUN'
          ? 'Le fichier de configuration Stryker est obligatoire.'
          : 'Le manifeste de baseline est obligatoire.',
      );
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    const request: ExecutionJobCreateRequest = {
      requestId: crypto.randomUUID(),
      operation: this.operation,
      arguments: this.argumentsFor(this.operation, argument),
      requestedEnvironment: this.requestedEnvironment.trim(),
    };
    this.service.create(request).subscribe({
      next: (job) => {
        this.job.set(job);
        this.status.set(`Commande ${job.operation} créée · ${job.status}.`);
        this.busy.set(false);
        this.startPolling(job.jobId);
      },
      error: (error: { message?: string }) => {
        this.error.set(error.message ?? 'AuditService a refusé la commande.');
        this.busy.set(false);
      },
    });
  }

  refresh(): void {
    const current = this.job();
    if (!current) return;
    this.read(current.jobId);
  }

  cancel(): void {
    const current = this.job();
    if (!current || !this.canCancel(current) || this.busy()) return;
    this.busy.set(true);
    this.service.cancel(current.jobId).subscribe({
      next: () => {
        this.status.set("Annulation demandée ; l'agent va interrompre l'opération proprement.");
        this.busy.set(false);
        this.read(current.jobId);
      },
      error: (error: { message?: string }) => {
        this.error.set(error.message ?? "La commande n'est plus annulable.");
        this.busy.set(false);
      },
    });
  }

  canCancel(job: ExecutionJob | null): boolean {
    return job !== null && ['QUEUED', 'RUNNING', 'CANCEL_REQUESTED'].includes(job.status);
  }

  requiresSecondaryArgument(): boolean {
    return this.operation === 'STRYKER_RUN' || this.operation === 'BASELINE_VERIFY';
  }

  private startPolling(jobId: string): void {
    this.polling?.unsubscribe();
    this.polling = timer(0, 2000)
      .pipe(
        switchMap(() => this.service.get(jobId)),
        takeWhile((job) => !['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(job.status), true),
      )
      .subscribe({
        next: (job) => {
          this.job.set(job);
          this.status.set(`État serveur · ${job.status}.`);
        },
        error: (error: { message?: string }) =>
          this.error.set(error.message ?? "Impossible de relire l'état."),
      });
  }

  private read(jobId: string): void {
    this.service.get(jobId).subscribe({
      next: (job) => {
        this.job.set(job);
        this.status.set(`État serveur · ${job.status}.`);
      },
      error: (error: { message?: string }) =>
        this.error.set(error.message ?? "Impossible de relire l'état."),
    });
  }

  private argumentsFor(operation: ExecutionOperation, value: string): Record<string, unknown> {
    switch (operation) {
      case 'E2E_RUN':
        return { scenarioId: value, environment: this.requestedEnvironment.trim() };
      case 'RESILIENCE_RUN':
        return { scenarioId: value };
      case 'STRYKER_RUN':
        return { repositoryRoot: value, configFile: this.requiredSecondary('configFile') };
      case 'BASELINE_VERIFY':
        return { repositoryRoot: value, manifestPath: this.requiredSecondary('manifestPath') };
      default:
        throw new Error('execution_operation_not_allowed');
    }
  }

  private requiredSecondary(name: string): string {
    const value = this.secondaryArgumentValue.trim();
    if (!value) throw new Error(`execution_argument_required:${name}`);
    return value;
  }
}
