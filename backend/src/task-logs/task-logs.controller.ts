import {
  Body,
  Controller,
  Get,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PermissionTier } from '../common/enums';
import { TaskLogsService } from './task-logs.service';
import { Tiers } from '../common/decorators/tiers.decorator';
import { TierGuard } from '../auth/guards/tier.guard';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { CreateTaskLogDto } from './dto/task-log.dto';

@UseGuards(TierGuard)
@Controller('api/task-logs')
export class TaskLogsController {
  constructor(private readonly logs: TaskLogsService) {}

  // TIER_3+ see all; TIER_5 sees own (filtered in service).
  @Get()
  findAll(
    @CurrentUser() user: AuthUser,
    @Query('taskId') taskId?: string,
  ) {
    return this.logs.findAll(user, taskId ? Number(taskId) : undefined);
  }

  // Only developers submit logs.
  @Tiers(PermissionTier.TIER_5)
  @Post()
  create(@Body() dto: CreateTaskLogDto, @CurrentUser() user: AuthUser) {
    return this.logs.create(dto, user);
  }

  @Get('report/daily')
  daily(@CurrentUser() user: AuthUser, @Query('userId') userId?: string) {
    return this.logs.report('daily', user, userId ? Number(userId) : undefined);
  }

  @Get('report/weekly')
  weekly(@CurrentUser() user: AuthUser, @Query('userId') userId?: string) {
    return this.logs.report('weekly', user, userId ? Number(userId) : undefined);
  }

  @Get('report/monthly')
  monthly(@CurrentUser() user: AuthUser, @Query('userId') userId?: string) {
    return this.logs.report('monthly', user, userId ? Number(userId) : undefined);
  }
}
