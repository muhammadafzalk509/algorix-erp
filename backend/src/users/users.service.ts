import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { FirestoreService } from '../firebase/firestore.service';
import { R2Service } from '../storage/r2.service';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  canSeeAllUsers,
  departmentOfRole,
  isUndeletableRole,
  rolesInDepartment,
} from '../common/department.util';
import { COL } from '../common/collections';

// CEO / CTO / VP Engineering (management) + HR see every user; HODs see their dept.
const seesEveryUser = (tier: string) => canSeeAllUsers(tier) || tier === 'TIER_7';

const AVATAR_MAX = 2 * 1024 * 1024; // 2MB
const AVATAR_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

// Org-chart position caps (Layer 1). CEO is seed-only.
const ROLE_CAPS: Record<string, number> = {
  CEO: 1,
  CTO: 1,
  'VP Engineering': 1,
  'Head of Developer': 2,
  'Head of Documentation': 1,
  Developer: 5,
  'Tester Head': 1,
  'Documentation Specialist': 5,
  'IoT Head': 1,
  'IoT Engineer': 5,
};

interface RawRole {
  id: number;
  name: string;
  permissionTier: string;
  capabilities?: string[];
  description?: string | null;
}
interface RawUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  passwordHash?: string;
  refreshToken?: string | null;
  phone?: string | null;
  roleId: number;
  department?: string | null;
  designation?: string | null;
  employeeId?: string | null;
  avatarUrl?: string | null;
  joiningDate?: Date | null;
  status: string;
  lastLogin?: Date | null;
  createdBy?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly fs: FirestoreService,
    private readonly r2: R2Service,
  ) {}

  // Strip sensitive fields (passwordHash / refreshToken) and attach the role.
  private safe(user: RawUser, role: RawRole | null) {
    const { passwordHash, refreshToken, roleId, createdBy, ...rest } = user;
    void passwordHash;
    void refreshToken;
    void roleId;
    void createdBy;
    return {
      ...rest,
      role: role
        ? { id: role.id, name: role.name, permissionTier: role.permissionTier }
        : null,
    };
  }

  getMe(userId: number) {
    return this.findOne(userId);
  }

  async updateAvatar(userId: number, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No image provided.');
    if (!AVATAR_TYPES[file.mimetype])
      throw new BadRequestException(
        'Unsupported image type. Allowed: PNG, JPG, WEBP, GIF.',
      );
    if (file.size > AVATAR_MAX)
      throw new BadRequestException('Image exceeds the 2MB limit.');

    let avatarUrl: string;
    if (this.r2.isConfigured) {
      const key = `avatars/${userId}-${Date.now()}.${AVATAR_TYPES[file.mimetype]}`;
      avatarUrl = await this.r2.upload(key, file.buffer, file.mimetype);
    } else {
      avatarUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    }

    await this.fs.update(COL.users, userId, { avatarUrl });
    return this.findOne(userId);
  }

  // Role-based visibility (enforced here):
  //  - CEO / CTO / VP Engineering / HR -> every user
  //  - everyone else                   -> only users in their own department
  async findAll(actor: AuthUser) {
    const roles = await this.fs.findMany<RawRole>(COL.roles);
    const roleMap = new Map(roles.map((r) => [r.id, r]));
    let users = await this.fs.findMany<RawUser>(COL.users, {
      orderBy: { field: 'id', dir: 'asc' },
    });

    if (!seesEveryUser(actor.role.permissionTier)) {
      const dept = departmentOfRole(actor.role.name);
      const roleNames = dept ? rolesInDepartment(dept) : [];
      if (roleNames.length === 0) {
        users = users.filter((u) => u.id === actor.id);
      } else {
        const allowed = new Set(
          roles.filter((r) => roleNames.includes(r.name)).map((r) => r.id),
        );
        users = users.filter((u) => allowed.has(u.roleId));
      }
    }
    return users.map((u) => this.safe(u, roleMap.get(u.roleId) ?? null));
  }

  async findOne(id: number) {
    const user = await this.fs.findById<RawUser>(COL.users, id);
    if (!user) throw new NotFoundException('User not found.');
    const role =
      user.roleId != null
        ? await this.fs.findById<RawRole>(COL.roles, user.roleId)
        : null;
    return this.safe(user, role);
  }

  async findOneForActor(id: number, actor: AuthUser) {
    const target = await this.findOne(id);
    if (seesEveryUser(actor.role.permissionTier) || actor.id === id) return target;
    const actorDept = departmentOfRole(actor.role.name);
    const targetDept = departmentOfRole(target.role?.name ?? '');
    if (actorDept && actorDept === targetDept) return target;
    throw new ForbiddenException('You can only view users in your own department.');
  }

  async create(dto: CreateUserDto, createdBy: number) {
    const role = await this.fs.findById<RawRole>(COL.roles, dto.roleId);
    if (!role) throw new BadRequestException('Invalid roleId.');
    if (role.name === 'CEO')
      throw new ForbiddenException('CEO account can only be created via seed.');

    const cap = ROLE_CAPS[role.name];
    if (cap !== undefined) {
      const count = await this.fs.count(COL.users, { roleId: role.id });
      if (count >= cap)
        throw new BadRequestException(`${role.name} limit reached (max ${cap}).`);
    }

    const existing = await this.fs.findOne<RawUser>(COL.users, {
      email: dto.email.toLowerCase(),
    });
    if (existing) throw new BadRequestException('Email already in use.');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const created = await this.fs.create<RawUser>(COL.users, {
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email.toLowerCase(),
      phone: dto.phone ?? null,
      department: dto.department ?? null,
      designation: dto.designation ?? null,
      employeeId: dto.employeeId ?? null,
      passwordHash,
      roleId: dto.roleId,
      status: 'ACTIVE',
      createdBy,
      avatarUrl: null,
      joiningDate: null,
      lastLogin: null,
      refreshToken: null,
    });
    return this.safe(created, role);
  }

  async update(id: number, dto: UpdateUserDto, actor: AuthUser) {
    const target = await this.fs.findById<RawUser>(COL.users, id);
    if (!target) throw new NotFoundException('User not found.');

    const isSelf = actor.id === id;
    const isManager = ['TIER_0', 'TIER_1', 'TIER_2'].includes(
      actor.role.permissionTier,
    );
    if (!isSelf && !isManager)
      throw new ForbiddenException('Not allowed to update this user.');

    const data: Record<string, unknown> = {};
    if (dto.firstName !== undefined) data.firstName = dto.firstName;
    if (dto.lastName !== undefined) data.lastName = dto.lastName;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.department !== undefined) data.department = dto.department;
    if (dto.designation !== undefined) data.designation = dto.designation;
    if (dto.employeeId !== undefined) data.employeeId = dto.employeeId;

    // Only CEO/CTO may change a user's role; block promoting anyone to CEO.
    if (dto.roleId !== undefined && dto.roleId !== target.roleId) {
      if (!['TIER_0', 'TIER_1'].includes(actor.role.permissionTier))
        throw new ForbiddenException('Only the CEO or CTO can change roles.');
      const newRole = await this.fs.findById<RawRole>(COL.roles, dto.roleId);
      if (!newRole) throw new BadRequestException('Invalid roleId.');
      if (newRole.name === 'CEO')
        throw new ForbiddenException('Cannot assign CEO role.');
      data.roleId = dto.roleId;
    }

    // Email is the login identifier: owner or CEO/CTO may change it.
    if (dto.email !== undefined) {
      const canChangeEmail =
        isSelf || ['TIER_0', 'TIER_1'].includes(actor.role.permissionTier);
      if (!canChangeEmail)
        throw new ForbiddenException(
          "Only the account owner, CEO or CTO can change this user's email.",
        );
      const normalized = dto.email.toLowerCase();
      if (normalized !== target.email) {
        const clash = await this.fs.findOne<RawUser>(COL.users, {
          email: normalized,
        });
        if (clash) throw new BadRequestException('Email already in use.');
        data.email = normalized;
      }
    }

    if (Object.keys(data).length) await this.fs.update(COL.users, id, data);
    return this.findOne(id);
  }

  async remove(id: number, actorId: number) {
    const target = await this.fs.findById<RawUser>(COL.users, id);
    if (!target) throw new NotFoundException('User not found.');
    const role = await this.fs.findById<RawRole>(COL.roles, target.roleId);
    if (role && isUndeletableRole(role.name))
      throw new ForbiddenException(
        `${role.name} accounts are protected and cannot be deleted.`,
      );

    // Reassign shared records to the actor; unassign tasks; delete personal records.
    await this.fs.updateMany(COL.tasks, { assignedTo: id }, { assignedTo: null });
    await this.fs.updateMany(COL.signupRequests, { reviewedBy: id }, { reviewedBy: null });
    await this.fs.updateMany(COL.documents, { uploadedBy: id }, { uploadedBy: actorId });
    await this.fs.updateMany(COL.projects, { createdBy: id }, { createdBy: actorId });
    await this.fs.updateMany(COL.clients, { createdBy: id }, { createdBy: actorId });
    await this.fs.deleteMany(COL.taskLogs, { userId: id });
    await this.fs.deleteMany(COL.comments, { userId: id });
    await this.fs.deleteMany(COL.notifications, { userId: id });
    await this.fs.deleteMany(COL.leaves, { userId: id });
    await this.fs.deleteMany(COL.attendanceSessions, { userId: id });
    await this.fs.deleteMany(COL.payrollEntries, { userId: id });
    await this.fs.deleteMany(COL.salaryRecords, { userId: id });
    await this.fs.delete(COL.users, id);
    return { ok: true };
  }

  async setStatus(
    id: number,
    status: 'ACTIVE' | 'INACTIVE' | 'PENDING_APPROVAL',
  ) {
    const target = await this.fs.findById<RawUser>(COL.users, id);
    if (!target) throw new NotFoundException('User not found.');
    const role = await this.fs.findById<RawRole>(COL.roles, target.roleId);
    if (role?.name === 'CEO' && status !== 'ACTIVE')
      throw new ForbiddenException('CEO account can never be deactivated.');
    await this.fs.update(COL.users, id, { status });
    return this.findOne(id);
  }
}
