import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
} from '@nestjs/common';
import { Capability, PermissionTier } from '../common/enums';
import { AttendanceService } from './attendance.service';
import { OverrideDto } from './dto/attendance.dto';
import { Tiers } from '../common/decorators/tiers.decorator';
import { RequireCapability } from '../common/decorators/require-capability.decorator';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';

// Who may open attendance lists/reports. Department heads (TIER_3/4) are scoped
// to their own department in the service; CEO/CTO/VPE (0/1/2) and HR (7) see all.
const VIEWER_TIERS = [
  PermissionTier.TIER_0,
  PermissionTier.TIER_1,
  PermissionTier.TIER_2,
  PermissionTier.TIER_3,
  PermissionTier.TIER_4,
  PermissionTier.TIER_7,
];

@Controller('api/attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  // Heartbeat from the client; any authenticated user.
  @Post('ping')
  @HttpCode(200)
  ping(@CurrentUser('id') userId: number) {
    return this.attendance.ping(userId);
  }

  @Get('me')
  me(@CurrentUser('id') userId: number) {
    return this.attendance.mySessions(userId);
  }

  @Tiers(...VIEWER_TIERS)
  @Get('report')
  report(
    @CurrentUser() user: AuthUser,
    @Query('scope') scope = 'daily',
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('userId') userId?: string,
  ) {
    return this.attendance.report(
      user,
      scope,
      from,
      to,
      userId ? Number(userId) : undefined,
    );
  }

  @Tiers(...VIEWER_TIERS)
  @Get()
  listAll(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('userId') userId?: string,
  ) {
    return this.attendance.listAll(user, {
      from,
      to,
      userId: userId ? Number(userId) : undefined,
    });
  }

  // Manual override — CTO holds ATTENDANCE_MANAGE.
  @RequireCapability(Capability.ATTENDANCE_MANAGE)
  @Post('override')
  override(@Body() dto: OverrideDto, @CurrentUser('id') actorId: number) {
    return this.attendance.override(dto, actorId);
  }
}
