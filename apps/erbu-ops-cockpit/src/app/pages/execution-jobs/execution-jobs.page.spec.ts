import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ExecutionCommandService, ExecutionJob } from './execution-command.service';
import { ExecutionJobsPage } from './execution-jobs.page';

describe('ExecutionJobsPage', () => {
  let fixture: ComponentFixture<ExecutionJobsPage>;
  let service: ExecutionCommandService;
  let create: ReturnType<typeof vi.fn<ExecutionCommandService['create']>>;
  let get: ReturnType<typeof vi.fn<ExecutionCommandService['get']>>;
  let cancel: ReturnType<typeof vi.fn<ExecutionCommandService['cancel']>>;

  const queued: ExecutionJob = {
    jobId: '22222222-2222-2222-2222-222222222222',
    requestId: '11111111-1111-1111-1111-111111111111',
    operation: 'RESILIENCE_RUN',
    arguments: { scenarioId: 'SCN-203' },
    status: 'QUEUED',
    requestedBy: 'operator',
    requestedEnvironment: 'isolated',
    createdAt: '2026-11-09T00:00:00Z',
    updatedAt: '2026-11-09T00:00:00Z',
    progress: null,
    refusal: null,
  };

  beforeEach(async () => {
    create = vi.fn<ExecutionCommandService['create']>().mockReturnValue(of(queued));
    get = vi.fn<ExecutionCommandService['get']>().mockReturnValue(of({ ...queued, status: 'RUNNING' }));
    cancel = vi.fn<ExecutionCommandService['cancel']>().mockReturnValue(of(void 0));
    service = { create, get, cancel } as ExecutionCommandService;
    await TestBed.configureTestingModule({
      imports: [ExecutionJobsPage],
      providers: [{ provide: ExecutionCommandService, useValue: service }],
    }).compileComponents();
    fixture = TestBed.createComponent(ExecutionJobsPage);
    fixture.detectChanges();
  });

  it('creates a structured resilience job, polls it and relays cancellation', fakeAsync(() => {
    const page = fixture.componentInstance;
    page.operation = 'RESILIENCE_RUN';
    page.argumentValue = 'SCN-203';

    page.create();
    tick(0);

    const request = create.mock.calls.at(-1)![0];
    expect(request.operation).toBe('RESILIENCE_RUN');
    expect(request.arguments).toEqual({ scenarioId: 'SCN-203' });
    expect(request.arguments['command']).toBeUndefined();
    expect(get).toHaveBeenCalledWith(queued.jobId);

    page.cancel();
    tick(0);
    expect(cancel).toHaveBeenCalledWith(queued.jobId);
    fixture.destroy();
    discardPeriodicTasks();
  }));

  it('uses scenarioId for an E2E job', fakeAsync(() => {
    const page = fixture.componentInstance;
    page.operation = 'E2E_RUN';
    page.argumentValue = 'standard-trip';
    page.requestedEnvironment = 'pc-runner';

    page.create();
    tick(0);

    expect(create.mock.calls.at(-1)![0].arguments).toEqual({
      scenarioId: 'standard-trip',
      environment: 'pc-runner',
    });
    fixture.destroy();
    discardPeriodicTasks();
  }));

  it('creates the exact structured arguments for mutation and baseline jobs', fakeAsync(() => {
    const page = fixture.componentInstance;
    page.operation = 'STRYKER_RUN';
    page.argumentValue = 'D:/work/PaymentService';
    page.secondaryArgumentValue = 'stryker-config.json';
    page.create();
    tick(0);

    expect(create.mock.calls.at(-1)![0].arguments).toEqual({
      repositoryRoot: 'D:/work/PaymentService',
      configFile: 'stryker-config.json',
    });

    page.operation = 'BASELINE_VERIFY';
    page.secondaryArgumentValue = 'artifacts/baseline-approvals.json';
    page.create();
    tick(0);
    expect(create.mock.calls.at(-1)![0].arguments).toEqual({
      repositoryRoot: 'D:/work/PaymentService',
      manifestPath: 'artifacts/baseline-approvals.json',
    });
    fixture.destroy();
    discardPeriodicTasks();
  }));

  it('refuses a mutation command without its configuration before calling AuditService', () => {
    const page = fixture.componentInstance;
    page.operation = 'STRYKER_RUN';
    page.argumentValue = 'D:/work/PaymentService';
    page.secondaryArgumentValue = ' ';

    page.create();

    expect(create).not.toHaveBeenCalled();
    expect(page.error()).toContain('configuration Stryker');
  });
});
