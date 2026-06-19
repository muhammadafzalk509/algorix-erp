import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Capability, PermissionTier } from '../common/enums';
import { TasksService } from './tasks.service';
import { Tiers } from '../common/decorators/tiers.decorator';
import { RequireCapability } from '../common/decorators/require-capability.decorator';
import { TierGuard } from '../auth/guards/tier.guard';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import {
  AssignTaskDto,
  CreateTaskDto,
  ReviewTaskDto,
  SubmitTaskDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
} from './dto/task.dto';

@UseGuards(TierGuard)
@Controller('api/tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.tasks.findAll(user);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.tasks.findOne(id, user);
  }

  @Tiers(
    PermissionTier.TIER_0,
    PermissionTier.TIER_1,
    PermissionTier.TIER_2,
    PermissionTier.TIER_3,
    PermissionTier.TIER_4, // Head of Documentation assigns docs-team tasks
  )
  @Post()
  create(@Body() dto: CreateTaskDto) {
    return this.tasks.create(dto);
  }

  @Tiers(
    PermissionTier.TIER_0,
    PermissionTier.TIER_1,
    PermissionTier.TIER_2,
    PermissionTier.TIER_3,
    PermissionTier.TIER_4, // Head of Documentation assigns docs-team tasks
  )
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTaskDto) {
    return this.tasks.update(id, dto);
  }

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1, PermissionTier.TIER_2)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.tasks.remove(id);
  }

  @Tiers(
    PermissionTier.TIER_0,
    PermissionTier.TIER_1,
    PermissionTier.TIER_2,
    PermissionTier.TIER_3,
    PermissionTier.TIER_4, // Head of Documentation assigns docs-team tasks
  )
  @Post(':id/assign')
  assign(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignTaskDto) {
    return this.tasks.assign(id, dto.assignedTo);
  }

  // Any tier on own task (managers on any) — enforced in service.
  @Patch(':id/status')
  setStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskStatusDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasks.setStatus(id, dto.status, user);
  }

  // Assignee submits their task — only allowed up to the due date/time.
  @Patch(':id/submit')
  submit(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubmitTaskDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasks.submit(id, dto.note, user);
  }

  // CEO / CTO / VP / department heads review a submission and leave feedback.
  @Tiers(
    PermissionTier.TIER_0,
    PermissionTier.TIER_1,
    PermissionTier.TIER_2,
    PermissionTier.TIER_3,
    PermissionTier.TIER_4,
  )
  @Patch(':id/review')
  review(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewTaskDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.tasks.review(id, dto, user);
  }

  // QA validation — QA holds QA_VALIDATE (managers use the status route above).
  @RequireCapability(Capability.QA_VALIDATE)
  @Patch(':id/validate')
  validate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskStatusDto,
    @CurrentUser('id') qaId: number,
  ) {
    return this.tasks.validate(id, dto.status, qaId);
  }
}
