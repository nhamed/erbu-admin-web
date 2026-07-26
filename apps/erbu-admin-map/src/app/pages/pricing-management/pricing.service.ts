import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// ---------- DTOs ----------

export type PricingRuleType =
  | 'base-fare'
  | 'per-km'
  | 'per-minute'
  | 'surge'
  | 'zone'
  | 'time-of-day'
  | 'ab-test';

export type PricingRuleStatus = 'active' | 'draft' | 'disabled' | 'expired';

export interface PricingRule {
  id: string;
  name: string;
  type: PricingRuleType;
  status: PricingRuleStatus;
  description: string;
  currency: string;
  value: number;
  minValue: number | null;
  maxValue: number | null;
  priority: number;
  zoneId: string | null;
  zoneName: string | null;
  startTime: string | null;
  endTime: string | null;
  daysOfWeek: number[];
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface PricingRuleFormData {
  name: string;
  type: PricingRuleType;
  status: PricingRuleStatus;
  description: string;
  currency: string;
  value: number;
  minValue: number | null;
  maxValue: number | null;
  priority: number;
  zoneId: string | null;
  startTime: string | null;
  endTime: string | null;
  daysOfWeek: number[];
  validFrom: string | null;
  validUntil: string | null;
}

export interface SurgeConfig {
  id: string;
  zoneId: string;
  zoneName: string;
  baseMultiplier: number;
  maxMultiplier: number;
  demandThreshold: number;
  supplyThreshold: number;
  cooldownMinutes: number;
  isActive: boolean;
  currentMultiplier: number;
  currentDemand: number;
  currentSupply: number;
  updatedAt: string;
}

export interface SurgeConfigUpdate {
  baseMultiplier: number;
  maxMultiplier: number;
  demandThreshold: number;
  supplyThreshold: number;
  cooldownMinutes: number;
  isActive: boolean;
}

export interface PricingZone {
  id: string;
  name: string;
  description: string;
  polygon: Array<{ lat: number; lng: number }>;
  isActive: boolean;
  ruleCount: number;
}

export interface AbTestConfig {
  id: string;
  name: string;
  description: string;
  status: 'running' | 'paused' | 'completed' | 'draft';
  controlRuleId: string;
  controlRuleName: string;
  variantRuleId: string;
  variantRuleName: string;
  trafficSplitPercent: number;
  startDate: string;
  endDate: string | null;
  controlConversionRate: number;
  variantConversionRate: number;
  controlAvgFare: number;
  variantAvgFare: number;
  totalTrips: number;
  statisticalSignificance: number;
}

export interface PricingSimulation {
  distanceKm: number;
  durationMinutes: number;
  zoneId: string;
  timeOfDay: string;
  dayOfWeek: number;
  surgeMultiplier: number;
  baseFare: number;
  distanceCharge: number;
  timeCharge: number;
  surgeCharge: number;
  totalFare: number;
  appliedRules: string[];
}

// ---------- Service ----------

const API_BASE = '/api/admin/pricing';

@Injectable({ providedIn: 'root' })
export class PricingService {
  private readonly http = inject(HttpClient);

  /** Fetch all pricing rules. */
  fetchRules(type?: PricingRuleType, status?: PricingRuleStatus): Observable<PricingRule[]> {
    const params: Record<string, string> = {};
    if (type) params['type'] = type;
    if (status) params['status'] = status;
    return this.http.get<PricingRule[]>(`${API_BASE}/rules`, { params });
  }

  /** Get a single pricing rule by ID. */
  getRule(ruleId: string): Observable<PricingRule> {
    return this.http.get<PricingRule>(`${API_BASE}/rules/${ruleId}`);
  }

  /** Create a new pricing rule. */
  createRule(data: PricingRuleFormData): Observable<PricingRule> {
    return this.http.post<PricingRule>(`${API_BASE}/rules`, data);
  }

  /** Update an existing pricing rule. */
  updateRule(ruleId: string, data: PricingRuleFormData): Observable<PricingRule> {
    return this.http.put<PricingRule>(`${API_BASE}/rules/${ruleId}`, data);
  }

  /** Delete a pricing rule. */
  deleteRule(ruleId: string): Observable<void> {
    return this.http.delete<void>(`${API_BASE}/rules/${ruleId}`);
  }

  /** Fetch surge configurations for all zones. */
  fetchSurgeConfigs(): Observable<SurgeConfig[]> {
    return this.http.get<SurgeConfig[]>(`${API_BASE}/surge`);
  }

  /** Update surge config for a zone. */
  updateSurgeConfig(surgeId: string, data: SurgeConfigUpdate): Observable<SurgeConfig> {
    return this.http.put<SurgeConfig>(`${API_BASE}/surge/${surgeId}`, data);
  }

  /** Fetch pricing zones. */
  fetchZones(): Observable<PricingZone[]> {
    return this.http.get<PricingZone[]>(`${API_BASE}/zones`);
  }

  /** Fetch A/B test configurations. */
  fetchAbTests(): Observable<AbTestConfig[]> {
    return this.http.get<AbTestConfig[]>(`${API_BASE}/ab-tests`);
  }

  /** Create an A/B test. */
  createAbTest(data: Partial<AbTestConfig>): Observable<AbTestConfig> {
    return this.http.post<AbTestConfig>(`${API_BASE}/ab-tests`, data);
  }

  /** Pause or resume an A/B test. */
  toggleAbTest(testId: string, action: 'pause' | 'resume'): Observable<AbTestConfig> {
    return this.http.patch<AbTestConfig>(`${API_BASE}/ab-tests/${testId}/${action}`, {});
  }

  /** Simulate fare calculation. */
  simulateFare(params: {
    distanceKm: number;
    durationMinutes: number;
    zoneId: string;
    timeOfDay: string;
    dayOfWeek: number;
  }): Observable<PricingSimulation> {
    return this.http.post<PricingSimulation>(`${API_BASE}/simulate`, params);
  }
}
