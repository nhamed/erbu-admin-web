import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuditService } from './audit.service';

describe('AuditService discrepancy actions', () => {
  let service: AuditService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuditService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts the mandatory reason when resolving', () => {
    service.resolveDiscrepancy('disc-1', 'preuve contrôlée').subscribe();

    const request = http.expectOne('/api/cockpit/audit/discrepancies/disc-1/resolve');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ reason: 'preuve contrôlée' });
    request.flush({ id: 'disc-1' });
  });

  it('posts the reason for a bulk action', () => {
    service.bulkDiscrepancyAction(['disc-1', 'disc-2'], 'acknowledge', 'cause commune').subscribe();

    const request = http.expectOne('/api/cockpit/audit/discrepancies/bulk-action');
    expect(request.request.body).toEqual({
      ids: ['disc-1', 'disc-2'],
      action: 'acknowledge',
      reason: 'cause commune',
    });
    request.flush({ updated: 2, action: 'acknowledge' });
  });
});
