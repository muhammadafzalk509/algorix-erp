import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { NotificationsService } from './notifications.service';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { BroadcastDto } from './dto/notification.dto';
import { PermissionTier } from '../common/enums';
import { Tiers } from '../common/decorators/tiers.decorator';
import { TierGuard } from '../auth/guards/tier.guard';

class UpdateNotificationDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() message?: string;
}

// CEO / CTO / VP Engineering may edit & delete notifications.
const EXEC = [PermissionTier.TIER_0, PermissionTier.TIER_1, PermissionTier.TIER_2];

@UseGuards(TierGuard)
@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  findMine(@CurrentUser('id') userId: number) {
    return this.notifications.findForUser(userId);
  }

  // Role-scoped broadcast; eligibility enforced per-audience in the service.
  @Post('broadcast')
  broadcast(@CurrentUser() user: AuthUser, @Body() dto: BroadcastDto) {
    return this.notifications.broadcast(user, dto);
  }

  @Post('mark-read/:id')
  markRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.notifications.markRead(id, userId);
  }

  @Post('mark-all-read')
  markAllRead(@CurrentUser('id') userId: number) {
    return this.notifications.markAllRead(userId);
  }

  @Tiers(...EXEC)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNotificationDto,
    @CurrentUser('id') userId: number,
  ) {
    return this.notifications.update(id, userId, dto);
  }

  @Tiers(...EXEC)
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.notifications.remove(id, userId);
  }
}
