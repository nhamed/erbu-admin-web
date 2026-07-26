import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { UserProfile, TokenResponse } from '@erbu-admin-web/shared/models';
import { Environment } from './environment';

const TOKEN_KEY = 'erbu_access_token';
const REFRESH_TOKEN_KEY = 'erbu_refresh_token';
const USER_PROFILE_KEY = 'erbu_user_profile';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly environment = inject<Environment>('ENVIRONMENT' as never);

  private readonly _userProfile = signal<UserProfile | null>(this.loadStoredProfile());
  private readonly _isAuthenticated = signal<boolean>(this.hasStoredToken());
  private readonly _isLoading = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);

  readonly userProfile = this._userProfile.asReadonly();
  readonly isAuthenticated = this._isAuthenticated.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly displayName = computed(() => this._userProfile()?.displayName ?? '');
  readonly role = computed(() => this._userProfile()?.role ?? null);

  private refreshTimer: ReturnType<typeof setTimeout> | null = null;

  async login(): Promise<void> {
    const { oidcConfig } = this.environment;
    const state = crypto.randomUUID();
    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = await this.generateCodeChallenge(codeVerifier);

    sessionStorage.setItem('oidc_code_verifier', codeVerifier);
    sessionStorage.setItem('oidc_state', state);

    const params = new URLSearchParams({
      response_type: oidcConfig.responseType,
      client_id: oidcConfig.clientId,
      redirect_uri: oidcConfig.redirectUri,
      scope: oidcConfig.scope,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    window.location.href = `${oidcConfig.authority}/connect/authorize?${params.toString()}`;
  }

  async handleCallback(code: string, state: string): Promise<void> {
    const storedState = sessionStorage.getItem('oidc_state');
    if (state !== storedState) {
      this._error.set('Invalid OIDC state parameter');
      throw new Error('Invalid OIDC state parameter');
    }

    const codeVerifier = sessionStorage.getItem('oidc_code_verifier');
    if (!codeVerifier) {
      this._error.set('Missing PKCE code verifier');
      throw new Error('Missing PKCE code verifier');
    }

    this._isLoading.set(true);
    this._error.set(null);

    try {
      const { oidcConfig } = this.environment;

      const tokenResponse = await firstValueFrom(
        this.http.post<TokenResponse>(
          `${oidcConfig.authority}/connect/token`,
          new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: oidcConfig.redirectUri,
            client_id: oidcConfig.clientId,
            code_verifier: codeVerifier,
          }).toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        ),
      );

      this.storeTokens(tokenResponse);
      await this.fetchUserProfile();
      this.scheduleTokenRefresh(tokenResponse.expiresIn);
      this._isAuthenticated.set(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      this._error.set(message);
      throw err;
    } finally {
      this._isLoading.set(false);
      sessionStorage.removeItem('oidc_code_verifier');
      sessionStorage.removeItem('oidc_state');
    }
  }

  async logout(): Promise<void> {
    const { oidcConfig } = this.environment;

    this.clearTokens();
    this._userProfile.set(null);
    this._isAuthenticated.set(false);
    this._error.set(null);

    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }

    const params = new URLSearchParams({
      post_logout_redirect_uri: oidcConfig.postLogoutRedirectUri,
      client_id: oidcConfig.clientId,
    });

    window.location.href = `${oidcConfig.authority}/connect/endsession?${params.toString()}`;
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  async refreshToken(): Promise<void> {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    if (!refreshToken) {
      await this.logout();
      return;
    }

    try {
      const { oidcConfig } = this.environment;

      const tokenResponse = await firstValueFrom(
        this.http.post<TokenResponse>(
          `${oidcConfig.authority}/connect/token`,
          new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: oidcConfig.clientId,
          }).toString(),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        ),
      );

      this.storeTokens(tokenResponse);
      this.scheduleTokenRefresh(tokenResponse.expiresIn);
    } catch {
      await this.logout();
    }
  }

  async initializeFromStorage(): Promise<void> {
    const token = this.getToken();
    if (!token) {
      return;
    }

    if (this.isTokenExpired(token)) {
      await this.refreshToken();
    } else {
      this._isAuthenticated.set(true);
      await this.fetchUserProfile();

      const payload = this.decodeTokenPayload(token);
      if (payload?.['exp']) {
        const expiresIn = (payload['exp'] as number) - Math.floor(Date.now() / 1000);
        this.scheduleTokenRefresh(expiresIn);
      }
    }
  }

  private async fetchUserProfile(): Promise<void> {
    try {
      const profile = await firstValueFrom(
        this.http.get<UserProfile>(`${this.environment.gatewayUrl}/api/auth/me`),
      );
      this._userProfile.set(profile);
      localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
    } catch {
      // Profile fetch failed; keep stored profile if available
    }
  }

  private scheduleTokenRefresh(expiresInSeconds: number): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    const refreshAt = Math.max((expiresInSeconds - 60) * 1000, 10_000);
    this.refreshTimer = setTimeout(() => this.refreshToken(), refreshAt);
  }

  private storeTokens(response: TokenResponse): void {
    localStorage.setItem(TOKEN_KEY, response.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
  }

  private clearTokens(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_PROFILE_KEY);
  }

  private loadStoredProfile(): UserProfile | null {
    try {
      const stored = localStorage.getItem(USER_PROFILE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  private hasStoredToken(): boolean {
    const token = localStorage.getItem(TOKEN_KEY);
    return token !== null && !this.isTokenExpired(token);
  }

  private isTokenExpired(token: string): boolean {
    const payload = this.decodeTokenPayload(token);
    if (!payload?.['exp']) return true;
    return (payload['exp'] as number) < Math.floor(Date.now() / 1000);
  }

  private decodeTokenPayload(token: string): Record<string, unknown> | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }

  private generateCodeVerifier(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return this.base64UrlEncode(array);
  }

  private async generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return this.base64UrlEncode(new Uint8Array(digest));
  }

  private base64UrlEncode(buffer: Uint8Array): string {
    let binary = '';
    for (const byte of buffer) {
      binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}
