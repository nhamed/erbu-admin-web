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
  DatabaseService,
  PgTableInfo,
  PgPurgeSchedule,
} from './database.service';
import { DevToolsService } from '@erbu-admin-web/shared/data-access';

const AUTO_REFRESH_MS = 30_000;

@Component({
  selector: 'app-database-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './database-management.page.html',
  styleUrl: './database-management.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DatabaseManagementPage implements OnInit, OnDestroy {
  private readonly dbService = inject(DatabaseService);
  readonly devTools = inject(DevToolsService);
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  // ── State ──────────────────────────────────────────────
  readonly tables = this.dbService.tables;
  readonly loading = this.dbService.loading;
  readonly error = this.dbService.error;
  readonly connectionPool = this.dbService.connectionPool;
  readonly backupStatus = this.dbService.backupStatus;
  readonly purgeSchedules = this.dbService.purgeSchedules;
  readonly databaseStats = this.dbService.databaseStats;
  readonly queryResult = this.dbService.queryResult;
  readonly queryLoading = this.dbService.queryLoading;
  readonly queryError = this.dbService.queryError;

  readonly sqlInput = signal('SELECT 1;');
  readonly activeTab = signal<'tables' | 'query' | 'purge' | 'backup'>('tables');
  readonly lastRefreshed = signal<Date | null>(null);
  readonly backupTriggering = signal(false);
  readonly tableSearch = signal('');

  // ── Computed KPIs ──────────────────────────────────────
  readonly totalTables = this.dbService.totalTables;
  readonly totalRows = this.dbService.totalRows;
  readonly poolUtilization = this.dbService.poolUtilization;

  readonly dbSizeDisplay = computed(
    () => this.databaseStats()?.databaseSizeDisplay ?? '--',
  );

  readonly cacheHitDisplay = computed(() => {
    const stats = this.databaseStats();
    if (!stats) return '--';
    return (stats.cacheHitRatio * 100).toFixed(1) + '%';
  });

  readonly filteredTables = computed(() => {
    const search = this.tableSearch().toLowerCase();
    if (!search) return this.tables();
    return this.tables().filter(
      (t) =>
        t.tableName.toLowerCase().includes(search) ||
        t.schemaName.toLowerCase().includes(search),
    );
  });

  readonly poolStatusClass = computed(() => {
    const pct = this.poolUtilization();
    if (pct >= 90) return 'pool-critical';
    if (pct >= 70) return 'pool-warning';
    return 'pool-healthy';
  });

  readonly backupStatusClass = computed(() => {
    const status = this.backupStatus()?.status;
    switch (status) {
      case 'Completed':
        return 'backup-ok';
      case 'Running':
        return 'backup-running';
      case 'Failed':
        return 'backup-failed';
      default:
        return 'backup-unknown';
    }
  });

  // ── Lifecycle ──────────────────────────────────────────
  ngOnInit(): void {
    this.loadAll();
    this.refreshTimer = setInterval(() => this.loadAll(), AUTO_REFRESH_MS);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // ── Actions ────────────────────────────────────────────
  onTabChange(tab: 'tables' | 'query' | 'purge' | 'backup'): void {
    this.activeTab.set(tab);
  }

  onExecuteQuery(): void {
    const sql = this.sqlInput().trim();
    if (!sql) return;
    this.dbService.executeQuery(sql);
  }

  onClearQuery(): void {
    this.dbService.clearQuery();
    this.sqlInput.set('');
  }

  onTriggerBackup(): void {
    this.backupTriggering.set(true);
    this.dbService.triggerBackup().subscribe({
      next: () => this.backupTriggering.set(false),
      error: () => this.backupTriggering.set(false),
    });
  }

  onTogglePurge(schedule: PgPurgeSchedule): void {
    this.dbService
      .togglePurgeSchedule(schedule.id, !schedule.isEnabled)
      .subscribe();
  }

  onRefresh(): void {
    this.loadAll();
  }

  onDismissError(): void {
    this.dbService.clearError();
  }

  onTableSearchChange(value: string): void {
    this.tableSearch.set(value);
  }

  onSqlInputChange(value: string): void {
    this.sqlInput.set(value);
  }

  // ── Template helpers ───────────────────────────────────
  trackByTable(_: number, table: PgTableInfo): string {
    return `${table.schemaName}.${table.tableName}`;
  }

  trackByPurge(_: number, purge: PgPurgeSchedule): string {
    return purge.id;
  }

  trackByColumn(_: number, col: string): string {
    return col;
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
  }

  // ── Private ────────────────────────────────────────────
  private loadAll(): void {
    this.dbService.loadTables();
    this.dbService.loadConnectionPool();
    this.dbService.loadBackupStatus();
    this.dbService.loadPurgeSchedules();
    this.dbService.loadDatabaseStats();
    this.lastRefreshed.set(new Date());
  }
}
