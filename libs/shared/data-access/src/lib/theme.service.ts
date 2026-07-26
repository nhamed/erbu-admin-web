import { Injectable, signal, effect } from '@angular/core';

export type Theme = 'dark' | 'light' | 'high-contrast';

interface ThemeProperties {
  '--bg-primary': string;
  '--bg-secondary': string;
  '--bg-tertiary': string;
  '--bg-surface': string;
  '--bg-elevated': string;
  '--text-primary': string;
  '--text-secondary': string;
  '--text-muted': string;
  '--text-inverse': string;
  '--border-default': string;
  '--border-strong': string;
  '--accent-primary': string;
  '--accent-hover': string;
  '--accent-active': string;
  '--status-success': string;
  '--status-warning': string;
  '--status-error': string;
  '--status-info': string;
  '--shadow-sm': string;
  '--shadow-md': string;
  '--shadow-lg': string;
  '--sidebar-bg': string;
  '--header-bg': string;
  '--map-overlay-bg': string;
}

const THEME_KEY = 'erbu_theme';

const themes: Record<Theme, ThemeProperties> = {
  dark: {
    '--bg-primary': '#0f1117',
    '--bg-secondary': '#161822',
    '--bg-tertiary': '#1e2030',
    '--bg-surface': '#242738',
    '--bg-elevated': '#2a2d42',
    '--text-primary': '#e4e6f0',
    '--text-secondary': '#a0a4b8',
    '--text-muted': '#6b6f82',
    '--text-inverse': '#0f1117',
    '--border-default': '#2e3148',
    '--border-strong': '#3e4260',
    '--accent-primary': '#6366f1',
    '--accent-hover': '#818cf8',
    '--accent-active': '#4f46e5',
    '--status-success': '#22c55e',
    '--status-warning': '#f59e0b',
    '--status-error': '#ef4444',
    '--status-info': '#3b82f6',
    '--shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.4)',
    '--shadow-md': '0 4px 6px rgba(0, 0, 0, 0.4)',
    '--shadow-lg': '0 10px 15px rgba(0, 0, 0, 0.5)',
    '--sidebar-bg': '#0d0f18',
    '--header-bg': '#13151f',
    '--map-overlay-bg': 'rgba(15, 17, 23, 0.85)',
  },
  light: {
    '--bg-primary': '#ffffff',
    '--bg-secondary': '#f8f9fa',
    '--bg-tertiary': '#f1f3f5',
    '--bg-surface': '#ffffff',
    '--bg-elevated': '#ffffff',
    '--text-primary': '#1a1b1e',
    '--text-secondary': '#495057',
    '--text-muted': '#868e96',
    '--text-inverse': '#ffffff',
    '--border-default': '#dee2e6',
    '--border-strong': '#adb5bd',
    '--accent-primary': '#4f46e5',
    '--accent-hover': '#6366f1',
    '--accent-active': '#4338ca',
    '--status-success': '#16a34a',
    '--status-warning': '#d97706',
    '--status-error': '#dc2626',
    '--status-info': '#2563eb',
    '--shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.05)',
    '--shadow-md': '0 4px 6px rgba(0, 0, 0, 0.07)',
    '--shadow-lg': '0 10px 15px rgba(0, 0, 0, 0.1)',
    '--sidebar-bg': '#f8f9fa',
    '--header-bg': '#ffffff',
    '--map-overlay-bg': 'rgba(255, 255, 255, 0.9)',
  },
  'high-contrast': {
    '--bg-primary': '#000000',
    '--bg-secondary': '#0a0a0a',
    '--bg-tertiary': '#141414',
    '--bg-surface': '#1a1a1a',
    '--bg-elevated': '#222222',
    '--text-primary': '#ffffff',
    '--text-secondary': '#e0e0e0',
    '--text-muted': '#b0b0b0',
    '--text-inverse': '#000000',
    '--border-default': '#555555',
    '--border-strong': '#888888',
    '--accent-primary': '#ffcc00',
    '--accent-hover': '#ffe066',
    '--accent-active': '#e6b800',
    '--status-success': '#00ff41',
    '--status-warning': '#ffaa00',
    '--status-error': '#ff3333',
    '--status-info': '#00bfff',
    '--shadow-sm': '0 1px 2px rgba(255, 255, 255, 0.1)',
    '--shadow-md': '0 4px 6px rgba(255, 255, 255, 0.1)',
    '--shadow-lg': '0 10px 15px rgba(255, 255, 255, 0.15)',
    '--sidebar-bg': '#000000',
    '--header-bg': '#0a0a0a',
    '--map-overlay-bg': 'rgba(0, 0, 0, 0.95)',
  },
};

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _currentTheme = signal<Theme>(this.loadStoredTheme());

  readonly currentTheme = this._currentTheme.asReadonly();

  constructor() {
    effect(() => {
      const theme = this._currentTheme();
      this.applyTheme(theme);
      localStorage.setItem(THEME_KEY, theme);
    });
  }

  setTheme(theme: Theme): void {
    this._currentTheme.set(theme);
  }

  cycleTheme(): void {
    const order: Theme[] = ['dark', 'light', 'high-contrast'];
    const currentIndex = order.indexOf(this._currentTheme());
    const nextIndex = (currentIndex + 1) % order.length;
    this._currentTheme.set(order[nextIndex]);
  }

  getThemeProperties(theme?: Theme): ThemeProperties {
    return themes[theme ?? this._currentTheme()];
  }

  private applyTheme(theme: Theme): void {
    const properties = themes[theme];
    const root = document.documentElement;

    for (const [property, value] of Object.entries(properties)) {
      root.style.setProperty(property, value);
    }

    root.setAttribute('data-theme', theme);

    root.classList.remove('theme-dark', 'theme-light', 'theme-high-contrast');
    root.classList.add(`theme-${theme}`);
  }

  private loadStoredTheme(): Theme {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'dark' || stored === 'light' || stored === 'high-contrast') {
      return stored;
    }
    return 'dark';
  }
}
