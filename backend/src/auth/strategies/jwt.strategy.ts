import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { FirestoreService } from '../../firebase/firestore.service';
import { COL } from '../../common/collections';

export interface JwtPayload {
  sub: number;
  email: string;
  tier: string;
}

interface UserDoc {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  roleId: number;
}
interface RoleDoc {
  id: number;
  name: string;
  permissionTier: string;
  capabilities?: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly fs: FirestoreService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET') ?? 'dev_jwt_secret',
    });
  }

  // Loads the live user (with role/tier) on every request. Never exposes the hash.
  async validate(payload: JwtPayload) {
    const user = await this.fs.findById<UserDoc>(COL.users, payload.sub);
    if (!user) throw new UnauthorizedException('User no longer exists.');
    if (user.status !== 'ACTIVE')
      throw new UnauthorizedException('Account is not active.');
    const role =
      user.roleId != null
        ? await this.fs.findById<RoleDoc>(COL.roles, user.roleId)
        : null;
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
      role: role
        ? {
            id: role.id,
            name: role.name,
            permissionTier: role.permissionTier,
            capabilities: role.capabilities ?? [],
          }
        : null,
    };
  }
}
