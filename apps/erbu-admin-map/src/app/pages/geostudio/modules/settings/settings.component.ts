import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ThemeService, Theme } from '@erbu-admin-web/shared/data-access';

export type DisplayDensity = 'compact' | 'comfortable' | 'spacious';

export interface KeyboardShortcut {
  action: string;
  keys: string;
  category: string;
}

const SETTINGS_KEY = 'geo_studio_settings';

interface StoredSettings {
  defaultModule: string;
  density: DisplayDensity;
  notifyOnAlerts: boolean;
  notifyOnSloBreaches: boolean;
  notifyOnDeployments: boolean;
  notifyOnOverrideExpiry: boolean;
}

const DEFAULT_SETTINGS: StoredSettings = {
  defaultModule: 'monitor',
  density: 'comfortable',
  notifyOnAlerts: true,
  notifyOnSloBreaches: true,
  notifyOnDeployments: false,
  notifyOnOverrideExpiry: true,
};

@Component({
  selector: 'app-geostudio-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent implements OnInit {
  private readonly themeService = inject(ThemeService);

  // ---------- Theme ----------
  readonly currentTheme = this.themeService.currentTheme;
  readonly themeOptions: { value: Theme; label: string; icon: string }[] = [
    { value: 'dark', label: 'Dark', icon: 'dark_mode' },
    { value: 'light', label: 'Light', icon: 'light_mode' },
    { value: 'high-contrast', label: 'High Contrast', icon: 'contrast' },
  ];

  // ---------- Settings state ----------
  readonly defaultModule = signal<string>(DEFAULT_SETTINGS.defaultModule);
  readonly density = signal<DisplayDensity>(DEFAULT_SETTINGS.density);
  readonly notifyOnAlerts = signal(DEFAULT_SETTINGS.notifyOnAlerts);
  readonly notifyOnSloBreaches = signal(DEFAULT_SETTINGS.notifyOnSloBreaches);
  readonly notifyOnDeployments = signal(DEFAULT_SETTINGS.notifyOnDeployments);
  readonly notifyOnOverrideExpiry = signal(DEFAULT_SETTINGS.notifyOnOverrideExpiry);
  readonly saveConfirmation = signal(false);

  readonly densityOptions: { value: DisplayDensity; label: string; icon: string }[] = [
    { value: 'compact', label: 'Compact', icon: 'density_small' },
    { value: 'comfortable', label: 'Comfortable', icon: 'density_medium' },
    { value: 'spacious', label: 'Spacious', icon: 'density_large' },
  ];

  readonly moduleOptions: { value: string; label: string }[] = [
    { value: 'monitor', label: 'Monitor' },
    { value: 'search-explorer', label: 'Search Explorer' },
    { value: 'ingestion', label: 'Ingestion' },
    { value: 'collections', label: 'Collections' },
    { value: 'config', label: 'Config' },
    { value: 'infrastructure', label: 'Infrastructure' },
    { value: 'ranking', label: 'Ranking' },
    { value: 'quality', label: 'Quality' },
  ];

  // ---------- Keyboard shortcuts reference ----------
  readonly shortcuts: KeyboardShortcut[] = [
    { action: 'Open search', keys: 'Ctrl + K', category: 'Navigation' },
    { action: 'Switch module', keys: 'Ctrl + 1-9', category: 'Navigation' },
    { action: 'Go to dashboard', keys: 'Ctrl + D', category: 'Navigation' },
    { action: 'Toggle sidebar', keys: 'Ctrl + B', category: 'Navigation' },
    { action: 'Refresh data', keys: 'F5', category: 'General' },
    { action: 'Toggle theme', keys: 'Ctrl + Shift + T', category: 'General' },
    { action: 'Close dialog', keys: 'Escape', category: 'General' },
    { action: 'Save changes', keys: 'Ctrl + S', category: 'Editing' },
    { action: 'Undo', keys: 'Ctrl + Z', category: 'Editing' },
    { action: 'Copy selection', keys: 'Ctrl + C', category: 'Editing' },
  ];

  readonly shortcutCategories = computed(() => {
    const cats = new Set(this.shortcuts.map((s) => s.category));
    return Array.from(cats);
  });

  shortcutsByCategory(category: string): KeyboardShortcut[] {
    return this.shortcuts.filter((s) => s.category === category);
  }

  // ---------- Lifecycle ----------
  ngOnInit(): void {
    this.loadSettings();
  }

  // ---------- Theme ----------
  setTheme(theme: Theme): void {
    this.themeService.setTheme(theme);
  }

  // ---------- Settings persistence ----------
  onDefaultModuleChange(value: string): void {
    this.defaultModule.set(value);
    this.persistSettings();
  }

  onDensityChange(value: DisplayDensity): void {
    this.density.set(value);
    this.applyDensity(value);
    this.persistSettings();
  }

  onNotificationChange(key: keyof StoredSettings, value: boolean): void {
    switch (key) {
      case 'notifyOnAlerts':
        this.notifyOnAlerts.set(value);
        break;
      case 'notifyOnSloBreaches':
        this.notifyOnSloBreaches.set(value);
        break;
      case 'notifyOnDeployments':
        this.notifyOnDeployments.set(value);
        break;
      case 'notifyOnOverrideExpiry':
        this.notifyOnOverrideExpiry.set(value);
        break;
    }
    this.persistSettings();
  }

  // ---------- Internal ----------
  private persistSettings(): void {
    const settings: StoredSettings = {
      defaultModule: this.defaultModule(),
      density: this.density(),
      notifyOnAlerts: this.notifyOnAlerts(),
      notifyOnSloBreaches: this.notifyOnSloBreaches(),
      notifyOnDeployments: this.notifyOnDeployments(),
      notifyOnOverrideExpiry: this.notifyOnOverrideExpiry(),
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

    this.saveConfirmation.set(true);
    setTimeout(() => this.saveConfirmation.set(false), 2000);
  }

  private loadSettings(): void {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (!raw) return;
      const stored: StoredSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      this.defaultModule.set(stored.defaultModule);
      this.density.set(stored.density);
      this.notifyOnAlerts.set(stored.notifyOnAlerts);
      this.notifyOnSloBreaches.set(stored.notifyOnSloBreaches);
      this.notifyOnDeployments.set(stored.notifyOnDeployments);
      this.notifyOnOverrideExpiry.set(stored.notifyOnOverrideExpiry);
      this.applyDensity(stored.density);
    } catch {
      // ignore parse errors, use defaults
    }
  }

  private applyDensity(density: DisplayDensity): void {
    const root = document.documentElement;
    root.setAttribute('data-density', density);
  }
}
