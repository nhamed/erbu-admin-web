import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  OnInit,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import {
  StoryItem,
  StoryStatus,
  StoryPriority,
} from '@erbu-admin-web/shared/models';
import { StoriesService } from './stories-tab.service';

interface KanbanColumn {
  status: StoryStatus;
  label: string;
  stories: StoryItem[];
}

@Component({
  selector: 'cockpit-stories-tab',
  templateUrl: './stories-tab.page.html',
  styleUrl: './stories-tab.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    MatCardModule,
    MatChipsModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatToolbarModule,
    MatMenuModule,
    MatBadgeModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDividerModule,
  ],
})
export class StoriesTabPage implements OnInit {
  private readonly storiesService = inject(StoriesService);
  private readonly snackBar = inject(MatSnackBar);

  @ViewChild('importInput') importInput!: ElementRef<HTMLInputElement>;

  // --- Data signals ---
  readonly allStories = signal<StoryItem[]>([]);
  readonly loading = signal(false);
  readonly selectedStory = signal<StoryItem | null>(null);
  readonly detailPanelOpen = signal(false);

  // --- Filter signals ---
  readonly searchQuery = signal('');
  readonly filterPriorities = signal<StoryPriority[]>([]);
  readonly filterStatuses = signal<StoryStatus[]>([]);

  // --- Selection signals ---
  readonly selectedIds = signal<Set<string>>(new Set());

  // --- Enum references for template ---
  readonly StoryStatus = StoryStatus;
  readonly StoryPriority = StoryPriority;

  readonly allStatuses: StoryStatus[] = [
    StoryStatus.Inbox,
    StoryStatus.Backlog,
    StoryStatus.Ready,
    StoryStatus.InProgress,
    StoryStatus.InReview,
    StoryStatus.Done,
    StoryStatus.Archived,
  ];

  readonly allPriorities: StoryPriority[] = [
    StoryPriority.Critical,
    StoryPriority.High,
    StoryPriority.Medium,
    StoryPriority.Low,
  ];

  readonly kanbanStatuses: StoryStatus[] = [
    StoryStatus.Inbox,
    StoryStatus.Backlog,
    StoryStatus.Ready,
    StoryStatus.InProgress,
    StoryStatus.InReview,
    StoryStatus.Done,
  ];

  // --- Computed: filtered stories ---
  readonly filteredStories = computed(() => {
    let stories = this.allStories();
    const query = this.searchQuery().toLowerCase().trim();
    const priorities = this.filterPriorities();
    const statuses = this.filterStatuses();

    if (query) {
      stories = stories.filter(
        s =>
          s.id.toLowerCase().includes(query) ||
          s.title.toLowerCase().includes(query) ||
          (s.assignee?.toLowerCase().includes(query) ?? false) ||
          (s.epic?.toLowerCase().includes(query) ?? false),
      );
    }
    if (priorities.length > 0) {
      stories = stories.filter(s => priorities.includes(s.priority));
    }
    if (statuses.length > 0) {
      stories = stories.filter(s => statuses.includes(s.status));
    }
    return stories;
  });

  // --- Computed: kanban columns ---
  readonly kanbanColumns = computed<KanbanColumn[]>(() => {
    const stories = this.filteredStories();
    return this.kanbanStatuses.map(status => ({
      status,
      label: this.statusLabel(status),
      stories: stories.filter(s => s.status === status),
    }));
  });

  // --- Computed: selection state ---
  readonly selectionCount = computed(() => this.selectedIds().size);
  readonly hasSelection = computed(() => this.selectedIds().size > 0);

  readonly connectedDropLists = computed(() =>
    this.kanbanStatuses.map(s => `kanban-${s}`),
  );

  ngOnInit(): void {
    this.loadStories();
  }

  loadStories(): void {
    this.loading.set(true);
    this.storiesService
      .list(
        {
          priority: this.filterPriorities().length ? this.filterPriorities() : undefined,
          status: this.filterStatuses().length ? this.filterStatuses() : undefined,
          search: this.searchQuery() || undefined,
        },
        1,
        500,
      )
      .subscribe({
        next: page => {
          this.allStories.set(page.items);
          this.loading.set(false);
        },
        error: err => {
          this.snackBar.open(
            `Failed to load stories: ${err.message ?? 'Unknown error'}`,
            'Dismiss',
            { duration: 5000 },
          );
          this.loading.set(false);
        },
      });
  }

