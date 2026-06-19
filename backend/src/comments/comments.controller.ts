import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { CreateCommentDto } from './dto/comment.dto';

@Controller('api/tasks/:taskId/comments')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get()
  list(
    @Param('taskId', ParseIntPipe) taskId: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.comments.list(taskId, user);
  }

  @Post()
  create(
    @Param('taskId', ParseIntPipe) taskId: number,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.comments.create(taskId, dto, user);
  }
}
