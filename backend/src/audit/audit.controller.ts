import { Controller, Get, Query } from '@nestjs/common';
import { Capability } from '../common/enums';
import { AuditService } from './audit.service';
import { RequireCapability } from '../common/decorators/require-capability.decorator';

@Controller('api/audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  // Read the audit trail. CEO/CTO hold AUDIT_VIEW (see seed).
  @Get()
  @RequireCapability(Capability.AUDIT_VIEW)
  findAll(
    @Query('userId') userId?: string,
    @Query('entity') entity?: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
  ) {
    return this.audit.findAll({
      userId: userId ? Number(userId) : undefined,
      entity: entity || undefined,
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined,
    });
  }
}
