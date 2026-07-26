import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  RedisService,
  RedisKeyDetail,
  RedisHashEntry,
  RedisSortedSetEntry,
} from './redis.service';
import { DevToolsService, RedisKeyInfo } from '@erbu-admin-web/shared/data-access';

const AUTO_REFRESH_MS = 30_000;

@Component({
  selector: 'app-redis-keys',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './redis-keys.page.html',
  styleUrl: './redis-keys.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RedisKeysPage implements OnInit, OnDestroy {
  private readonly redisService = inject(RedisService);
  readonly devTools = inject(DevToolsService);
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  // ── State ──────────────────────────────────────────────
  readonly keys = this.redisService.keys;
  readonly loading = this.redisService.loading;
  readonly error = this.redisService.error;
  readonly selectedKey = this.redisService.selectedKey;
  readonly keyLoading = this.redisService.keyLoading;
  readonly serverStats = this.redisService.serverStats;
  readonly deleteInProgress = this.redisService.deleteInProgress;

  readonly searchPattern = signal('*');
  readonly lastRefreshed = signal<Date | null>(null);
  readonly confirmingDelete = signal<string | null>(null);

  // ── Computed KPIs ──────────────────────────────────────
  readonly totalKeys = this.redisService.totalKeys;
  readonly keysWithTtl = this.redisService.keysWithTtl;
  readonly persistentKeys = this.redisService.persistentKeys;
  readonly keysByType = this.redisService.keysByType;

  readonly memoryDisplay = computed(
    () => this.serverStats()?.usedMemoryDisplay ?? '--',
  );

  readonly opsPerSec = computed(
    () => this.serverStats()?.opsPerSecond ?? 0,
  );

  readonly hitRateDisplay = computed(() => {
    const stats = this.serverStats();
    if (!stats) return '--';
    return (stats.hitRate * 100).toFixed(1) + '%';
  });

  readonly selectedKeyHashEntries = computed((): RedisHashEntry[] => {
    const detail = this.selectedKey();
    if (!detail || detail.type !== 'hash') return [];
    const val = detail.value;
    if (typeof val === 'object' && val !== null) {
      return Object.entries(val as Record<string, string>).map(([field, value]) => ({
        field,
        value,
      }));
    }
    return [];
  });

  readonly selectedKeySortedSetEntries = computed((): RedisSortedSetEntry[] => {
    const detail = this.selectedKey();
    if (!detail || detail.type !== 'zset') return [];
    if (Array.isArray(detail.value)) {
      return detail.value as RedisSortedSetEntry[];
    }
    return [];
  });

  readonly selectedKeyListItems = computed((): string[] => {
    const detail = this.selectedKey();
    if (!detail || (detail.type !== 'list' && detail.type !== 'set')) return [];
    if (Array.isArray(detail.value)) {
      return detail.value as string[];
    }
    return [];
  });

  // ── Lifecycle ──────────────────────────────────────────
  ngOnInit(): void {
    this.redisService.searchKeys('*');
    this.redisService.loadServerStats();
    this.lastRefreshed.set(new Date());
    this.refreshTimer = setInterval(() => {
      this.redisService.loadServerStats();
    }, AUTO_REFRESH_MS);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // ── Actions ────────────────────────────────────────────
  onSearch(): void {
    const pattern = this.searchPattern().trim() || '*';
    this.redisService.searchKeys(pattern);
    this.lastRefreshed.set(new Date());
  }

  onPatternChange(value: string): void {
    this.searchPattern.set(value);
  }

  onSelectKey(key: RedisKeyInfo): void {
    this.redisService.loadKeyDetail(key.key);
  }

  onCloseDetail(): void {
    this.redisService.clearSelection();
    this.confirmingDelete.set(null);
  }

  onConfirmDelete(key: string): void {
    this.confirmingDelete.set(key);
  }

  onCancelDelete(): void {
    this.confirmingDelete.set(null);
  }

  onDeleteKey(key: string): void {
    this.redisService.deleteKey(key).subscribe({
      next: () => this.confirmingDelete.set(null),
      error: () => this.confirmingDelete.set(null),
    });
  }

  onDismissError(): void {
    this.redisService.clearError();
  }

  // ── Template helpers ───────────────────────────────────
  trackByKey(_: number, item: RedisKeyInfo): string {
    return item.key;
  }

  trackByField(_: number, entry: RedisHashEntry): string {
    return entry.field;
  }

  trackByMember(_: number, entry: RedisSortedSetEntry): string {
    return entry.member;
  }

  formatTtl(seconds: number): string {
    if (seconds === -1) return 'Persistent';
    if (seconds === -2) return 'Expired';
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
  }

  typeIcon(type: string): string {
    switch (type) {
      case 'string': return 'text_fields';
      case 'hash': return 'tag';
      case 'list': return 'format_list_numbered';
      case 'set': return 'join_full';
      case 'zset': return 'sort';
      case 'stream': return 'stream';
      default: return 'help_outline';
    }
  }

  typeColor(type: string): string {
    switch (type) {
      case 'string': return '#5b8ff9';
      case 'hash': return '#ff9800';
      case 'list': return '#4caf50';
      case 'set': return '#9c27b0';
      case 'zset': return '#e91e63';
      case 'stream': return '#00bcd4';
      default: return '#9e9e9e';
    }
  }
}
