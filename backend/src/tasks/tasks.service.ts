import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FirestoreService } from '../firebase/firestore.service';
import { COL } from '../common/collections';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { isDeveloper, seesAllData } from '../common/tier.util';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';

// Who may change a task's status: CEO / CTO / VP Engineering, plus the
// Head of Development. Developers progress their work via Submit → Review.
const STATUS_EDIT_TIERS = ['TIER_0', 'TIER_1', 'TIER_2'];
const STATUS_EDIT_ROLE = 'Head of Developer';

export interface TaskDoc {
  id: number;
  projectId: number;
  assignedTo?: number | null;
  title: string;
  description?: string | null;
  priority: string;
  status: string;
  dueDate?: Date | null;
  submittedAt?: Date | null;
  submissionNote?: string | null;
  reviewFeedback?: string | null;
  reviewedAt?: Date | null;
  reviewedBy?: number | null;
}

@Injectable()
export class TasksService {
  constructor(
    private readonly fs: FirestoreService,
    private readonly notifications: NotificationsService,
  ) {}

  // Attach project {id,title} and assignee {id,firstName,lastName} in memory.
  private async hydrate(tasks: TaskDoc[]) {
    const pIds = [...new Set(tasks.map((t) => t.projectId).filter((x): x is number => x != null))];
    const uIds = [...new Set(tasks.map((t) => t.assignedTo).filter((x): x is number => x != null))];
    const pMap = new Map<number, { id: number; title: string }>();
    await Promise.all(
      pIds.map(async (id) => {
        const p = await this.fs.findById<{ id: number; title: string }>(COL.projects, id);
        if (p) pMap.set(id, { id: p.id, title: p.title });
      }),
    );
    const uMap = new Map<number, { id: number; firstName: string; lastName: string }>();
    await Promise.all(
      uIds.map(async (id) => {
        const u = await this.fs.findById<{ id: number; firstName: string; lastName: string }>(COL.users, id);
        if (u) uMap.set(id, { id: u.id, firstName: u.firstName, lastName: u.lastName });
      }),
    );
    return tasks.map((t) => ({
      ...t,
      project: t.projectId != null ? pMap.get(t.projectId) ?? null : null,
      assignee: t.assignedTo != null ? uMap.get(t.assignedTo) ?? null : null,
    }));
  }

  async findAll(user: AuthUser) {
    let tasks: TaskDoc[];
    if (seesAllData(user.role.permissionTier)) {
      tasks = await this.fs.findMany<TaskDoc>(COL.tasks, { orderBy: { field: 'id', dir: 'desc' } });
    } else {
      tasks = await this.fs.findMany<TaskDoc>(COL.tasks, { where: { assignedTo: user.id } });
      tasks.sort((a, b) => b.id - a.id);
    }
    return this.hydrate(tasks);
  }

  async findOne(id: number, user: AuthUser) {
    const task = await this.fs.findById<TaskDoc>(COL.tasks, id);
    if (!task) throw new NotFoundException('Task not found.');
    if (isDeveloper(user.role.permissionTier) && task.assignedTo !== user.id)
      throw new ForbiddenException('This task is not assigned to you.');
    return (await this.hydrate([task]))[0];
  }

  async create(dto: CreateTaskDto) {
    const project = await this.fs.findById(COL.projects, dto.projectId);
    if (!project) throw new BadRequestException('Invalid projectId.');
    if (dto.assignedTo) await this.assertAssignee(dto.assignedTo);

    const task = await this.fs.create<TaskDoc>(COL.tasks, {
      projectId: dto.projectId,
      title: dto.title,
      description: dto.description ?? null,
      assignedTo: dto.assignedTo ?? null,
      priority: dto.priority ?? 'MEDIUM',
      status: dto.status ?? 'TODO',
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      submittedAt: null,
      submissionNote: null,
      reviewFeedback: null,
      reviewedAt: null,
      reviewedBy: null,
    });
    if (task.assignedTo)
      await this.notifications.createForUser(
        task.assignedTo,
        'New task assigned',
        `You were assigned: ${task.title}`,
      );
    return task;
  }