  // --- Filter actions ---
  onSearchChange(value: string): void {
    this.searchQuery.set(value);
  }

  onPriorityFilterChange(priorities: StoryPriority[]): void {
    this.filterPriorities.set(priorities);
  }

  onStatusFilterChange(statuses: StoryStatus[]): void {
    this.filterStatuses.set(statuses);
  }

  clearFilters(): void {
    this.searchQuery.set('');
    this.filterPriorities.set([]);
    this.filterStatuses.set([]);
  }

  // --- Story detail ---
  openDetail(story: StoryItem): void {
    this.selectedStory.set(story);
    this.detailPanelOpen.set(true);
  }

  closeDetail(): void {
    this.detailPanelOpen.set(false);
    this.selectedStory.set(null);
  }

  // --- Selection ---
  toggleSelection(storyId: string): void {
    const current = new Set(this.selectedIds());
    if (current.has(storyId)) {
      current.delete(storyId);
    } else {
      current.add(storyId);
    }
    this.selectedIds.set(current);
  }

  isSelected(storyId: string): boolean {
    return this.selectedIds().has(storyId);
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  selectAll(): void {
    const ids = new Set(this.filteredStories().map(s => s.id));
    this.selectedIds.set(ids);
  }

  // --- Drag & Drop ---
  onDrop(event: CdkDragDrop<StoryItem[]>, targetStatus: StoryStatus): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      return;
    }

