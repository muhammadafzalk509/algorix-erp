import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import * as bcrypt from 'bcryptjs';
import { FirestoreService } from '../firebase/firestore.service';
import { COL } from '../common/collections';
import { MailService } from '../mail/mail.service';
import { templates } from '../mail/templates';
import { roleMatchesLoginDepartment } from '../common/department.util';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  ResetPasswordDto,
  VerifyOtpDto,
} from './dto/auth.dto';

interface OtpEntry {
  otp: string;
  expiresAt: number;
}
interface UserDoc {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash?: string;
  status: string;
  roleId: number;
  refreshToken?: string | null;
}
interface RoleDoc {
  id: number;
  name: string;
  permissionTier: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  // In-memory OTP store (dev). Production should use Redis or a DB collection.
  private readonly otpStore = new Map<string, OtpEntry>();
  private googleClient: OAuth2Client | null = null;

  constructor(
    private readonly fs: FirestoreService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
  ) {}

  private findByEmail(email: string) {
    return this.fs.findOne<UserDoc>(COL.users, { email: email.toLowerCase() });
  }

  private role(roleId: number) {
    return this.fs.findById<RoleDoc>(COL.roles, roleId);
  }

  // A user may only sign in under their own department.
  private assertDepartment(roleName: string, selected?: string) {
    if (selected && !roleMatchesLoginDepartment(roleName, selected))
      throw new UnauthorizedException(
        'This account does not belong to the selected department.',
      );
  }

  private async signTokens(userId: number, email: string, tier: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, tier },
      {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: this.config.get<string>('JWT_EXPIRES_IN') || '15m',
      },
    );
    const refreshToken = await this.jwt.signAsync(
      { sub: userId, email },
      {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN') || '7d',
      },
    );
    return { accessToken, refreshToken };
  }

  private async storeRefreshToken(userId: number, refreshToken: string) {
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.fs.update(COL.users, userId, {
      refreshToken: hash,
      lastLogin: new Date(),
    });
  }

  private session(user: UserDoc, role: RoleDoc | null) {
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: role?.name,
      permissionTier: role?.permissionTier,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.findByEmail(dto.email);
    if (!user) throw new UnauthorizedException('Invalid credentials.');
    if (user.status !== 'ACTIVE')
      throw new UnauthorizedException('Account is not active.');

    const ok = await bcrypt.compare(dto.password, user.passwordHash || '');
    if (!ok) throw new UnauthorizedException('Invalid credentials.');

    const role = await this.role(user.roleId);
    this.assertDepartment(role?.name ?? '', dto.department);

    const tokens = await this.signTokens(
      user.id,
      user.email,
      role?.permissionTier ?? '',
    );
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user: this.session(user, role),
    };
  }

  // Sign in via a Google ID token. Google is a login method for users who
  // already exist and are ACTIVE — it never creates accounts.
  async googleLogin(idToken: string, department?: string) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId)
      throw new BadRequestException('Google sign-in is not configured.');

    if (!this.googleClient) this.googleClient = new OAuth2Client(clientId);

    let email: string | undefined;
    let emailVerified = false;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      email = payload?.email?.toLowerCase();
      emailVerified = payload?.email_verified === true;
    } catch (err) {
      this.logger.warn(`Google token verification failed: ${String(err)}`);
      throw new UnauthorizedException('Invalid Google token.');
    }

    if (!email || !emailVerified)
      throw new UnauthorizedException('Google email is missing or unverified.');

    const user = await this.findByEmail(email);
    if (!user)
      throw new UnauthorizedException(
        'No account for this Google email. Ask an admin to invite you.',
      );
    if (user.status !== 'ACTIVE')
      throw new UnauthorizedException('Account is not active.');

    const role = await this.role(user.roleId);
    this.assertDepartment(role?.name ?? '', department);

    const tokens = await this.signTokens(
      user.id,
      user.email,
      role?.permissionTier ?? '',
    );
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user: this.session(user, role),
    };
  }

  async logout(userId: number) {
    await this.fs.update(COL.users, userId, { refreshToken: null });
    return { ok: true };
  }

  async refresh(refreshToken: string) {
    let payload: { sub: number; email: string };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    const user = await this.fs.findById<UserDoc>(COL.users, payload.sub);
    if (!user || !user.refreshToken)
      throw new UnauthorizedException('Session expired. Please log in again.');

    const matches = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!matches) throw new UnauthorizedException('Refresh token mismatch.');

    const role = await this.role(user.roleId);
    const tokens = await this.signTokens(
      user.id,
      user.email,
      role?.permissionTier ?? '',
    );
    await this.storeRefreshToken(user.id, tokens.refreshToken);
    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.findByEmail(dto.email);
    if (user) {
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      this.otpStore.set(user.email, {
        otp,
        expiresAt: Date.now() + 10 * 60 * 1000,
      });
      await this.mail.send(
        user.email,
        'Your password reset code',
        templates.otp(otp),
      );
    }
    return { ok: true, message: 'If the email exists, an OTP has been sent.' };
  }

  private checkOtp(email: string, otp: string): boolean {
    const entry = this.otpStore.get(email.toLowerCase());
    if (!entry) return false;
    if (entry.expiresAt < Date.now()) {
      this.otpStore.delete(email.toLowerCase());
      return false;
    }
    return entry.otp === otp;
  }

  async verifyOtp(dto: VerifyOtpDto) {
    if (!this.checkOtp(dto.email, dto.otp))
      throw new BadRequestException('Invalid or expired OTP.');
    return { ok: true, valid: true };
  }

  async changePassword(userId: number, dto: ChangePasswordDto) {
    const user = await this.fs.findById<UserDoc>(COL.users, userId);
    if (!user) throw new UnauthorizedException('User not found.');
    const ok = await bcrypt.compare(dto.currentPassword, user.passwordHash || '');
    if (!ok) throw new BadRequestException('Current password is incorrect.');
    if (dto.currentPassword === dto.newPassword)
      throw new BadRequestException('New password must be different.');
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.fs.update(COL.users, userId, { passwordHash, refreshToken: null });
    return { ok: true, message: 'Password changed. Please log in again.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (!this.checkOtp(dto.email, dto.otp))
      throw new BadRequestException('Invalid or expired OTP.');
    const user = await this.findByEmail(dto.email);
    if (user) {
      const passwordHash = await bcrypt.hash(dto.newPassword, 10);
      await this.fs.update(COL.users, user.id, {
        passwordHash,
        refreshToken: null,
      });
    }
    this.otpStore.delete(dto.email.toLowerCase());
    return { ok: true, message: 'Password updated. Please log in.' };
  }
}
