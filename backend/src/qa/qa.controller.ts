import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Capability, PermissionTier } from '../common/enums';
import { QaService } from './qa.service';
import { CreateBugDto, UpdateBugStatusDto } from './dto/bug.dto';
import { Tiers } from '../common/decorators/tiers.decorator';
import { RequireCapability } from '../common/decorators/require-capability.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

// Managers + QA may view/triage bugs.
const VIEW_TIERS = [
  PermissionTier.TIER_0,
  PermissionTier.TIER_1,
  PermissionTier.TIER_2,
  PermissionTier.TIER_3,
  PermissionTier.TIER_6,
];

@Controller('api/bugs')
export class QaController {
  constructor(private readonly qa: QaService) {}

  // Filing bugs requires QA_VALIDATE (QA role).
  @RequireCapability(Capability.QA_VALIDATE)
  @Post()
  create(@Body() dto: CreateBugDto, @CurrentUser('id') reporterId: number) {
    return this.qa.create(dto, reporterId);
  }

  @Tiers(...VIEW_TIERS)
  @Get()
  findAll(@Query('taskId') taskId?: string) {
    return this.qa.findAll(taskId ? Number(taskId) : undefined);
  }

  @Tiers(...VIEW_TIERS)
  @Patch(':id/status')
  setStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBugStatusDto,
  ) {
    return this.qa.setStatus(id, dto.status);
  }
}
