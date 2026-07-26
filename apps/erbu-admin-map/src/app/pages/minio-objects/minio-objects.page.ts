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
  MinioService,
  MinioBucket,
  MinioObjectDetail,
} from './minio.service';
import { DevToolsService } from '@erbu-admin-web/shared/data-access';

@Component({
  selector: 'app-minio-objects',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './minio-objects.page.html',
  styleUrl: './minio-objects.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MinioObjectsPage implements OnInit, OnDestroy {
  private readonly minioService = inject(MinioService);
  readonly devTools = inject(DevToolsService);
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  // ── State ──────────────────────────────────────────────
  readonly buckets = this.minioService.buckets;
  readonly objects = this.minioService.objects;
  readonly loading = this.minioService.loading;
  readonly objectsLoading = this.minioService.objectsLoading;
  readonly error = this.minioService.error;
  readonly selectedBucket = this.minioService.selectedBucket;
  readonly currentPrefix = this.minioService.currentPrefix;
  readonly storageStats = this.minioService.storageStats;
  readonly selectedObject = this.minioService.selectedObject;
  readonly uploadInProgress = this.minioService.uploadInProgress;
  readonly directories = this.minioService.directories;
  readonly files = this.minioService.files;
  readonly breadcrumbs = this.minioService.breadcrumbs;
  readonly isPreviewable = this.minioService.isPreviewable;

  readonly lastRefreshed = signal<Date | null>(null);
  readonly confirmingDelete = signal<string | null>(null);
  readonly view = signal<'buckets' | 'objects'>('buckets');

  // ── Computed KPIs ──────────────────────────────────────
  readonly totalBuckets = this.minioService.totalBuckets;
  readonly currentObjectCount = this.minioService.currentObjectCount;

  readonly totalSizeDisplay = computed(
    () => this.storageStats()?.totalSizeDisplay ?? '--',
  );

  readonly diskUsage = computed(
    () => this.storageStats()?.diskUsagePercent ?? 0,
  );

  readonly diskUsageClass = computed(() => {
    const pct = this.diskUsage();
    if (pct >= 90) return 'disk-critical';
    if (pct >= 75) return 'disk-warning';
    return 'disk-healthy';
  });

  // ── Lifecycle ──────────────────────────────────────────
  ngOnInit(): void {
    this.minioService.loadBuckets();
    this.minioService.loadStorageStats();
    this.lastRefreshed.set(new Date());
    this.refreshTimer = setInterval(() => {
      this.minioService.loadStorageStats();
    }, 60_000);
  }

  ngOnDestroy(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // ── Actions ────────────────────────────────────────────
  onSelectBucket(bucket: MinioBucket): void {
    this.view.set('objects');
    this.minioService.loadObjects(bucket.name);
  }

  onBackToBuckets(): void {
    this.view.set('buckets');
    this.minioService.clearSelection();
    this.confirmingDelete.set(null);
  }

  onNavigatePrefix(prefix: string): void {
    this.minioService.navigateToPrefix(prefix);
  }

  onNavigateUp(): void {
    this.minioService.navigateUp();
  }

  onNavigateBreadcrumb(index: number): void {
    const parts = this.breadcrumbs().slice(0, index + 1);
    const prefix = parts.join('/') + '/';
    this.minioService.navigateToPrefix(prefix);
  }

  onSelectObject(obj: MinioObjectDetail): void {
    if (obj.isDirectory) {
      this.minioService.navigateToPrefix(obj.name);
    } else {
      const bucket = this.selectedBucket();
      if (bucket) {
        this.minioService.loadObjectDetail(bucket, obj.name);
      }
    }
  }

  onCloseDetail(): void {
    this.minioService.clearSelection();
    this.confirmingDelete.set(null);
  }

  onDownload(obj: MinioObjectDetail): void {
    const bucket = this.selectedBucket();
    if (!bucket) return;
    const url = this.minioService.getDownloadUrl(bucket, obj.name);
    window.open(url, '_blank');
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const bucket = this.selectedBucket();
    if (!bucket) return;

    this.minioService
      .uploadObject(bucket, this.currentPrefix(), file)
      .subscribe();

    input.value = '';
  }

  onConfirmDelete(objectName: string): void {
    this.confirmingDelete.set(objectName);
  }

  onCancelDelete(): void {
    this.confirmingDelete.set(null);
  }

  onDeleteObject(objectName: string): void {
    const bucket = this.selectedBucket();
    if (!bucket) return;
    this.minioService.deleteObject(bucket, objectName).subscribe({
      next: () => this.confirmingDelete.set(null),
      error: () => this.confirmingDelete.set(null),
    });
  }

  onRefresh(): void {
    if (this.view() === 'buckets') {
      this.minioService.loadBuckets();
    } else {
      const bucket = this.selectedBucket();
      if (bucket) {
        this.minioService.loadObjects(bucket, this.currentPrefix());
      }
    }
    this.minioService.loadStorageStats();
    this.lastRefreshed.set(new Date());
  }

  onDismissError(): void {
    this.minioService.clearError();
  }

  // ── Template helpers ───────────────────────────────────
  trackByBucket(_: number, bucket: MinioBucket): string {
    return bucket.name;
  }

  trackByObject(_: number, obj: MinioObjectDetail): string {
    return obj.name;
  }

  trackByBreadcrumb(_: number, crumb: string): string {
    return crumb;
  }

  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
  }

  fileIcon(contentType: string): string {
    if (contentType.startsWith('image/')) return 'image';
    if (contentType === 'application/pdf') return 'picture_as_pdf';
    if (contentType.startsWith('text/')) return 'description';
    if (contentType.startsWith('video/')) return 'videocam';
    if (contentType.startsWith('audio/')) return 'audiotrack';
    if (contentType.includes('zip') || contentType.includes('tar') || contentType.includes('gzip'))
      return 'archive';
    if (contentType.includes('json') || contentType.includes('xml'))
      return 'data_object';
    return 'insert_drive_file';
  }

  fileName(fullPath: string): string {
    const parts = fullPath.split('/');
    return parts[parts.length - 1] || parts[parts.length - 2] || fullPath;
  }
}
