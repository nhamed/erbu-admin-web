import {
  ApplicationConfig,
  isDevMode,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import {
  provideHttpClient,
  withFetch,
  withInterceptors,
} from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import {
  authInterceptor,
  mockFallbackInterceptor,
  ENVIRONMENT,
  defaultEnvironment,
  devEnvironment,
} from '@erbu-admin-web/shared/data-access';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes, withComponentInputBinding()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, mockFallbackInterceptor])),
    provideAnimations(),
    {
      provide: ENVIRONMENT,
      useFactory: () => (isDevMode() ? devEnvironment : defaultEnvironment),
    },
    { provide: 'ENVIRONMENT', useExisting: ENVIRONMENT },
  ],
};
