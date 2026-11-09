import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ExecutionCommandService } from './execution-command.service';

describe('ExecutionCommandService', () => {
  let service: ExecutionCommandService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ExecutionCommandService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('creates a durable allowlisted job with the exact request id', () => {
    const request = {
      requestId: '11111111-1111-1111-1111-111111111111',
      operation: 'RESILIENCE_RUN' as const,
      arguments: { scenarioId: 'SCN-200' },
      requestedEnvironment: 'isolated',
    };

    service.create(request).subscribe();

    const call = http.expectOne('/api/audit/execution-jobs');
    expect(call.request.method).toBe('POST');
    expect(call.request.body).toEqual(request);
    call.flush({ jobId: '22222222-2222-2222-2222-222222222222' });
  });

  it('cancels the selected job without constructing a shell command', () => {
    service.cancel('22222222-2222-2222-2222-222222222222').subscribe();

    const call = http.expectOne(
      '/api/audit/execution-jobs/22222222-2222-2222-2222-222222222222/cancel',
    );
    expect(call.request.method).toBe('POST');
    expect(call.request.body).toEqual({});
    call.flush(null);
  });
});
