import { Module } from '@nestjs/common';
import {
  Controller,
  Get,
  Injectable,
  NotFoundException,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { PermissionTier } from '../common/enums';
import { FirestoreService } from '../firebase/firestore.service';
import { COL } from '../common/collections';
import { Tiers } from '../common/decorators/tiers.decorator';
import { TierGuard } from '../auth/guards/tier.guard';

// In-memory tally (Firestore has no groupBy).
function tally<T>(items: T[], keyFn: (t: T) => string) {
  const m = new Map<string, number>();
  for (const i of items) {
    const k = keyFn(i);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([name, value]) => ({ name, value }));
}

@Injectable()
class AnalyticsService {
  constructor(private readonly fs: FirestoreService) {}

  async revenue() {
    const invoices = await this.fs.findMany<any>(COL.invoices);
    const agg = (s: string) => {
      const rows = invoices.filter((i) => i.status === s);
      return {
        amount: rows.reduce((x, r) => x + Number(r.amount ?? 0), 0),
        count: rows.length,
      };
    };
    const paid = agg('PAID');
    const pending = agg('PENDING');
    const overdue = agg('OVERDUE');
    return {
      totalInvoiced: paid.amount + pending.amount + overdue.amount,
      paid,
      pending,
      overdue,
      breakdown: [
        { name: 'Paid', value: paid.amount },
        { name: 'Pending', value: pending.amount },
        { name: 'Overdue', value: overdue.amount },
      ],
    };
  }

  async productivity() {
    const logs = await this.fs.findMany<any>(COL.taskLogs);
    const byUser = new Map<number, { hours: number; entries: number }>();
    for (const l of logs) {
      const r = byUser.get(l.userId) ?? { hours: 0, entries: 0 };
      r.hours += Number(l.hoursSpent ?? 0);
      r.entries += 1;
      byUser.set(l.userId, r);
    }
    const users = await this.fs.findMany<any>(COL.users);
    const uMap = new Map(users.map((u) => [u.id, u]));
    const byDeveloper = [...byUser.entries()].map(([userId, v]) => {
      const u = uMap.get(userId);
      return {
        userId,
        name: u ? `${u.firstName} ${u.lastName}` : `#${userId}`,
        hours: v.hours,
        entries: v.entries,
      };
    });
    return {
      totalHours: byDeveloper.reduce((s, d) => s + d.hours, 0),
      byDeveloper,
    };
  }

  async projects() {
    const ps = await this.fs.findMany<any>(COL.projects);
    return {
      total: ps.length,
      totalBudget: ps.reduce((s, p) => s + Number(p.budget ?? 0), 0),
      breakdown: tally(ps, (p) => p.status),
    };
  }

  // Comprehensive single-project report.
  async projectReport(projectId: number) {
    const full = await this.fs.findById<any>(COL.projects, projectId);
    if (!full) throw new NotFoundException('Project not found.');
    const project = {
      id: full.id,
      title: full.title,
      status: full.status,
      startDate: full.startDate ?? null,
      endDate: full.endDate ?? null,
    };

    const projTasks = await this.fs.findMany<any>(COL.tasks, { where: { projectId } });
    const taskIds = new Set(projTasks.map((t) => t.id));
    const totalTasks = projTasks.length;
    const doneTasks = projTasks.filter((t) => t.status === 'DONE').length;

    const allLogs = await this.fs.findMany<any>(COL.taskLogs);
    const projLogs = allLogs.filter((l) => taskIds.has(l.taskId));
    const byUser = new Map<number, { hours: number; entries: number }>();
    for (const l of projLogs) {
      const r = byUser.get(l.userId) ?? { hours: 0, entries: 0 };
      r.hours += Number(l.hoursSpent ?? 0);
      r.entries += 1;
      byUser.set(l.userId, r);
    }
    const users = await this.fs.findMany<any>(COL.users);
    const uMap = new Map(users.map((u) => [u.id, u]));
    const developerPerformance = [...byUser.entries()].map(([userId, v]) => {
      const u = uMap.get(userId);
      return {
        userId,
        name: u ? `${u.firstName} ${u.lastName}` : `#${userId}`,
        hours: v.hours,
        logEntries: v.entries,
      };
    });

    const allBugs = await this.fs.findMany<any>(COL.bugs);
    const projBugs = allBugs.filter((b) => b.taskId != null && taskIds.has(b.taskId));

    const milestones = (await this.fs.findMany<any>(COL.milestones, { where: { projectId } }))
      .sort(
        (a, b) =>
          new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime(),
      )
      .map((m) => ({
        id: m.id,
        name: m.name,
        status: m.status,
        completion: m.completion,
        dueDate: m.dueDate ?? null,
      }));

    const items = await this.fs.findMany<any>(COL.ganttItems, { where: { projectId } });
    const projectedEnd = items.reduce<Date | null>(
      (max, i) =>
        !max || new Date(i.endDate) > max ? new Date(i.endDate) : max,
      null,
    );
    const plannedEnd = project.endDate;
    const deviationDays =
      plannedEnd && projectedEnd
        ? Math.round(
            (new Date(projectedEnd).getTime() - new Date(plannedEnd).getTime()) /
              86400000,
          )
        : null;

    return {
      project,
      taskCompletion: {
        total: totalTasks,
        done: doneTasks,
        ratio: totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0,
        byStatus: tally(projTasks, (t) => t.status),
      },
      developerPerformance,
      qaFeedback: {
        totalBugs: projBugs.length,
        bySeverity: tally(projBugs, (b) => b.severity),
        byStatus: tally(projBugs, (b) => b.status),
      },
      timeline: { plannedEnd, projectedEnd, deviationDays },
      milestones,
    };
  }

  async tasks() {
    const ts = await this.fs.findMany<any>(COL.tasks);
    return {
      byStatus: tally(ts, (t) => t.status),
      byPriority: tally(ts, (t) => t.priority),
    };
  }
}

@UseGuards(TierGuard)
@Controller('api/analytics')
class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1, PermissionTier.TIER_2)
  @Get('revenue')
  revenue() {
    return this.analytics.revenue();
  }

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1, PermissionTier.TIER_2, PermissionTier.TIER_3)
  @Get('productivity')
  productivity() {
    return this.analytics.productivity();
  }

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1, PermissionTier.TIER_2)
  @Get('projects')
  projects() {
    return this.analytics.projects();
  }

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1, PermissionTier.TIER_2, PermissionTier.TIER_3)
  @Get('tasks')
  tasks() {
    return this.analytics.tasks();
  }

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1, PermissionTier.TIER_2, PermissionTier.TIER_3)
  @Get('project/:id/report')
  projectReport(@Param('id', ParseIntPipe) id: number) {
    return this.analytics.projectReport(id);
  }
}

@Module({
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
