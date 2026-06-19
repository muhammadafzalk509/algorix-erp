import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Capability } from '../enums';

export interface AuthUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  role: {
    id: number;
    name: string;
    permissionTier: string;
    capabilities: Capability[];
  };
}

/** Inject the authenticated user (or one of its fields) into a handler. */
export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser;
    return data ? user?.[data] : user;
  },
);
