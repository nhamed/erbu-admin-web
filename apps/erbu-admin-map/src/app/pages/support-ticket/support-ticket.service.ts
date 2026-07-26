import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, tap, throwError, finalize } from 'rxjs';

// ---------- DTOs ----------

export type TicketStatus = 'Open' | 'InProgress' | 'AwaitingReply' | 'Resolved' | 'Closed';

export type TicketPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export type TicketCategory =
  | 'TripIssue'
  | 'Payment'
  | 'AccountAccess'
  | 'DriverComplaint'
  | 'AppBug'
  | 'FeatureRequest'
  | 'Other';

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  riderName: string;
  riderId: string;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  lastReplyAt: string | null;
  replyCount: number;
}

export interface TicketDetail extends SupportTicket {
  description: string;
  relatedTripId: string | null;
  relatedTripNumber: string | null;
  riderEmail: string;
  riderPhone: string;
  attachments: TicketAttachment[];
  timeline: TicketTimelineEntry[];
}

export interface TicketAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string;
  uploadedAt: string;
}

export interface TicketTimelineEntry {
  id: string;
  type: 'Reply' | 'StatusChange' | 'PriorityChange' | 'Assignment' | 'Note';
  authorName: string;
  authorRole: 'Admin' | 'Rider' | 'System';
  content: string;
  createdAt: string;
  metadata: Record<string, string> | null;
}

export interface TicketReply {
  content: string;
  internal: boolean;
}

export interface TicketListResponse {
  items: SupportTicket[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------- Service ----------

const API_BASE = '/api/admin/support/tickets';

@Injectable({ providedIn: 'root' })
export class SupportTicketService {
  private readonly http = inject(HttpClient);

  // ---- State signals ----
  readonly tickets = signal<SupportTicket[]>([]);
  readonly selectedTicket = signal<TicketDetail | null>(null);
  readonly loading = signal(false);
  readonly detailLoading = signal(false);
  readonly replying = signal(false);
  readonly error = signal<string | null>(null);
  readonly totalCount = signal(0);

  // ---- Computed ----
  readonly openCount = computed(
    () => this.tickets().filter((t) => t.status === 'Open').length,
  );
  readonly inProgressCount = computed(
    () => this.tickets().filter((t) => t.status === 'InProgress').length,
  );
  readonly criticalCount = computed(
    () => this.tickets().filter((t) => t.priority === 'Critical').length,
  );
  readonly awaitingReplyCount = computed(
    () => this.tickets().filter((t) => t.status === 'AwaitingReply').length,
  );

  // ---- Load list ----
  loadTickets(
    page = 1,
    pageSize = 25,
    statusFilter?: TicketStatus,
    priorityFilter?: TicketPriority,
    search?: string,
  ): void {
    this.loading.set(true);
    this.error.set(null);

    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (statusFilter) params = params.set('status', statusFilter);
    if (priorityFilter) params = params.set('priority', priorityFilter);
    if (search) params = params.set('search', search);

    this.http
      .get<TicketListResponse>(API_BASE, { params })
      .pipe(
        tap((res) => {
          this.tickets.set(res.items);
          this.totalCount.set(res.total);
        }),
        catchError((err) => {
          this.error.set('Failed to load support tickets.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  // ---- Load detail ----
  loadTicketDetail(id: string): void {
    this.detailLoading.set(true);
    this.http
      .get<TicketDetail>(`${API_BASE}/${id}`)
      .pipe(
        tap((detail) => this.selectedTicket.set(detail)),
        catchError((err) => {
          this.error.set('Failed to load ticket details.');
          return throwError(() => err);
        }),
        finalize(() => this.detailLoading.set(false)),
      )
      .subscribe();
  }

  // ---- Reply ----
  replyToTicket(ticketId: string, reply: TicketReply): Observable<TicketDetail> {
    this.replying.set(true);
    return this.http
      .post<TicketDetail>(`${API_BASE}/${ticketId}/replies`, reply)
      .pipe(
        tap((updated) => {
          this.selectedTicket.set(updated);
          this.tickets.update((list) =>
            list.map((t) =>
              t.id === ticketId
                ? { ...t, status: updated.status, replyCount: updated.replyCount, lastReplyAt: updated.lastReplyAt }
                : t,
            ),
          );
        }),
        catchError((err) => {
          this.error.set('Failed to send reply.');
          return throwError(() => err);
        }),
        finalize(() => this.replying.set(false)),
      );
  }

  // ---- Status management ----
  updateTicketStatus(ticketId: string, status: TicketStatus): Observable<SupportTicket> {
    return this.http
      .patch<SupportTicket>(`${API_BASE}/${ticketId}/status`, { status })
      .pipe(
        tap((updated) => {
          this.tickets.update((list) =>
            list.map((t) => (t.id === ticketId ? { ...t, status: updated.status } : t)),
          );
          if (this.selectedTicket()?.id === ticketId) {
            this.selectedTicket.update((d) => (d ? { ...d, status: updated.status } : d));
          }
        }),
        catchError((err) => {
          this.error.set('Failed to update ticket status.');
          return throwError(() => err);
        }),
      );
  }

  closeTicket(ticketId: string, resolution: string): Observable<SupportTicket> {
    return this.http
      .post<SupportTicket>(`${API_BASE}/${ticketId}/close`, { resolution })
      .pipe(
        tap((updated) => {
          this.tickets.update((list) =>
            list.map((t) => (t.id === ticketId ? { ...t, status: 'Closed' as TicketStatus } : t)),
          );
          if (this.selectedTicket()?.id === ticketId) {
            this.selectedTicket.update((d) => (d ? { ...d, status: 'Closed' as TicketStatus } : d));
          }
        }),
        catchError((err) => {
          this.error.set('Failed to close ticket.');
          return throwError(() => err);
        }),
      );
  }

  // ---- Priority ----
  updatePriority(ticketId: string, priority: TicketPriority): Observable<SupportTicket> {
    return this.http
      .patch<SupportTicket>(`${API_BASE}/${ticketId}/priority`, { priority })
      .pipe(
        tap((updated) => {
          this.tickets.update((list) =>
            list.map((t) => (t.id === ticketId ? { ...t, priority: updated.priority } : t)),
          );
          if (this.selectedTicket()?.id === ticketId) {
            this.selectedTicket.update((d) => (d ? { ...d, priority: updated.priority } : d));
          }
        }),
        catchError((err) => {
          this.error.set('Failed to update priority.');
          return throwError(() => err);
        }),
      );
  }

  // ---- Assignment ----
  assignTicket(ticketId: string, agentId: string): Observable<SupportTicket> {
    return this.http
      .patch<SupportTicket>(`${API_BASE}/${ticketId}/assign`, { agentId })
      .pipe(
        tap((updated) => {
          this.tickets.update((list) =>
            list.map((t) => (t.id === ticketId ? { ...t, assignedTo: updated.assignedTo } : t)),
          );
          if (this.selectedTicket()?.id === ticketId) {
            this.selectedTicket.update((d) =>
              d ? { ...d, assignedTo: updated.assignedTo } : d,
            );
          }
        }),
        catchError((err) => {
          this.error.set('Failed to assign ticket.');
          return throwError(() => err);
        }),
      );
  }

  // ---- Utility ----
  clearSelection(): void {
    this.selectedTicket.set(null);
  }

  clearError(): void {
    this.error.set(null);
  }
}
