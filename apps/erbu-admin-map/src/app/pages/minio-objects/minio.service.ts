import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, tap, throwError, finalize } from 'rxjs';
import {
  DevToolsService,
  MinioObject,
} from '@erbu-admin-web/shared/data-access';

// ── Models ──────────────────────────────────────────────────

export interface MinioBucket {
  name: string;
  creationDate: string;
  region: string;
  objectCount: number;
  totalSizeBytes: number;
  totalSizeDisplay: string;
  versioningEnabled: boolean;
}

export interface MinioObjectDetail {
  name: string;
  size: number;
  sizeDisplay: string;
  lastModified: string;
  contentType: string;
  etag: string;
  isDirectory: boolean;
  metadata: Record<string, string>;
  versionId: string | null;
  previewUrl: string | null;
}

export interface MinioUploadResult {
  objectName: string;
  bucket: string;
  etag: string;
  versionId: string | null;
  sizeBytes: number;
}

export interface MinioStorageStats {
  totalBuckets: number;
  totalObjects: number;
  totalSizeBytes: number;
  totalSizeDisplay: string;
  serverVersion: string;
  serverUptime: string;
  diskUsagePercent: number;
}

// ── Service ─────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class MinioService {
  private readonly http = inject(HttpClient);
  private readonly devTools = inject(DevToolsService);
  private readonly baseUrl = '/api/devtools/minio';

  // ── State signals ──────────────────────────────────────
  readonly buckets = signal<MinioBucket[]>([]);
  readonly objects = signal<MinioObjectDetail[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly selectedBucket = signal<string | null>(null);
  readonly currentPrefix = signal('');
  readonly storageStats = signal<MinioStorageStats | null>(null);
  readonly objectsLoading = signal(false);
  readonly uploadInProgress = signal(false);
  readonly selectedObject = signal<MinioObjectDetail | null>(null);

  // ── Computed ───────────────────────────────────────────
  readonly totalBuckets = computed(() => this.buckets().length);
  readonly currentObjectCount = computed(() => this.objects().length);

  readonly breadcrumbs = computed((): string[] => {
    const prefix = this.currentPrefix();
    if (!prefix) return [];
    return prefix.split('/').filter((s) => s.length > 0);
  });

  readonly directories = computed(() =>
    this.objects().filter((o) => o.isDirectory),
  );

  readonly files = computed(() =>
    this.objects().filter((o) => !o.isDirectory),
  );

  readonly isPreviewable = computed(() => {
    const obj = this.selectedObject();
    if (!obj) return false;
    const ct = obj.contentType.toLowerCase();
    return (
      ct.startsWith('image/') ||
      ct === 'application/pdf' ||
      ct.startsWith('text/')
    );
  });

  // ── Buckets ────────────────────────────────────────────
  loadBuckets(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http
      .get<MinioBucket[]>(`${this.baseUrl}/buckets`)
      .pipe(
        tap((data) => this.buckets.set(data)),
        catchError((err) => {
          this.error.set('Failed to load buckets.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  // ── Objects ────────────────────────────────────────────
  loadObjects(bucket: string, prefix = ''): void {
    this.objectsLoading.set(true);
    this.selectedBucket.set(bucket);
    this.currentPrefix.set(prefix);
    this.selectedObject.set(null);

    this.http
      .get<MinioObjectDetail[]>(`${this.baseUrl}/objects`, {
        params: { bucket, prefix },
      })
      .pipe(
        tap((data) => this.objects.set(data)),
        catchError((err) => {
          this.error.set('Failed to load objects.');
          return throwError(() => err);
        }),
        finalize(() => this.objectsLoading.set(false)),
      )
      .subscribe();
  }

  // ── Object detail ──────────────────────────────────────
  loadObjectDetail(bucket: string, objectName: string): void {
    this.http
      .get<MinioObjectDetail>(`${this.baseUrl}/object`, {
        params: { bucket, name: objectName },
      })
      .pipe(
        tap((data) => this.selectedObject.set(data)),
        catchError((err) => {
          this.error.set('Failed to load object details.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  // ── Download ───────────────────────────────────────────
  getDownloadUrl(bucket: string, objectName: string): string {
    return `${this.baseUrl}/download?bucket=${encodeURIComponent(bucket)}&name=${encodeURIComponent(objectName)}`;
  }

  // ── Upload ─────────────────────────────────────────────
  uploadObject(
    bucket: string,
    prefix: string,
    file: File,
  ): Observable<MinioUploadResult> {
    this.uploadInProgress.set(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bucket', bucket);
    formData.append('prefix', prefix);

    return this.http
      .post<MinioUploadResult>(`${this.baseUrl}/upload`, formData)
      .pipe(
        tap(() => {
          // Reload objects after upload
          this.loadObjects(bucket, prefix);
        }),
        catchError((err) => {
          this.error.set('Failed to upload object.');
          return throwError(() => err);
        }),
        finalize(() => this.uploadInProgress.set(false)),
      );
  }

  // ── Delete ─────────────────────────────────────────────
  deleteObject(bucket: string, objectName: string): Observable<void> {
    return this.http
      .delete<void>(`${this.baseUrl}/object`, {
        params: { bucket, name: objectName },
      })
      .pipe(
        tap(() => {
          this.objects.update((list) =>
            list.filter((o) => o.name !== objectName),
          );
          if (this.selectedObject()?.name === objectName) {
            this.selectedObject.set(null);
          }
        }),
        catchError((err) => {
          this.error.set('Failed to delete object.');
          return throwError(() => err);
        }),
      );
  }

  // ── Storage stats ──────────────────────────────────────
  loadStorageStats(): void {
    this.http
      .get<MinioStorageStats>(`${this.baseUrl}/stats`)
      .pipe(
        tap((data) => this.storageStats.set(data)),
        catchError((err) => {
          this.error.set('Failed to load storage stats.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  // ── Navigation ─────────────────────────────────────────
  navigateToPrefix(prefix: string): void {
    const bucket = this.selectedBucket();
    if (bucket) {
      this.loadObjects(bucket, prefix);
    }
  }

  navigateUp(): void {
    const prefix = this.currentPrefix();
    const parts = prefix.split('/').filter((s) => s.length > 0);
    parts.pop();
    const newPrefix = parts.length > 0 ? parts.join('/') + '/' : '';
    const bucket = this.selectedBucket();
    if (bucket) {
      this.loadObjects(bucket, newPrefix);
    }
  }

  // ── Helpers ────────────────────────────────────────────
  clearSelection(): void {
    this.selectedObject.set(null);
  }

  clearError(): void {
    this.error.set(null);
  }
}
