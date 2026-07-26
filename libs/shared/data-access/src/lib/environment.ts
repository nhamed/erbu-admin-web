import { InjectionToken } from '@angular/core';

export interface OidcConfig {
  authority: string;
  clientId: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
  scope: string;
  responseType: string;
  silentRenew: boolean;
  silentRenewUrl: string;
  automaticSilentRenew: boolean;
  accessTokenExpiringNotificationTimeInSeconds: number;
}

export interface Environment {
  production: boolean;
  gatewayUrl: string;
  devToolsApiUrl: string;
  mapTilerKey: string;
  oidcConfig: OidcConfig;
  signalrHubs: {
    secure: string;
    voip: string;
    orchestrator: string;
    ingestion: string;
    searchOps: string;
  };
}

export const ENVIRONMENT = new InjectionToken<Environment>('ENVIRONMENT');

export const defaultEnvironment: Environment = {
  production: true,
  gatewayUrl: '',
  devToolsApiUrl: '',
  mapTilerKey: '',
  oidcConfig: {
    authority: 'https://auth.erbu.dev',
    clientId: 'erbu-admin-web',
    redirectUri: '/auth/callback',
    postLogoutRedirectUri: '/',
    scope: 'openid profile email erbu-api offline_access',
    responseType: 'code',
    silentRenew: true,
    silentRenewUrl: '/assets/silent-renew.html',
    automaticSilentRenew: true,
    accessTokenExpiringNotificationTimeInSeconds: 60,
  },
  signalrHubs: {
    secure: '/hubs/secure',
    voip: '/hubs/voip',
    orchestrator: '/hubs/orchestrator',
    ingestion: '/hubs/ingestion',
    searchOps: '/hubs/search-ops',
  },
};

export const devEnvironment: Environment = {
  ...defaultEnvironment,
  production: false,
  gatewayUrl: 'http://localhost:5200',
  devToolsApiUrl: '/api/devtools',
  oidcConfig: {
    ...defaultEnvironment.oidcConfig,
    authority: 'http://localhost:5090',
    redirectUri: 'http://localhost:4200/auth/callback',
    postLogoutRedirectUri: 'http://localhost:4200',
    silentRenewUrl: 'http://localhost:4200/assets/silent-renew.html',
  },
};
