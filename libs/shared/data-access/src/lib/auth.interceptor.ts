import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthService } from './auth.service';
import { Environment } from './environment';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
): Observable<HttpEvent<unknown>> => {
  const authService = inject(AuthService);
  const environment = inject<Environment>('ENVIRONMENT' as never);

  const gatewayUrl = environment.gatewayUrl;
  const isApiRequest = req.url.startsWith('/api');
  const isGatewayRequest = isApiRequest || (gatewayUrl !== '' && req.url.startsWith(gatewayUrl));

  if (!isGatewayRequest) {
    return next(req);
  }

  const token = authService.getToken();
  if (!token) {
    return next(req);
  }

  const cloned = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`,
    },
  });

  return next(cloned);
};
