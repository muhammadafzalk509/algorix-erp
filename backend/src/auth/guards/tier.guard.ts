import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionTier } from '../../common/enums';
import { TIERS_KEY } from '../../common/decorators/tiers.decorator';

/** Authorizes a request against the @Tiers(...) metadata on the route. */
@Injectable()
export class TierGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredTiers = this.reflector.getAllAndOverride<PermissionTier[]>(
      TIERS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredTiers || requiredTiers.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!user?.role) throw new ForbiddenException('No role on user.');
    if (!requiredTiers.includes(user.role.permissionTier)) {
      throw new ForbiddenException(
        'You do not have permission for this action.',
      );
    }
    return true;
  }
}
