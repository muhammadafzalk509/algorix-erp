import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Capability, PermissionTier } from '../common/enums';
import { FirestoreService } from '../firebase/firestore.service';
import { COL } from '../common/collections';
import { NotificationsGateway } from './notifications.gateway';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { Audience, BroadcastDto } from './dto/notification.dto';

const T = PermissionTier;

const AUDIENCE_RULES: Record<
  Audience,
  { category: string; recipients: PermissionTier[]; canSend: (u: AuthUser) => boolean }
> = {
  GLOBAL: {
    category: 'GLOBAL',
    recipients: [T.TIER_0, T.TIER_1, T.TIER_2, T.TIER_3, T.TIER_4, T.TIER_5, T.TIER_6, T.TIER_7],
    canSend: (u) => u.role.capabilities.includes(Capability.NOTIFY_GLOBAL),
  },
  TECHNICAL: {
    category: 'TECHNICAL',
    recipients: [T.TIER_1, T.TIER_2, T.TIER_3, T.TIER_4, T.TIER_5, T.TIER_6],
    canSend: (u) => senderTierIn(u, [T.TIER_0, T.TIER_1]),
  },
  TEAM: {
    category: 'TEAM',
    recipients: [T.TIER_2, T.TIER_3, T.TIER_4, T.TIER_5, T.TIER_6],
    canSend: (u) => senderTierIn(u, [T.TIER_0, T.TIER_1, T.TIER_2]),
  },
  DEV: {
    category: 'DEV_INSTRUCTION',
    recipients: [T.TIER_5, T.TIER_6],
    canSend: (u) => senderTierIn(u, [T.TIER_0, T.TIER_1, T.TIER_2, T.TIER_3]),
  },
};

const senderTierIn = (u: AuthUser, tiers: PermissionTier[]): boolean =>
  tiers.includes(u.role.permissionTier as PermissionTier);

export interface NotificationDoc {
  id: number;
  userId: number;
  title: string;
  message: string;
  isRead: boolean;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly fs: FirestoreService,
    private readonly gateway: NotificationsGateway,
  ) {}

  async createForUser(userId: number, title: string, message: string) {
    const notification = await this.fs.create(COL.notifications, {
      userId,
      title,
      message,
      isRead: false,
      senderId: null,
      senderRole: null,
      category: null,
    });
    this.gateway.emitToUser(userId, 'notification', notification);
    return notification;
  }

  async broadcast(actor: AuthUser, dto: BroadcastDto) {
    const rule = AUDIENCE_RULES[dto.audience];
    if (!rule.canSend(actor))
      throw new ForbiddenException(
        `You are not allowed to broadcast to "${dto.audience}".`,
      );

    const roles = await this.fs.findMany<{ id: number; permissionTier: string }>(COL.roles);
    const tierSet = new Set<string>(rule.recipients as string[]);
    const allowedRoleIds = new Set(
      roles.filter((r) => tierSet.has(r.permissionTier)).map((r) => r.id),
    );
    const active = await this.fs.findMany<{ id: number; roleId: number }>(COL.users, {
      where: { status: 'ACTIVE' },
    });
    const recipients = active.filter((u) => allowedRoleIds.has(u.roleId));

    for (const r of recipients) {
      const n = await this.fs.create(COL.notifications, {
        userId: r.id,
        title: dto.title,
        message: dto.message,
        isRead: false,
        senderId: actor.id,
        senderRole: actor.role.name,
        category: rule.category,
      });
      this.gateway.emitToUser(r.id, 'notification', n);
    }
    return { ok: true, delivered: recipients.length, category: rule.category };
  }

  async findForUser(userId: number) {
    const list = await this.fs.findMany<NotificationDoc>(COL.notifications, {
      where: { userId },
    });
    list.sort((a, b) => b.id - a.id);
    return list;
  }

  async markRead(id: number, userId: number) {
    const n = await this.fs.findById<NotificationDoc>(COL.notifications, id);
    if (!n || n.userId !== userId)
      throw new NotFoundException('Notification not found.');
    return this.fs.update(COL.notifications, id, { isRead: true });
  }

  async markAllRead(userId: number) {
    await this.fs.updateMany(
      COL.notifications,
      { userId, isRead: false },
      { isRead: true },
    );
    return { ok: true };
  }
}
