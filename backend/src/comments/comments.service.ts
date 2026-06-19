import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FirestoreService } from '../firebase/firestore.service';
import { COL } from '../common/collections';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { isDeveloper } from '../common/tier.util';
import { CreateCommentDto } from './dto/comment.dto';

interface CommentDoc {
  id: number;
  taskId: number;
  userId: number;
  message: string;
}

@Injectable()
export class CommentsService {
  constructor(private readonly fs: FirestoreService) {}

  private async assertTaskAccess(taskId: number, user: AuthUser) {
    const task = await this.fs.findById<{ assignedTo?: number | null }>(COL.tasks, taskId);
    if (!task) throw new NotFoundException('Task not found.');
    if (isDeveloper(user.role.permissionTier) && task.assignedTo !== user.id)
      throw new ForbiddenException('This task is not assigned to you.');
  }

  private async withUser(c: CommentDoc) {
    const u = await this.fs.findById<any>(COL.users, c.userId);
    return {
      ...c,
      user: u ? { id: u.id, firstName: u.firstName, lastName: u.lastName } : null,
    };
  }

  async list(taskId: number, user: AuthUser) {
    await this.assertTaskAccess(taskId, user);
    const comments = await this.fs.findMany<CommentDoc>(COL.comments, {
      where: { taskId },
    });
    comments.sort((a, b) => a.id - b.id);
    return Promise.all(comments.map((c) => this.withUser(c)));
  }

  async create(taskId: number, dto: CreateCommentDto, user: AuthUser) {
    await this.assertTaskAccess(taskId, user);
    const comment = await this.fs.create<CommentDoc>(COL.comments, {
      taskId,
      userId: user.id,
      message: dto.message,
    });
    return this.withUser(comment);
  }
}