    const story = event.previousContainer.data[event.previousIndex];

    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex,
    );

    this.storiesService.updateStatus(story.id, targetStatus).subscribe({
      next: updated => {
        this.updateStoryInList(updated);
        this.snackBar.open(
          `"${updated.title}" moved to ${this.statusLabel(targetStatus)}`,
          'OK',
          { duration: 3000 },
        );
      },
      error: err => {
        this.snackBar.open(
          `Failed to move story: ${err.message ?? 'Unknown error'}`,
          'Dismiss',
          { duration: 5000 },
        );
        this.loadStories();
      },
    });
  }

  // --- Batch actions ---
  batchMoveToDone(): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    this.loading.set(true);
    this.storiesService
      .batchMove({ storyIds: ids, targetStatus: StoryStatus.Done })
      .subscribe({
        next: updated => {
          for (const story of updated) {
            this.updateStoryInList(story);
          }
          this.clearSelection();
          this.loading.set(false);
          this.snackBar.open(
            `${updated.length} stories moved to Done`,
            'OK',
            { duration: 3000 },
          );
        },
        error: err => {
          this.snackBar.open(
            `Batch move failed: ${err.message ?? 'Unknown error'}`,
            'Dismiss',
            { duration: 5000 },
          );
          this.loading.set(false);
        },
      });
  }

  batchMoveToStatus(targetStatus: StoryStatus): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    this.loading.set(true);
    this.storiesService
      .batchMove({ storyIds: ids, targetStatus })
      .subscribe({
        next: updated => {
          for (const story of updated) {
            this.updateStoryInList(story);
          }
          this.clearSelection();
          this.loading.set(false);
          this.snackBar.open(
            `${updated.length} stories moved to ${this.statusLabel(targetStatus)}`,
            'OK',
            { duration: 3000 },
          );
        },
        error: err => {
          this.snackBar.open(
            `Batch move failed: ${err.message ?? 'Unknown error'}`,
            'Dismiss',
            { duration: 5000 },
          );
          this.loading.set(false);
        },
      });
  }

  batchAssign(assignee: string): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0) return;

    this.loading.set(true);
    this.storiesService
      .batchAssign({ storyIds: ids, assignee })
      .subscribe({
        next: updated => {
          for (const story of updated) {
            this.updateStoryInList(story);
          }
          this.clearSelection();
          this.loading.set(false);
          this.snackBar.open(
            `${updated.length} stories assigned to ${assignee}`,
            'OK',
            { duration: 3000 },
          );
        },
        error: err => {
          this.snackBar.open(
            `Batch assign failed: ${err.message ?? 'Unknown error'}`,
            'Dismiss',
            { duration: 5000 },
          );
          this.loading.set(false);
        },
      });
  }

  // --- Import / Export ---
  exportStories(): void {
    this.storiesService
      .exportStories({
        priority: this.filterPriorities().length ? this.filterPriorities() : undefined,
        status: this.filterStatuses().length ? this.filterStatuses() : undefined,
      })
      .subscribe({
        next: blob => {
          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = `stories-export-${new Date().toISOString().slice(0, 10)}.json`;
          anchor.click();
          URL.revokeObjectURL(url);
          this.snackBar.open('Stories exported', 'OK', { duration: 3000 });
        },
        error: err => {
          this.snackBar.open(
            `Export failed: ${err.message ?? 'Unknown error'}`,
            'Dismiss',
            { duration: 5000 },
          );
        },
      });
  }

  triggerImport(): void {
    this.importInput.nativeElement.click();
  }

  onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.loading.set(true);
    this.storiesService.importStories(file).subscribe({
      next: imported => {
        this.loadStories();
        this.snackBar.open(
          `${imported.length} stories imported`,
          'OK',
          { duration: 3000 },
        );
        input.value = '';
      },
      error: err => {
        this.snackBar.open(
          `Import failed: ${err.message ?? 'Unknown error'}`,
          'Dismiss',
          { duration: 5000 },
        );
        this.loading.set(false);
        input.value = '';
      },
    });
  }

  // --- Helpers ---
  statusLabel(status: StoryStatus): string {
    const labels: Record<StoryStatus, string> = {
      [StoryStatus.Inbox]: 'Inbox',
      [StoryStatus.Backlog]: 'Backlog',
      [StoryStatus.Ready]: 'Ready',
      [StoryStatus.InProgress]: 'In Progress',
      [StoryStatus.InReview]: 'In Review',
      [StoryStatus.Done]: 'Done',
      [StoryStatus.Archived]: 'Archived',
    };
    return labels[status] ?? status;
  }

  priorityIcon(priority: StoryPriority): string {
    const icons: Record<StoryPriority, string> = {
      [StoryPriority.Critical]: 'error',
      [StoryPriority.High]: 'arrow_upward',
      [StoryPriority.Medium]: 'remove',
      [StoryPriority.Low]: 'arrow_downward',
    };
    return icons[priority] ?? 'help';
  }

  priorityColor(priority: StoryPriority): string {
    const colors: Record<StoryPriority, string> = {
      [StoryPriority.Critical]: 'critical',
      [StoryPriority.High]: 'high',
      [StoryPriority.Medium]: 'medium',
      [StoryPriority.Low]: 'low',
    };
    return colors[priority] ?? '';
  }

  statusIcon(status: StoryStatus): string {
    const icons: Record<StoryStatus, string> = {
      [StoryStatus.Inbox]: 'inbox',
      [StoryStatus.Backlog]: 'list',
      [StoryStatus.Ready]: 'check_circle_outline',
      [StoryStatus.InProgress]: 'play_circle_outline',
      [StoryStatus.InReview]: 'rate_review',
      [StoryStatus.Done]: 'done_all',
      [StoryStatus.Archived]: 'archive',
    };
    return icons[status] ?? 'help';
  }

  trackByStoryId(_index: number, story: StoryItem): string {
    return story.id;
  }

  trackByStatus(_index: number, col: KanbanColumn): StoryStatus {
    return col.status;
  }

  formatDate(iso: string | null): string {
    if (!iso) return '--';
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  /** Simple markdown-to-html: headers, bold, italic, code, line breaks. */
  renderMarkdown(text: string): string {
    if (!text) return '';
    let html = this.escapeHtml(text);
    // headers
    html = html.replace(/^### (.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^## (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^# (.+)$/gm, '<h3>$1</h3>');
    // bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // italic
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // line breaks
    html = html.replace(/\n/g, '<br>');
    // bullet lists
    html = html.replace(/(<br>)- (.+?)(?=<br>|$)/g, '<br>&bull; $2');
    return html;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private updateStoryInList(updated: StoryItem): void {
    this.allStories.update(stories =>
      stories.map(s => (s.id === updated.id ? updated : s)),
    );
  }
}
