import { Injectable } from '@nestjs/common';
import { FirestoreService } from '../firebase/firestore.service';
import { COL } from '../common/collections';
import { OverrideDto } from './dto/attendance.dto';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  canSeeAllUsers,
  departmentOfRole,
  rolesInDepartment,
} from '../common/department.util';

// Minutes a user must accumulate in a day to be auto-marked PRESENT.
export const PRESENT_THRESHOLD_MIN = 20;

function dayKey(d: Date | string): Date {
  const x = new Date(d);
  return new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate()));
}

export interface SessionDoc {
  id: number;
  userId: number;
  date: Date;
  loginAt: Date;
  lastSeenAt: Date;
  durationMin: number;
  status: string;
  markedBy?: number | null;
}

@Injectable()
export class AttendanceService {
  constructor(private readonly fs: FirestoreService) {}

  private async sessionForDay(userId: number, date: Date) {
    const mine = await this.fs.findMany<SessionDoc>(COL.attendanceSessions, {
      where: { userId },
    });
    return mine.find((s) => dayKey(s.date).getTime() === date.getTime()) ?? null;
  }

  private async hydrate(sessions: SessionDoc[]) {
    const ids = [...new Set(sessions.map((s) => s.userId))];
    const map = new Map<number, any>();
    await Promise.all(
      ids.map(async (id) => {
        const u = await this.fs.findById<any>(COL.users, id);
        if (u)
          map.set(id, {
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
          });
      }),
    );
    return sessions.map((s) => ({ ...s, user: map.get(s.userId) ?? null }));
  }

  // Heartbeat: extend today's session and auto-mark PRESENT past the threshold.
  async ping(userId: number) {
    const date = dayKey(new Date());
    const now = new Date();
    const existing = await this.sessionForDay(userId, date);

    if (!existing) {
      return this.fs.create(COL.attendanceSessions, {
        userId,
        date,
        loginAt: now,
        lastSeenAt: now,
        durationMin: 0,
        status: 'ABSENT',
        markedBy: null,
      });
    }

    const durationMin = Math.round(
      (now.getTime() - new Date(existing.loginAt).getTime()) / 60000,
    );
    const status =
      existing.status === 'MANUAL'
        ? existing.status
        : durationMin >= PRESENT_THRESHOLD_MIN
          ? 'PRESENT'
          : existing.status;

    return this.fs.update(COL.attendanceSessions, existing.id, {
      lastSeenAt: now,
      durationMin,
      status,
    });
  }

  async mySessions(userId: number, take = 30) {
    const list = await this.fs.findMany<SessionDoc>(COL.attendanceSessions, {
      where: { userId },
    });
    list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return list.slice(0, take);
  }

  // CEO/CTO/VPE/HR -> null (all); HoD -> own dept; else -> self only.
  private async allowedUserIds(actor: AuthUser): Promise<number[] | null> {
    const tier = actor.role.permissionTier;
    if (canSeeAllUsers(tier) || tier === 'TIER_7') return null;
    const dept = departmentOfRole(actor.role.name);
    const roleNames = dept ? rolesInDepartment(dept) : [];
    if (roleNames.length === 0) return [actor.id];
    const roles = await this.fs.findMany<any>(COL.roles);
    const ids = new Set(roles.filter((r) => roleNames.includes(r.name)).map((r) => r.id));
    const users = await this.fs.findMany<any>(COL.users);
    return users.filter((u) => ids.has(u.roleId)).map((u) => u.id);
  }

  private inRange(sessions: SessionDoc[], from?: string, to?: string) {
    let out = sessions;
    if (from) {
      const f = dayKey(from).getTime();
      out = out.filter((s) => dayKey(s.date).getTime() >= f);
    }
    if (to) {
      const t = dayKey(to).getTime();
      out = out.filter((s) => dayKey(s.date).getTime() <= t);
    }
    return out;
  }

  async listAll(
    actor: AuthUser,
    filters: { from?: string; to?: string; userId?: number },
  ) {
    const allowed = await this.allowedUserIds(actor);
    if (filters.userId && allowed && !allowed.includes(filters.userId)) return [];
    let sessions = await this.fs.findMany<SessionDoc>(COL.attendanceSessions);
    if (filters.userId) sessions = sessions.filter((s) => s.userId === filters.userId);
    else if (allowed) sessions = sessions.filter((s) => allowed.includes(s.userId));
    sessions = this.inRange(sessions, filters.from, filters.to);
    sessions.sort(
      (a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime() ||
        a.userId - b.userId,
    );
    return this.hydrate(sessions);
  }

  async report(
    actor: AuthUser,
    scope: string,
    from?: string,
    to?: string,
    userId?: number,
  ) {
    let f = from;
    let t = to;
    if (!f && !t) {
      const today = dayKey(new Date());
      t = today.toISOString();
      const days = scope === 'monthly' ? 29 : scope === 'weekly' ? 6 : 0;
      f = new Date(today.getTime() - days * 86400000).toISOString();
    }

    const allowed = await this.allowedUserIds(actor);
    if (userId && allowed && !allowed.includes(userId))
      return { scope, from: f?.slice(0, 10), to: t?.slice(0, 10), summary: [], sessions: [] };

    let sessions = await this.fs.findMany<SessionDoc>(COL.attendanceSessions);
    if (userId) sessions = sessions.filter((s) => s.userId === userId);
    else if (allowed) sessions = sessions.filter((s) => allowed.includes(s.userId));
    sessions = this.inRange(sessions, f, t);
    sessions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const hydrated = await this.hydrate(sessions);

    const byUser = new Map<
      number,
      { userId: number; name: string; presentDays: number; totalDays: number }
    >();
    for (const s of hydrated) {
      const row =
        byUser.get(s.userId) ?? {
          userId: s.userId,
          name: s.user ? `${s.user.firstName} ${s.user.lastName}` : `#${s.userId}`,
          presentDays: 0,
          totalDays: 0,
        };
      row.totalDays += 1;
      if (s.status !== 'ABSENT') row.presentDays += 1;
      byUser.set(s.userId, row);
    }

    return {
      scope,
      from: f?.slice(0, 10),
      to: t?.slice(0, 10),
      summary: Array.from(byUser.values()),
      sessions: hydrated,
    };
  }

  // Manager override (ATTENDANCE_MANAGE). Upserts the day's session.
  async override(dto: OverrideDto, actorId: number) {
    const date = dayKey(dto.date);
    const existing = await this.sessionForDay(dto.userId, date);
    let session: SessionDoc;
    if (existing) {
      session = await this.fs.update<SessionDoc>(COL.attendanceSessions, existing.id, {
        status: dto.status,
        markedBy: actorId,
      });
    } else {
      const now = new Date();
      session = await this.fs.create<SessionDoc>(COL.attendanceSessions, {
        userId: dto.userId,
        date,
        loginAt: now,
        lastSeenAt: now,
        durationMin: 0,
        status: dto.status,
        markedBy: actorId,
      });
    }
    return (await this.hydrate([session]))[0];
  }
}