  async update(id: number, dto: UpdateTaskDto) {
    await this.ensureExists(id);
    if (dto.assignedTo) await this.assertAssignee(dto.assignedTo);
    const data: Record<string, unknown> = {};
    if (dto.projectId !== undefined) data.projectId = dto.projectId;
    if (dto.title !== undefined) data.title = dto.title;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.assignedTo !== undefined) data.assignedTo = dto.assignedTo;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    return this.fs.update<TaskDoc>(COL.tasks, id, data);
  }

  async remove(id: number) {
    await this.ensureExists(id);
    await this.fs.delete(COL.tasks, id);
    return { ok: true };
  }

  async assign(id: number, assignedTo: number) {
    await this.ensureExists(id);
    await this.assertAssignee(assignedTo);
    const task = await this.fs.update<TaskDoc>(COL.tasks, id, { assignedTo });
    await this.notifications.createForUser(
      assignedTo,
      'New task assigned',
      `You were assigned: ${task.title}`,
    );
    return task;
  }

  // Only CEO / CTO / VP / Head of Development may change a task's status.
  async setStatus(id: number, status: string, user: AuthUser) {
    const task = await this.fs.findById<TaskDoc>(COL.tasks, id);
    if (!task) throw new NotFoundException('Task not found.');
    const canEdit =
      STATUS_EDIT_TIERS.includes(user.role.permissionTier) ||
      user.role.name === STATUS_EDIT_ROLE;
    if (!canEdit)
      throw new ForbiddenException(
        'Only the CEO, CTO, VP Engineering or Head of Development can change a task status.',
      );
    return this.fs.update<TaskDoc>(COL.tasks, id, { status });
  }

  // Assignee submits their task — only accepted up to the due date/time.
  async submit(id: number, note: string | undefined, user: AuthUser) {
    const task = await this.fs.findById<TaskDoc>(COL.tasks, id);
    if (!task) throw new NotFoundException('Task not found.');
    if (task.assignedTo !== user.id)
      throw new ForbiddenException('You can only submit a task assigned to you.');
    if (task.status === 'DONE')
      throw new BadRequestException('This task is already completed.');
    if (task.dueDate && Date.now() > new Date(task.dueDate).getTime())
      throw new ForbiddenException(
        'The deadline has passed — this task can no longer be submitted on the portal.',
      );
    return this.fs.update<TaskDoc>(COL.tasks, id, {
      submittedAt: new Date(),
      submissionNote: note?.trim() || null,
      status: 'REVIEW',
    });
  }

  // CEO / CTO / VP / head reviews a submission, leaves feedback, optionally decides.
  async review(
    id: number,
    dto: { feedback?: string; status?: string },
    reviewer: AuthUser,
  ) {
    const task = await this.fs.findById<TaskDoc>(COL.tasks, id);
    if (!task) throw new NotFoundException('Task not found.');
    const feedback = dto.feedback?.trim();
    if (!feedback && !dto.status)
      throw new BadRequestException('Provide feedback or a status decision.');

    const data: Record<string, unknown> = {
      reviewFeedback: feedback || task.reviewFeedback || null,
      reviewedAt: new Date(),
      reviewedBy: reviewer.id,
    };
    if (dto.status) data.status = dto.status;
    const updated = await this.fs.update<TaskDoc>(COL.tasks, id, data);

    if (task.assignedTo && task.assignedTo !== reviewer.id) {
      const decision = dto.status ? ` Status: ${dto.status}.` : '';
      await this.notifications.createForUser(
        task.assignedTo,
        `Feedback on "${task.title}"`,
        `${reviewer.firstName} ${reviewer.lastName} reviewed your task.${decision}${feedback ? ` Feedback: ${feedback}` : ''}`,
      );
    }
    return (await this.hydrate([updated]))[0];
  }

  // QA validation: move a task to REVIEW / TESTING / DONE (QA_VALIDATE).
  async validate(id: number, status: string, qaUserId: number) {
    const task = await this.fs.findById<TaskDoc>(COL.tasks, id);
    if (!task) throw new NotFoundException('Task not found.');
    if (!['REVIEW', 'TESTING', 'DONE'].includes(status))
      throw new BadRequestException(
        'QA can only move a task to REVIEW, TESTING or DONE.',
      );
    const updated = await this.fs.update<TaskDoc>(COL.tasks, id, { status });
    if (task.assignedTo && task.assignedTo !== qaUserId)
      await this.notifications.createForUser(
        task.assignedTo,
        'Task validated by QA',
        `"${task.title}" was moved to ${status} by QA.`,
      );
    return updated;
  }

  private async assertAssignee(userId: number) {
    const u = await this.fs.findById(COL.users, userId);
    if (!u) throw new BadRequestException('Assignee user does not exist.');
  }

  private async ensureExists(id: number) {
    const t = await this.fs.findById(COL.tasks, id);
    if (!t) throw new NotFoundException('Task not found.');
  }
}
