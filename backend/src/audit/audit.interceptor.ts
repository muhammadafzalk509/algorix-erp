import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';

// Only state-changing verbs are audited; GET/HEAD/OPTIONS are skipped.
const AUDITED_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// High-frequency / low-value paths excluded from the audit trail.
const SKIP_PATHS = ['/api/attendance/ping'];
// Body fields never written to the audit trail.
const REDACT = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'idToken',
  'refreshToken',
  'token',
  'otp',
]);

function redact(obj: unknown): unknown {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redact);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = REDACT.has(k) ? '[redacted]' : redact(v);
  }
  return out;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const method: string = req.method;

    if (!AUDITED_METHODS.has(method)) return next.handle();
    const reqPath: string = (req.path || req.url || '').split('?')[0];
    if (SKIP_PATHS.some((p) => reqPath.startsWith(p))) return next.handle();

    // /api/<entity>/<id?>...  → entity + entityId
    const segments = (req.path || req.url || '')
      .split('?')[0]
      .split('/')
      .filter(Boolean); // ["api", "payroll", "entries"]
    const entity = segments[1] ?? null;
    const entityId = req.params?.id ?? null;
    const routePath = req.route?.path ?? req.path ?? req.url;

    const base = {
      userId: req.user?.id ?? null,
      action: `${method} ${routePath}`,
      method,
      path: req.originalUrl ?? req.url,
      entity,
      entityId: entityId != null ? String(entityId) : null,
      ip:
        (req.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.ip ||
        null,
      metadata: {
        params: redact(req.params),
        query: redact(req.query),
        body: redact(req.body),
      } as Record<string, unknown>,
    };

    const res = context.switchToHttp().getResponse();

    return next.handle().pipe(
      tap({
        next: () => {
          void this.audit.record({ ...base, statusCode: res.statusCode });
        },
        error: (err) => {
          void this.audit.record({
            ...base,
            statusCode: err?.status ?? 500,
            metadata: { ...base.metadata, error: err?.message },
          });
        },
      }),
    );
  }
}
