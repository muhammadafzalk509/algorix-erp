import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FirestoreService } from '../firebase/firestore.service';
import { COL } from '../common/collections';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { seesAllData } from '../common/tier.util';
import { CreateTaskLogDto } from './dto/task-log.dto';

const MAX_HOURS_PER_DAY = 12;

// Normalize any date to UTC midnight so "once per task per day" can be enforced.
function dayUtc(input: string | Date): Date {
  const d = new Date(input);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
const sameDay = (a: Date | string, b: Date) =>
  dayUtc(a).getTime() === b.getTime();

export interface LogDoc {
  id: number;
  taskId: number;
  userId: number;
  workDescription?: string | null;
  hoursSpent: number;
  date: Date;
  githubUrl?: string | null;
  commitId?: string | null;
  branchName?: string | null;
}

@Injectable()
export class TaskLogsService {
  constructor(private readonly fs: FirestoreService) {}

  private async hydrate(logs: LogDoc[]) {
    const uIds = [...new Set(logs.map((l) => l.userId))];
    const tIds = [...new Set(logs.map((l) => l.taskId))];
    const uMap = new Map<number, any>();
    await Promise.all(
      uIds.map(async (id) => {
        const u = await this.fs.findById<any>(COL.users, id);
        if (u) uMap.set(id, { id: u.id, firstName: u.firstName, lastName: u.lastName });
      }),
    );
    const tMap = new Map<number, any>();
    await Promise.all(
      tIds.map(async (id) => {
        const t = await this.fs.findById<any>(COL.tasks, id);
        if (t) tMap.set(id, { id: t.id, title: t.title });
      }),
    );
    return logs.map((l) => ({
      ...l,
      user: uMap.get(l.userId) ?? null,
      task: tMap.get(l.taskId) ?? null,
    }));
  }

  async create(dto: CreateTaskLogDto, user: AuthUser) {
    const date = dayUtc(dto.date);
    const today = dayUtc(new Date());
    if (date.getTime() > today.getTime())
      throw new BadRequestException('Cannot log work for a future date.');

    const task = await this.fs.findById<{ assignedTo?: number | null }>(COL.tasks, dto.taskId);
    if (!task) throw new NotFoundException('Task not found.');
    if (task.assignedTo !== user.id)
      throw new ForbiddenException('You can only log work on your own tasks.');

    // One log per task per day.
    const myLogs = await this.fs.findMany<LogDoc>(COL.taskLogs, { where: { userId: user.id } });
    if (myLogs.some((l) => l.taskId === dto.taskId && sameDay(l.date, date)))
      throw new BadRequestException('You already logged this task for this day.');

    // Max 12 hours/day across ALL tasks.
    const usedHours = myLogs
      .filter((l) => sameDay(l.date, date))
      .reduce((s, l) => s + Number(l.hoursSpent), 0);
    if (usedHours + dto.hoursSpent > MAX_HOURS_PER_DAY)
      throw new BadRequestException(
        `Daily limit exceeded. ${usedHours}h already logged; max ${MAX_HOURS_PER_DAY}h/day.`,
      );

    return this.fs.create<LogDoc>(COL.taskLogs, {
      taskId: dto.taskId,
      userId: user.id,
      workDescription: dto.workDescription ?? null,
      hoursSpent: dto.hoursSpent,
      date,
      githubUrl: dto.githubUrl ?? null,
      commitId: dto.commitId ?? null,
      branchName: dto.branchName ?? null,
    });
  }

  // TIER_3+ see all logs; TIER_5 sees only their own.
  async findAll(user: AuthUser, taskId?: number) {
    const where: Record<string, unknown> = {};
    if (!seesAllData(user.role.permissionTier)) where.userId = user.id;
    if (taskId) where.taskId = taskId;
    const logs = await this.fs.findMany<LogDoc>(COL.taskLogs, { where });
    logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return this.hydrate(logs);
  }

  async report(
    period: 'daily' | 'weekly' | 'monthly',
    user: AuthUser,
    userId?: number,
  ) {
    const days = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;
    const from = dayUtc(new Date());
    from.setUTCDate(from.getUTCDate() - (days - 1));

    const where: Record<string, unknown> = {};
    if (!seesAllData(user.role.permissionTier)) where.userId = user.id;
    else if (userId) where.userId = userId;

    let logs = await this.fs.findMany<LogDoc>(COL.taskLogs, { where });
    logs = logs.filter((l) => new Date(l.date).getTime() >= from.getTime());
    logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const hydrated = await this.hydrate(logs);

    const totalHours = logs.reduce((s, l) => s + Number(l.hoursSpent), 0);
    return {
      period,
      from: from.toISOString().slice(0, 10),
      entries: logs.length,
      totalHours,
      logs: hydrated,
    };
  }
}
