import {
  Component,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  RankingService,
  RankingProfile,
  RankingWeight,
  RankingPreviewHit,
  PositionChange,
} from './ranking.service';

@Component({
  selector: 'app-ranking',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ranking.component.html',
  styleUrl: './ranking.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RankingComponent implements OnInit, OnDestroy {
  private readonly svc = inject(RankingService);

  // ---------- delegated from service ----------
  readonly profiles = this.svc.profiles;
  readonly selectedProfile = this.svc.selectedProfile;
  readonly config = this.svc.config;
  readonly previewResult = this.svc.previewResult;
  readonly comparisonResult = this.svc.comparisonResult;
  readonly loading = this.svc.loading;
  readonly previewLoading = this.svc.previewLoading;
  readonly error = this.svc.error;
  readonly weightEntries = this.svc.weightEntries;
  readonly hasUnsavedChanges = this.svc.hasUnsavedChanges;
  readonly comparisonProfiles = this.svc.comparisonProfiles;
  readonly activeProfiles = this.svc.activeProfiles;
  readonly defaultProfile = this.svc.defaultProfile;

  // ---------- local UI state ----------
  readonly activeTab = signal<'weights' | 'preview' | 'compare'>('weights');
  readonly previewQueryInput = signal('');
  readonly previewIndexInput = signal('');
  readonly compareProfileInput = signal('');

  // ---------- computed ----------
  readonly profileCards = computed(() => {
    return this.profiles().map((p) => ({
      ...p,
      weightCount: Object.keys(p.weights).length,
      boostCount: p.boostFields.length,
      penaltyCount: p.penaltyFields.length,
    }));
  });

  readonly previewHits = computed(() => {
    const result = this.previewResult();
    return result?.hits ?? [];
  });

  readonly comparisonHitsA = computed(() => {
    const result = this.comparisonResult();
    return result?.hitsA ?? [];
  });

  readonly comparisonHitsB = computed(() => {
    const result = this.comparisonResult();
    return result?.hitsB ?? [];
  });

  readonly positionChanges = computed(() => {
    const result = this.comparisonResult();
    return result?.positionChanges ?? [];
  });

  readonly overlapPercent = computed(() => {
    const result = this.comparisonResult();
    return result?.overlapPercent ?? 0;
  });

  readonly significantChanges = computed(() => {
    return this.positionChanges().filter((c) => Math.abs(c.delta) >= 3);
  });

  // ---------- lifecycle ----------
  ngOnInit(): void {
    this.svc.loadProfiles();
    this.svc.loadConfig();
  }

  ngOnDestroy(): void {
    this.svc.clearPreview();
    this.svc.clearError();
  }

  // ---------- actions ----------
  onSelectProfile(profile: RankingProfile): void {
    this.svc.selectProfile(profile);
    this.activeTab.set('weights');
  }

  onDeselectProfile(): void {
    this.svc.selectProfile(null);
  }

  onWeightChange(field: string, event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    if (!isNaN(value)) {
      this.svc.setWeight(field, value);
    }
  }

  onRevertWeights(): void {
    this.svc.revertWeights();
  }

  onSetTab(tab: 'weights' | 'preview' | 'compare'): void {
    this.activeTab.set(tab);
  }

  onPreview(): void {
    this.svc.setPreviewQuery(this.previewQueryInput());
    this.svc.setPreviewIndex(this.previewIndexInput());
    this.svc.previewRanking();
  }

  onPreviewKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.onPreview();
    }
  }

  onCompareProfileChange(profileId: string): void {
    this.compareProfileInput.set(profileId);
    this.svc.setCompareProfile(profileId || null);
  }

  onRunComparison(): void {
    this.svc.setPreviewQuery(this.previewQueryInput());
    this.svc.setPreviewIndex(this.previewIndexInput());
    this.svc.runComparison();
  }

  onDismissError(): void {
    this.svc.clearError();
  }

  // ---------- template helpers ----------
  profileStatusClass(profile: RankingProfile): string {
    if (profile.isDefault) return 'profile-default';
    if (profile.isActive) return 'profile-active';
    return 'profile-inactive';
  }

  profileStatusLabel(profile: RankingProfile): string {
    if (profile.isDefault) return 'Default';
    if (profile.isActive) return 'Active';
    return 'Inactive';
  }

  scoreBarWidth(score: number, maxScore: number): string {
    if (maxScore <= 0) return '0%';
    return Math.round((score / maxScore) * 100) + '%';
  }

  deltaClass(delta: number): string {
    if (delta > 0) return 'delta-down';
    if (delta < 0) return 'delta-up';
    return 'delta-same';
  }

  deltaIcon(delta: number): string {
    if (delta > 0) return 'arrow_downward';
    if (delta < 0) return 'arrow_upward';
    return 'remove';
  }

  trackByProfileId(_: number, profile: RankingProfile): string {
    return profile.id;
  }

  trackByField(_: number, entry: RankingWeight): string {
    return entry.field;
  }

  trackByHitId(_: number, hit: RankingPreviewHit): string {
    return hit.id;
  }

  trackByDocId(_: number, change: PositionChange): string {
    return change.documentId;
  }
}
