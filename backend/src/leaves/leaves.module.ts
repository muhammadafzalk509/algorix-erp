import { Module } from '@nestjs/common';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import {
  Body,
  Controller,
  Get,
  Injectable,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { LeaveType, PermissionTier } from '../common/enums';
import { FirestoreService } from '../firebase/firestore.service';
import { COL } from '../common/collections';
import { NotificationsService } from '../notifications/notifications.service';
import { MailService } from '../mail/mail.service';
import { templates } from '../mail/templates';
import { Tiers } from '../common/decorators/tiers.decorator';
import { TierGuard } from '../auth/guards/tier.guard';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { seesAllData } from '../common/tier.util';

class CreateLeaveDto {
  @IsEnum(LeaveType) type!: LeaveType;
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsOptional() @IsString() reason?: string;
}

@Injectable()
class LeavesService {
  constructor(
    private readonly fs: FirestoreService,
    private readonly notifications: NotificationsService,
    private readonly mail: MailService,
  ) {}

  // Own leaves; TIER_3+ (managers) see all (team).
  async findAll(user: AuthUser) {
    const leaves = seesAllData(user.role.permissionTier)
      ? await this.fs.findMany<any>(COL.leaves)
      : await this.fs.findMany<any>(COL.leaves, { where: { userId: user.id } });
    leaves.sort((a, b) => b.id - a.id);
    const ids = [...new Set(leaves.map((l) => l.userId))];
    const uMap = new Map<number, any>();
    await Promise.all(ids.map(async (id) => {
      const u = await this.fs.findById<any>(COL.users, id);
      if (u) uMap.set(id, { id: u.id, firstName: u.firstName, lastName: u.lastName });
    }));
    return leaves.map((l) => ({ ...l, user: uMap.get(l.userId) ?? null }));
  }

  create(dto: CreateLeaveDto, userId: number) {
    return this.fs.create(COL.leaves, {
      userId,
      type: dto.type,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      reason: dto.reason ?? null,
      status: 'PENDING',
      approvedBy: null,
    });
  }

  private async decide(id: number, approverId: number, status: 'APPROVED' | 'REJECTED') {
    const leave = await this.fs.findById<any>(COL.leaves, id);
    if (!leave) throw new NotFoundException('Leave application not found.');
    const updated = await this.fs.update(COL.leaves, id, { status, approvedBy: approverId });
    const employee = await this.fs.findById<any>(COL.users, leave.userId);
    await this.notifications.createForUser(
      leave.userId,
      `Leave ${status.toLowerCase()}`,
      `Your ${String(leave.type).toLowerCase()} leave was ${status.toLowerCase()}.`,
    );
    if (employee?.email)
      await this.mail.send(
        employee.email,
        `Leave ${status}`,
        templates.leaveDecision(status),
      );
    return updated;
  }
  approve(id: number, approverId: number) {
    return this.decide(id, approverId, 'APPROVED');
  }
  reject(id: number, approverId: number) {
    return this.decide(id, approverId, 'REJECTED');
  }
}

@UseGuards(TierGuard)
@Controller('api/leaves')
class LeavesController {
  constructor(private readonly leaves: LeavesService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.leaves.findAll(user);
  }

  @Post()
  create(@Body() dto: CreateLeaveDto, @CurrentUser('id') userId: number) {
    return this.leaves.create(dto, userId);
  }

  @Tiers(
    PermissionTier.TIER_0,
    PermissionTier.TIER_1,
    PermissionTier.TIER_2,
    PermissionTier.TIER_3,
  )
  @Patch(':id/approve')
  approve(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') uid: number) {
    return this.leaves.approve(id, uid);
  }

  @Tiers(
    PermissionTier.TIER_0,
    PermissionTier.TIER_1,
    PermissionTier.TIER_2,
    PermissionTier.TIER_3,
  )
  @Patch(':id/reject')
  reject(@Param('id', ParseIntPipe) id: number, @CurrentUser('id') uid: number) {
    return this.leaves.reject(id, uid);
  }
}

@Module({
  controllers: [LeavesController],
  providers: [LeavesService],
})
export class LeavesModule {}
