import { Injectable, NotFoundException } from '@nestjs/common';
import { BugStatus } from '../common/enums';
import { FirestoreService } from '../firebase/firestore.service';
import { COL } from '../common/collections';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateBugDto } from './dto/bug.dto';

@Injectable()
export class QaService {
  constructor(
    private readonly fs: FirestoreService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(dto: CreateBugDto, reporterId: number) {
    const bug = await this.fs.create<any>(COL.bugs, {
      taskId: dto.taskId ?? null,
      title: dto.title,
      description: dto.description ?? null,
      severity: dto.severity ?? 'MEDIUM',
      status: 'OPEN',
      reportedBy: reporterId,
    });
    if (dto.taskId) {
      const task = await this.fs.findById<{ assignedTo?: number | null; title: string }>(
        COL.tasks,
        dto.taskId,
      );
      if (task?.assignedTo && task.assignedTo !== reporterId)
        await this.notifications.createForUser(
          task.assignedTo,
          'Bug reported by QA',
          `A ${bug.severity} bug was filed on "${task.title}": ${bug.title}`,
        );
    }
    return bug;
  }

  async findAll(taskId?: number) {
    const bugs = await this.fs.findMany<any>(
      COL.bugs,
      taskId != null ? { where: { taskId } } : {},
    );
    bugs.sort((a, b) => b.id - a.id);
    const tIds = [...new Set(bugs.map((b) => b.taskId).filter((x): x is number => x != null))];
    const tMap = new Map<number, any>();
    await Promise.all(
      tIds.map(async (id) => {
        const t = await this.fs.findById<any>(COL.tasks, id);
        if (t) tMap.set(id, { id: t.id, title: t.title });
      }),
    );
    return bugs.map((b) => ({
      ...b,
      task: b.taskId != null ? tMap.get(b.taskId) ?? null : null,
    }));
  }

  async setStatus(id: number, status: BugStatus) {
    const bug = await this.fs.findById(COL.bugs, id);
    if (!bug) throw new NotFoundException('Bug not found.');
    return this.fs.update(COL.bugs, id, { status });
  }
}
