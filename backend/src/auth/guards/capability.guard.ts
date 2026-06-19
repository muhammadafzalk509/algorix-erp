import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Capability } from '../../common/enums';
import { CAPABILITIES_KEY } from '../../common/decorators/require-capability.decorator';

/**
 * Authorizes a request against the @RequireCapability(...) metadata on the
 * route. The user must hold every listed capability. Reads capabilities from
 * the live role loaded by JwtStrategy, so changes take effect immediately.
 */
@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Capability[]>(
      CAPABILITIES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user?.role) throw new ForbiddenException('No role on user.');

    const held: Capability[] = user.role.capabilities ?? [];
    const missing = required.filter((c) => !held.includes(c));
    if (missing.length > 0) {
      throw new ForbiddenException(
        'You do not have permission for this action.',
      );
    }
    return true;
  }
}
