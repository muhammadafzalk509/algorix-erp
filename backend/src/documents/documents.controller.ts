import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PermissionTier } from '../common/enums';
import { DocumentsService } from './documents.service';
import { Tiers } from '../common/decorators/tiers.decorator';
import { TierGuard } from '../auth/guards/tier.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/documents')
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get()
  findAll(
    @Query('projectId') projectId?: string,
    @Query('taskId') taskId?: string,
  ) {
    return this.documents.findAll({
      projectId: projectId ? Number(projectId) : undefined,
      taskId: taskId ? Number(taskId) : undefined,
    });
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      projectId?: string;
      taskId?: string;
      title?: string;
      description?: string;
    },
    @CurrentUser('id') userId: number,
  ) {
    return this.documents.upload(
      file,
      {
        projectId: body.projectId ? Number(body.projectId) : undefined,
        taskId: body.taskId ? Number(body.taskId) : undefined,
        title: body.title || undefined,
        description: body.description || undefined,
      },
      userId,
    );
  }

  @Get(':id/versions')
  versions(@Param('id', ParseIntPipe) id: number) {
    return this.documents.listVersions(id);
  }

  @Post(':id/rollback/:versionId')
  rollback(
    @Param('id', ParseIntPipe) id: number,
    @Param('versionId', ParseIntPipe) versionId: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.documents.rollback(id, versionId, userId);
  }

  // Edit metadata (title / description) — CEO, CTO, Head of Docs.
  @UseGuards(TierGuard)
  @Tiers(
    PermissionTier.TIER_0,
    PermissionTier.TIER_1,
    PermissionTier.TIER_4,
  )
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { title?: string; description?: string },
  ) {
    return this.documents.update(id, body);
  }

  // Delete — CEO, CTO, Head of Docs.
  @UseGuards(TierGuard)
  @Tiers(
    PermissionTier.TIER_0,
    PermissionTier.TIER_1,
    PermissionTier.TIER_4,
  )
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.documents.remove(id);
  }
}
