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
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';

import {
  SupportTicketService,
  SupportTicket,
  TicketDetail,
  TicketStatus,
  TicketPriority,
  TicketTimelineEntry,
} from './support-ticket.service';

@Component({
  selector: 'app-support-ticket',
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
    MatChipsModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    MatBadgeModule,
    MatDividerModule,
  ],
  templateUrl: './support-ticket.page.html',
  styleUrl: './support-ticket.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SupportTicketPage implements OnInit {
  protected readonly svc = inject(SupportTicketService);

  // ---- Local UI state ----
  readonly searchTerm = signal('');
  readonly statusFilter = signal<TicketStatus | ''>('');
  readonly priorityFilter = signal<TicketPriority | ''>('');
  readonly currentPage = signal(1);
  readonly pageSize = signal(25);
  readonly replyContent = signal('');
  readonly replyInternal = signal(false);
  readonly closeResolution = signal('');
  readonly showCloseDialog = signal(false);

  // ---- Table columns ----
  readonly displayedColumns: string[] = [
    'ticketNumber',
    'subject',
    'category',
    'status',
    'priority',
    'riderName',
    'assignedTo',
    'updatedAt',
    'actions',
  ];

  // ---- Filter options ----
  readonly statuses: TicketStatus[] = ['Open', 'InProgress', 'AwaitingReply', 'Resolved', 'Closed'];
  readonly priorities: TicketPriority[] = ['Low', 'Medium', 'High', 'Critical'];

  // ---- Computed KPIs ----
  readonly kpiCards = computed(() => [
    {
      label: 'Total Tickets',
      value: this.svc.totalCount(),
      icon: 'confirmation_number',
      variant: 'neutral',
    },
    {
      label: 'Open',
      value: this.svc.openCount(),
      icon: 'folder_open',
      variant: 'warning',
    },
    {
      label: 'In Progress',
      value: this.svc.inProgressCount(),
      icon: 'hourglass_top',
      variant: 'info',
    },
    {
      label: 'Critical',
      value: this.svc.criticalCount(),
      icon: 'priority_high',
      variant: 'danger',
    },
    {
      label: 'Awaiting Reply',
      value: this.svc.awaitingReplyCount(),
      icon: 'mark_email_unread',
      variant: 'warning',
    },
  ]);

  // ---- Lifecycle ----
  ngOnInit(): void {
    this.loadTickets();
  }

  // ---- Actions ----
  onSearch(): void {
    this.currentPage.set(1);
    this.loadTickets();
  }

  onStatusFilterChange(status: TicketStatus | ''): void {
    this.statusFilter.set(status);
    this.currentPage.set(1);
    this.loadTickets();
  }

  onPriorityFilterChange(priority: TicketPriority | ''): void {
    this.priorityFilter.set(priority);
    this.currentPage.set(1);
    this.loadTickets();
  }

  onSelectTicket(ticket: SupportTicket): void {
    this.svc.loadTicketDetail(ticket.id);
    this.replyContent.set('');
    this.replyInternal.set(false);
  }

  onCloseDetail(): void {
    this.svc.clearSelection();
    this.replyContent.set('');
    this.showCloseDialog.set(false);
  }

  onSendReply(): void {
    const ticket = this.svc.selectedTicket();
    if (!ticket || !this.replyContent().trim()) return;

    this.svc
      .replyToTicket(ticket.id, {
        content: this.replyContent(),
        internal: this.replyInternal(),
      })
      .subscribe(() => this.replyContent.set(''));
  }

  onUpdateStatus(ticketId: string, status: TicketStatus): void {
    this.svc.updateTicketStatus(ticketId, status).subscribe();
  }

  onUpdatePriority(ticketId: string, priority: TicketPriority): void {
    this.svc.updatePriority(ticketId, priority).subscribe();
  }

  onShowCloseDialog(): void {
    this.showCloseDialog.set(true);
  }

  onCloseTicket(): void {
    const ticket = this.svc.selectedTicket();
    if (!ticket || !this.closeResolution().trim()) return;

    this.svc.closeTicket(ticket.id, this.closeResolution()).subscribe(() => {
      this.showCloseDialog.set(false);
      this.closeResolution.set('');
    });
  }

  onCancelClose(): void {
    this.showCloseDialog.set(false);
    this.closeResolution.set('');
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadTickets();
  }

  // ---- Helpers ----
  statusClass(status: TicketStatus): string {
    switch (status) {
      case 'Open':
        return 'status-open';
      case 'InProgress':
        return 'status-in-progress';
      case 'AwaitingReply':
        return 'status-awaiting';
      case 'Resolved':
        return 'status-resolved';
      case 'Closed':
        return 'status-closed';
      default:
        return '';
    }
  }

  priorityClass(priority: TicketPriority): string {
    switch (priority) {
      case 'Low':
        return 'priority-low';
      case 'Medium':
        return 'priority-medium';
      case 'High':
        return 'priority-high';
      case 'Critical':
        return 'priority-critical';
      default:
        return '';
    }
  }

  timelineIcon(type: TicketTimelineEntry['type']): string {
    switch (type) {
      case 'Reply':
        return 'chat';
      case 'StatusChange':
        return 'swap_horiz';
      case 'PriorityChange':
        return 'flag';
      case 'Assignment':
        return 'person_add';
      case 'Note':
        return 'note';
      default:
        return 'info';
    }
  }

  timelineRoleClass(role: TicketTimelineEntry['authorRole']): string {
    switch (role) {
      case 'Admin':
        return 'role-admin';
      case 'Rider':
        return 'role-rider';
      case 'System':
        return 'role-system';
      default:
        return '';
    }
  }

  trackByTicketId(_: number, ticket: SupportTicket): string {
    return ticket.id;
  }

  trackByTimelineId(_: number, entry: TicketTimelineEntry): string {
    return entry.id;
  }

  // ---- Private ----
  private loadTickets(): void {
    const status = this.statusFilter();
    const priority = this.priorityFilter();
    this.svc.loadTickets(
      this.currentPage(),
      this.pageSize(),
      status || undefined,
      priority || undefined,
      this.searchTerm() || undefined,
    );
  }
}
