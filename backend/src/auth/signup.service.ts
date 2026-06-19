import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { FirestoreService } from '../firebase/firestore.service';
import { COL } from '../common/collections';
import { MailService } from '../mail/mail.service';
import { templates } from '../mail/templates';
import { RequestSignupDto } from './dto/auth.dto';

const DEVELOPER_ROLE = 'Developer';
const DEVELOPER_HARD_CAP = 5;

interface SignupReqDoc {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  department?: string | null;
  occupation?: string | null;
  passwordHash?: string | null;
  status: string;
}
interface RoleDoc {
  id: number;
  name: string;
}

@Injectable()
export class SignupService {
  constructor(
    private readonly fs: FirestoreService,
    private readonly mail: MailService,
  ) {}

  // Public — a developer submits a signup request.
  async requestSignup(dto: RequestSignupDto) {
    const email = dto.email.toLowerCase();
    if (await this.fs.findOne(COL.users, { email }))
      throw new ConflictException('An account with this email already exists.');
    if (await this.fs.findOne(COL.signupRequests, { email }))
      throw new ConflictException(
        'A signup request with this email already exists.',
      );

    const request = await this.fs.create<SignupReqDoc>(COL.signupRequests, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      email,
      phone: dto.phone ?? null,
      intro: dto.intro ?? null,
      layer: dto.layer ?? null,
      department: dto.department ?? null,
      occupation: dto.occupation ?? null,
      passwordHash: await bcrypt.hash(dto.password, 10),
      status: 'PENDING',
      reviewedBy: null,
      reviewNote: null,
    });

    // Notify all CTOs.
    const ctoRole = await this.fs.findOne<RoleDoc>(COL.roles, { name: 'CTO' });
    const ctos = ctoRole
      ? await this.fs.findMany<{ email: string }>(COL.users, {
          where: { roleId: ctoRole.id },
        })
      : [];
    await Promise.all(
      ctos.map((c) =>
        this.mail.send(
          c.email,
          'New developer signup request',
          templates.newSignupRequest(`${dto.firstName} ${dto.lastName}`, email),
        ),
      ),
    );

    return {
      ok: true,
      message: 'Request submitted. The CTO will review your application.',
      requestId: request.id,
    };
  }

  // CTO — list requests (optionally by status).
  async listRequests(status?: string) {
    return this.fs.findMany(COL.signupRequests, {
      where: status ? { status } : undefined,
      orderBy: { field: 'createdAt', dir: 'desc' },
    });
  }

  private generatePassword(): string {
    const chars =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#';
    let pw = '';
    for (let i = 0; i < 12; i++)
      pw += chars[Math.floor(Math.random() * chars.length)];
    return pw;
  }

  // CTO — approve a request -> create Developer account (hard cap enforced).
  async approve(requestId: number, reviewerId: number) {
    const request = await this.fs.findById<SignupReqDoc>(
      COL.signupRequests,
      requestId,
    );
    if (!request) throw new NotFoundException('Signup request not found.');
    if (request.status !== 'PENDING')
      throw new BadRequestException(`Request already ${request.status}.`);

    const devRole = await this.fs.findOne<RoleDoc>(COL.roles, {
      name: DEVELOPER_ROLE,
    });
    if (!devRole) throw new NotFoundException('Developer role missing.');

    const activeDevs = await this.fs.count(COL.users, {
      roleId: devRole.id,
      status: 'ACTIVE',
    });
    if (activeDevs >= DEVELOPER_HARD_CAP)
      throw new BadRequestException('Maximum developer slots filled.');

    const selfSet = !!request.passwordHash;
    const rawPassword = selfSet ? null : this.generatePassword();
    const passwordHash =
      request.passwordHash ?? (await bcrypt.hash(rawPassword as string, 10));

    const user = await this.fs.create<{
      id: number;
      email: string;
      firstName: string;
    }>(COL.users, {
      firstName: request.firstName,
      lastName: request.lastName,
      email: request.email,
      phone: request.phone ?? null,
      passwordHash,
      roleId: devRole.id,
      department: request.department ?? null,
      designation: request.occupation || 'Developer',
      status: 'ACTIVE',
      createdBy: reviewerId,
      avatarUrl: null,
      joiningDate: null,
      lastLogin: null,
      refreshToken: null,
    });
    await this.fs.update(COL.signupRequests, requestId, {
      status: 'APPROVED',
      reviewedBy: reviewerId,
    });

    await this.mail.send(
      user.email,
      'Your account is approved',
      selfSet
        ? templates.signupApprovedSelfSet(user.firstName, user.email)
        : templates.signupApproved(
            user.firstName,
            user.email,
            rawPassword as string,
          ),
    );

    return {
      ok: true,
      message: selfSet
        ? 'Approved. The applicant can log in with the password they chose.'
        : 'Developer approved and credentials emailed.',
      userId: user.id,
    };
  }

  // CTO — reject a request.
  async reject(requestId: number, reviewerId: number, reviewNote?: string) {
    const request = await this.fs.findById<SignupReqDoc>(
      COL.signupRequests,
      requestId,
    );
    if (!request) throw new NotFoundException('Signup request not found.');
    if (request.status !== 'PENDING')
      throw new BadRequestException(`Request already ${request.status}.`);

    await this.fs.update(COL.signupRequests, requestId, {
      status: 'REJECTED',
      reviewedBy: reviewerId,
      reviewNote: reviewNote ?? null,
    });

    await this.mail.send(
      request.email,
      'Your developer application',
      templates.signupRejected(request.firstName, reviewNote),
    );

    return { ok: true, message: 'Request rejected and applicant notified.' };
  }
}
