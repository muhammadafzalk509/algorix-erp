import { Injectable, Logger } from '@nestjs/common';
import { FirestoreService } from '../firebase/firestore.service';
import { COL } from '../common/collections';

export interface AuditRecord {
  userId?: number | null;
  action: string;
  method: string;
  path: string;
  entity?: string | null;
  entityId?: string | null;
  statusCode?: number | null;
  metadata?: unknown;
  ip?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly fs: FirestoreService) {}

  // Fire-and-forget: auditing must never break the request it observes.
  async record(entry: AuditRecord): Promise<void> {
    try {
      await this.fs.create(COL.auditLogs, {
        userId: entry.userId ?? null,
        action: entry.action,
        method: entry.method,
        path: entry.path,
        entity: entry.entity ?? null,
        entityId: entry.entityId ?? null,
        statusCode: entry.statusCode ?? null,
        metadata: entry.metadata ?? null,
        ip: entry.ip ?? null,
      });
    } catch (err) {
      this.logger.warn(`Failed to write audit log: ${String(err)}`);
    }
  }

  async findAll(filters: {
    userId?: number;
    entity?: string;
    skip?: number;
    take?: number;
  }) {
    const take = Math.min(filters.take ?? 50, 200);
    const where: Record<string, unknown> = {};
    if (filters.userId != null) where.userId = filters.userId;
    if (filters.entity) where.entity = filters.entity;
    const all = await this.fs.findMany<any>(COL.auditLogs, { where });
    all.sort((a, b) => b.id - a.id);
    const skip = filters.skip ?? 0;
    return { items: all.slice(skip, skip + take), total: all.length };
  }
}
