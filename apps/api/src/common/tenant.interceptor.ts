import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tenantLocalStorage } from './tenant-context';

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    
    // Extract organizationId from request user (populated by authentication guard) or headers
    const user = request.user;
    const organizationId = user?.organizationId || request.headers['x-tenant-id'] || request.query['organizationId'];

    if (organizationId) {
      return new Observable((subscriber) => {
        tenantLocalStorage.run({ organizationId }, () => {
          next.handle().subscribe({
            next: (val) => subscriber.next(val),
            error: (err) => subscriber.error(err),
            complete: () => subscriber.complete(),
          });
        });
      });
    }

    return next.handle();
  }
}
