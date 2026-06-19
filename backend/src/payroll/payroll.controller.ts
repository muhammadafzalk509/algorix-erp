import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { Capability } from '../common/enums';
import { PayrollService } from './payroll.service';
import { CreateEntryDto, SetSalaryDto } from './dto/payroll.dto';
import { RequireCapability } from '../common/decorators/require-capability.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('api/payroll')
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get('salaries')
  @RequireCapability(Capability.PAYROLL_VIEW)
  listSalaries() {
    return this.payroll.listSalaries();
  }

  @Put('salaries/:userId')
  @RequireCapability(Capability.PAYROLL_EDIT)
  setSalary(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: SetSalaryDto,
    @CurrentUser('id') actorId: number,
  ) {
    return this.payroll.setSalary(userId, dto, actorId);
  }

  @Get('entries')
  @RequireCapability(Capability.PAYROLL_VIEW)
  listEntries(
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.payroll.listEntries({
      userId: userId ? Number(userId) : undefined,
      from,
      to,
    });
  }

  @Post('entries')
  @RequireCapability(Capability.PAYROLL_EDIT)
  createEntry(@Body() dto: CreateEntryDto, @CurrentUser('id') actorId: number) {
    return this.payroll.createEntry(dto, actorId);
  }

  @Get('export')
  @RequireCapability(Capability.PAYROLL_VIEW)
  @Header('Content-Type', 'text/csv')
  @Header('Content-Disposition', 'attachment; filename="payroll.csv"')
  async export(
    @Res() res: Response,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const csv = await this.payroll.exportCsv({
      userId: userId ? Number(userId) : undefined,
      from,
      to,
    });
    res.send(csv);
  }

  // Salary-change audit — CEO/CTO (PAYROLL_AUDIT), not HR.
  @Get('audit')
  @RequireCapability(Capability.PAYROLL_AUDIT)
  audit() {
    return this.payroll.auditLog();
  }

  @Get(':userId/history')
  @RequireCapability(Capability.PAYROLL_VIEW)
  history(@Param('userId', ParseIntPipe) userId: number) {
    return this.payroll.history(userId);
  }
}
