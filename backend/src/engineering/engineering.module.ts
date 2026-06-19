import {
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  UseGuards,
} from '@nestjs/common';
import { PermissionTier } from '../common/enums';
import { FirestoreService } from '../firebase/firestore.service';
import { COL } from '../common/collections';
import { Tiers } from '../common/decorators/tiers.decorator';
import { TierGuard } from '../auth/guards/tier.guard';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';

// VP Engineering oversees four teams. Each team is a set of roles (head + members).
interface TeamDef {
  key: string;
  label: string;
  roles: string[];
}

const TEAMS: TeamDef[] = [
  { key: 'development', label: 'Development', roles: ['Head of Developer', 'Developer'] },
  { key: 'qa', label: 'QA / Testing', roles: ['Tester Head', 'QA'] },
  { key: 'documentation', label: 'Documentation', roles: ['Head of Documentation', 'Documentation Specialist'] },
  { key: 'iot', label: 'IoT', roles: ['IoT Head', 'IoT Engineer'] },
];

const DONE = 'DONE';
const IN_PROGRESS_STATES = ['IN_PROGRESS', 'REVIEW', 'TESTING'];

interface PersonStat {
  id: number;
  name: string;
  role: string;
  total: number;
  done: number;
  inProgress: number;
  overdue: number;
  completion: number;
}

@Injectable()
class EngineeringService {
  constructor(private readonly fs: FirestoreService) {}

  private readonly roleToTeam = new Map<string, string>(
    TEAMS.flatMap((t) => t.roles.map((r) => [r, t.key] as const)),
  );

  private get roleNames(): string[] {
    return TEAMS.flatMap((t) => t.roles);
  }

  // Active users whose role belongs to one of the engineering teams (role attached).
  private async activeTeamUsers() {
    const roles = await this.fs.findMany<any>(COL.roles);
    const roleMap = new Map(roles.map((r) => [r.id, r]));
    const names = new Set(this.roleNames);
    const users = await this.fs.findMany<any>(COL.users, { where: { status: 'ACTIVE' } });
    return users
      .map((u) => ({ ...u, role: roleMap.get(u.roleId) }))
      .filter((u) => u.role && names.has(u.role.name))
      .sort((a, b) => String(a.firstName ?? '').localeCompare(String(b.firstName ?? '')));
  }

  // Per-team progress, computed from the tasks assigned to each team member.
  async overview() {
    const users = await this.activeTeamUsers();
    const allTasks = await this.fs.findMany<any>(COL.tasks);
    const tasksByUser = new Map<number, any[]>();
    for (const t of allTasks) {
      if (t.assignedTo == null) continue;
      const arr = tasksByUser.get(t.assignedTo) ?? [];
      arr.push(t);
      tasksByUser.set(t.assignedTo, arr);
    }

    const now = Date.now();
    const teams = TEAMS.map((t) => ({
      key: t.key,
      label: t.label,
      roles: t.roles,
      members: 0,
      totalTasks: 0,
      done: 0,
      inProgress: 0,
      todo: 0,
      overdue: 0,
      completion: 0,
      people: [] as PersonStat[],
    }));
    const byKey = new Map(teams.map((t) => [t.key, t]));

    for (const u of users) {
      const key = this.roleToTeam.get(u.role.name);
      const team = key ? byKey.get(key) : undefined;
      if (!team) continue;

      let total = 0;
      let done = 0;
      let inProg = 0;
      let todo = 0;
      let overdue = 0;
      for (const task of tasksByUser.get(u.id) ?? []) {
        total++;
        if (task.status === DONE) done++;
        else if (IN_PROGRESS_STATES.includes(task.status)) inProg++;
        else todo++;
        if (task.status !== DONE && task.dueDate && new Date(task.dueDate).getTime() < now)
          overdue++;
      }

      team.members++;
      team.totalTasks += total;
      team.done += done;
      team.inProgress += inProg;
      team.todo += todo;
      team.overdue += overdue;
      team.people.push({
        id: u.id,
        name: `${u.firstName} ${u.lastName}`,
        role: u.role.name,
        total,
        done,
        inProgress: inProg,
        overdue,
        completion: total ? Math.round((done / total) * 100) : 0,
      });
    }

    for (const t of teams)
      t.completion = t.totalTasks ? Math.round((t.done / t.totalTasks) * 100) : 0;

    const totals = teams.reduce(
      (a, t) => ({
        members: a.members + t.members,
        totalTasks: a.totalTasks + t.totalTasks,
        done: a.done + t.done,
      }),
      { members: 0, totalTasks: 0, done: 0 },
    );

    return {
      generatedAt: new Date().toISOString(),
      teams,
      totals: {
        ...totals,
        completion: totals.totalTasks
          ? Math.round((totals.done / totals.totalTasks) * 100)
          : 0,
      },
    };
  }

  // The single team a department head owns, derived from their role.
  // Powers each head's independent department portal.
  async myTeam(roleName: string) {
    const def = TEAMS.find((t) => t.roles.includes(roleName));
    if (!def)
      throw new ForbiddenException('No department portal is available for your role.');
    const [overview, groups] = await Promise.all([this.overview(), this.teams()]);
    return {
      team: overview.teams.find((t) => t.key === def.key) ?? null,
      members: groups.find((g) => g.key === def.key)?.members ?? [],
    };
  }

  // Assignable people grouped by team — powers the assignment dropdowns.
  async teams() {
    const users = await this.activeTeamUsers();
    return TEAMS.map((t) => ({
      key: t.key,
      label: t.label,
      members: users
        .filter((u) => t.roles.includes(u.role.name))
        .map((u) => ({
          id: u.id,
          name: `${u.firstName} ${u.lastName}`,
          role: u.role.name,
          tier: u.role.permissionTier,
        })),
    }));
  }
}

// Engineering Hub — VP Engineering plus the tiers above (CTO, CEO).
@UseGuards(TierGuard)
@Controller('api/engineering')
class EngineeringController {
  constructor(private readonly svc: EngineeringService) {}

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1, PermissionTier.TIER_2)
  @Get('overview')
  overview() {
    return this.svc.overview();
  }

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1, PermissionTier.TIER_2)
  @Get('teams')
  teams() {
    return this.svc.teams();
  }

  // Department heads — their own team only (Head of Developer / Tester Head /
  // IoT Head = TIER_3, Head of Documentation = TIER_4).
  @Tiers(PermissionTier.TIER_3, PermissionTier.TIER_4)
  @Get('my-team')
  myTeam(@CurrentUser() user: AuthUser) {
    return this.svc.myTeam(user.role.name);
  }
}

@Module({
  controllers: [EngineeringController],
  providers: [EngineeringService],
})
export class EngineeringModule {}
