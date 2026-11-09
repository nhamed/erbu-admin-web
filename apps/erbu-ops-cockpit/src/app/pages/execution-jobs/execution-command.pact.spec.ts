import { provideHttpClient, withFetch } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { PactV4, MatchersV3 } from '@pact-foundation/pact';
import { firstValueFrom } from 'rxjs';
import {
  EXECUTION_COMMAND_API_URL,
  ExecutionCommandService,
  ExecutionJobCreateRequest,
} from './execution-command.service';

const request: ExecutionJobCreateRequest = {
  requestId: '11111111-1111-1111-1111-111111111111',
  operation: 'RESILIENCE_RUN',
  arguments: { scenarioId: 'SCN-200' },
  requestedEnvironment: 'isolated',
};

describe('Erbu Ops Cockpit execution command contract', () => {
  const pact = new PactV4({
    consumer: 'ErbuOpsCockpit',
    provider: 'AuditService',
    dir: 'artifacts/pacts',
    logLevel: 'error',
  });

  it('creates an execution job', async () => {
    await pact
      .addInteraction()
      .given('the execution command store is available')
      .uponReceiving('an allowlisted resilience execution request')
      .withRequest('POST', '/api/audit/execution-jobs', (builder) => {
        builder.headers({ 'Content-Type': 'application/json' }).jsonBody(request);
      })
      .willRespondWith(201, (builder) => {
        builder
          .headers({ 'Content-Type': 'application/json' })
          .jsonBody({
            jobId: MatchersV3.uuid('22222222-2222-2222-2222-222222222222'),
            requestId: request.requestId,
            operation: request.operation,
            arguments: request.arguments,
            status: 'QUEUED',
            requestedBy: MatchersV3.string('admin-operator'),
            requestedEnvironment: request.requestedEnvironment,
            createdAt: MatchersV3.iso8601DateTime('2026-11-09T00:00:00Z'),
            updatedAt: MatchersV3.iso8601DateTime('2026-11-09T00:00:00Z'),
            progress: null,
            refusal: null,
          });
      })
      .executeTest(async (server) => {
        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
          providers: [
            provideHttpClient(withFetch()),
            { provide: EXECUTION_COMMAND_API_URL, useValue: server.url + '/api/audit/execution-jobs' },
          ],
        });
        const service = TestBed.inject(ExecutionCommandService);

        const job = await firstValueFrom(service.create(request));

        expect(job.requestId).toBe(request.requestId);
        expect(job.status).toBe('QUEUED');
      });
  });
});
