import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import {
  Observable,
  catchError,
  throwError,
  tap,
  finalize,
} from 'rxjs';

// ---------- DTOs ----------

export interface RankingProfile {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  isActive: boolean;
  weights: Record<string, number>;
  boostFields: string[];
  penaltyFields: string[];
  decayFunction: string | null;
  decayScale: number | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface RankingWeight {
  field: string;
  weight: number;
  description: string;
  min: number;
  max: number;
  step: number;
}

export interface RankingPreviewRequest {
  profileId: string;
  query: string;
  index: string;
  limit: number;
}

export interface RankingPreviewHit {
  id: string;
  title: string;
  score: number;
  boostApplied: number;
  penaltyApplied: number;
  decayMultiplier: number;
  finalScore: number;
  fields: Record<string, unknown>;
}

export interface RankingPreviewResponse {
  profileId: string;
  profileName: string;
  query: string;
  hits: RankingPreviewHit[];
  tookMs: number;
  totalHits: number;
}

export interface ABTestComparison {
  profileAId: string;
  profileAName: string;
  profileBId: string;
  profileBName: string;
  query: string;
  hitsA: RankingPreviewHit[];
  hitsB: RankingPreviewHit[];
  overlapPercent: number;
  positionChanges: PositionChange[];
  tookMs: number;
}

export interface PositionChange {
  documentId: string;
  title: string;
  positionA: number;
  positionB: number;
  delta: number;
}

export interface RankingConfig {
  availableDecayFunctions: string[];
  weightableFields: RankingWeight[];
  boostableFields: string[];
  penaltyFields: string[];
}

// ---------- Service ----------

const API_BASE = '/api/geo/ranking';

@Injectable({ providedIn: 'root' })
export class RankingService {
  private readonly http = inject(HttpClient);

  // ---------- state signals ----------
  readonly profiles = signal<RankingProfile[]>([]);
  readonly selectedProfile = signal<RankingProfile | null>(null);
  readonly config = signal<RankingConfig | null>(null);
  readonly previewResult = signal<RankingPreviewResponse | null>(null);
  readonly comparisonResult = signal<ABTestComparison | null>(null);
  readonly loading = signal(false);
  readonly previewLoading = signal(false);
  readonly error = signal<string | null>(null);

  // editing state
  readonly editingWeights = signal<Record<string, number>>({});
  readonly previewQuery = signal('');
  readonly previewIndex = signal('');
  readonly compareProfileId = signal<string | null>(null);

  // ---------- computed ----------
  readonly activeProfiles = computed(
    () => this.profiles().filter((p) => p.isActive),
  );

  readonly defaultProfile = computed(
    () => this.profiles().find((p) => p.isDefault) ?? null,
  );

  readonly profileCount = computed(() => this.profiles().length);

  readonly hasUnsavedChanges = computed(() => {
    const selected = this.selectedProfile();
    if (!selected) return false;
    const editing = this.editingWeights();
    return Object.keys(editing).some(
      (key) => editing[key] !== (selected.weights[key] ?? 0),
    );
  });

  readonly weightEntries = computed(() => {
    const weights = this.editingWeights();
    const cfg = this.config();
    if (!cfg) return [];
    return cfg.weightableFields.map((f) => ({
      ...f,
      weight: weights[f.field] ?? f.weight,
    }));
  });

  readonly comparisonProfiles = computed(() => {
    const selected = this.selectedProfile();
    return this.profiles().filter((p) => p.id !== selected?.id);
  });

  // ---------- commands ----------

  /** Load all ranking profiles. */
  loadProfiles(): void {
    this.loading.set(true);
    this.error.set(null);

    this.http
      .get<RankingProfile[]>(`${API_BASE}/profiles`)
      .pipe(
        tap((profiles) => this.profiles.set(profiles)),
        catchError((err) => {
          this.error.set('Failed to load ranking profiles.');
          return throwError(() => err);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  /** Load ranking configuration (field definitions). */
  loadConfig(): void {
    this.http
      .get<RankingConfig>(`${API_BASE}/config`)
      .pipe(
        tap((cfg) => this.config.set(cfg)),
        catchError((err) => {
          this.error.set('Failed to load ranking configuration.');
          return throwError(() => err);
        }),
      )
      .subscribe();
  }

  /** Select a profile for editing/viewing. */
  selectProfile(profile: RankingProfile | null): void {
    this.selectedProfile.set(profile);
    if (profile) {
      this.editingWeights.set({ ...profile.weights });
    } else {
      this.editingWeights.set({});
    }
    this.previewResult.set(null);
    this.comparisonResult.set(null);
  }

  /** Update a weight value in the editing state. */
  setWeight(field: string, value: number): void {
    this.editingWeights.update((w) => ({ ...w, [field]: value }));
  }

  /** Preview ranking with current editing weights. */
  previewRanking(): void {
    const profile = this.selectedProfile();
    const query = this.previewQuery().trim();
    if (!profile || !query) return;

    this.previewLoading.set(true);

    const request: RankingPreviewRequest = {
      profileId: profile.id,
      query,
      index: this.previewIndex() || '_all',
      limit: 20,
    };

    this.http
      .post<RankingPreviewResponse>(`${API_BASE}/preview`, {
        ...request,
        weights: this.editingWeights(),
      })
      .pipe(
        tap((res) => this.previewResult.set(res)),
        catchError((err) => {
          this.error.set('Ranking preview failed.');
          return throwError(() => err);
        }),
        finalize(() => this.previewLoading.set(false)),
      )
      .subscribe();
  }

  /** Run A/B comparison between selected profile and another. */
  runComparison(): void {
    const profile = this.selectedProfile();
    const compareId = this.compareProfileId();
    const query = this.previewQuery().trim();
    if (!profile || !compareId || !query) return;

    this.previewLoading.set(true);

    const params = new HttpParams()
      .set('profileAId', profile.id)
      .set('profileBId', compareId)
      .set('query', query)
      .set('index', this.previewIndex() || '_all')
      .set('limit', '20');

    this.http
      .get<ABTestComparison>(`${API_BASE}/compare`, { params })
      .pipe(
        tap((res) => this.comparisonResult.set(res)),
        catchError((err) => {
          this.error.set('A/B comparison failed.');
          return throwError(() => err);
        }),
        finalize(() => this.previewLoading.set(false)),
      )
      .subscribe();
  }

  /** Set the profile to compare against. */
  setCompareProfile(profileId: string | null): void {
    this.compareProfileId.set(profileId);
    this.comparisonResult.set(null);
  }

  setPreviewQuery(query: string): void {
    this.previewQuery.set(query);
  }

  setPreviewIndex(index: string): void {
    this.previewIndex.set(index);
  }

  clearPreview(): void {
    this.previewResult.set(null);
    this.comparisonResult.set(null);
  }

  clearError(): void {
    this.error.set(null);
  }

  /** Revert editing weights to saved profile weights. */
  revertWeights(): void {
    const profile = this.selectedProfile();
    if (profile) {
      this.editingWeights.set({ ...profile.weights });
    }
  }
}
