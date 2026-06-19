import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { BroadcastDto } from './dto/notification.dto';

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
}
