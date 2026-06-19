import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { PermissionTier } from '../common/enums';
import { ProjectsService } from './projects.service';
import { Tiers } from '../common/decorators/tiers.decorator';
import { TierGuard } from '../auth/guards/tier.guard';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import {
  CreateMilestoneDto,
  CreateProjectDto,
  UpdateMilestoneDto,
  UpdateProjectDto,
} from './dto/project.dto';

@UseGuards(TierGuard)
@Controller('api/projects')
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  // All authenticated users — service filters by tier.
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.projects.findAll(user);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: AuthUser) {
    return this.projects.findOne(id, user);
  }

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1, PermissionTier.TIER_2)
  @Post()
  create(@Body() dto: CreateProjectDto, @CurrentUser('id') userId: number) {
    return this.projects.create(dto, userId);
  }

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1, PermissionTier.TIER_2)
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProjectDto) {
    return this.projects.update(id, dto);
  }

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.projects.remove(id);
  }

  // ---------- Milestones ----------
  @Get(':id/milestones')
  listMilestones(@Param('id', ParseIntPipe) id: number) {
    return this.projects.listMilestones(id);
  }

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1, PermissionTier.TIER_2)
  @Post(':id/milestones')
  addMilestone(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateMilestoneDto,
  ) {
    return this.projects.addMilestone(id, dto);
  }

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1, PermissionTier.TIER_2)
  @Put(':id/milestones/:mId')
  updateMilestone(
    @Param('id', ParseIntPipe) id: number,
    @Param('mId', ParseIntPipe) mId: number,
    @Body() dto: UpdateMilestoneDto,
  ) {
    return this.projects.updateMilestone(id, mId, dto);
  }
}
