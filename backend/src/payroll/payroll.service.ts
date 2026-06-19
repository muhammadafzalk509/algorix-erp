import { BadRequestException, Injectable } from '@nestjs/common';
import { FirestoreService } from '../firebase/firestore.service';
import { COL } from '../common/collections';
import { CreateEntryDto, SetSalaryDto } from './dto/payroll.dto';

@Injectable()
export class PayrollService {
  constructor(private readonly fs: FirestoreService) {}

  private async withUser<T extends { userId: number }>(rows: T[]) {
    const ids = [...new Set(rows.map((r) => r.userId))];
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
    return rows.map((r) => ({ ...r, user: map.get(r.userId) ?? null }));
  }

  async listSalaries() {
    const rows = await this.fs.findMany<any>(COL.salaryRecords, {
      orderBy: { field: 'userId', dir: 'asc' },
    });
    return this.withUser(rows);
  }

  // Upsert the employee's current salary; log any change to baseSalary.
  async setSalary(userId: number, dto: SetSalaryDto, actorId: number) {
    const employee = await this.fs.findById(COL.users, userId);
    if (!employee) throw new BadRequestException('Employee not found.');

    const existing = await this.fs.findOne<any>(COL.salaryRecords, { userId });
    let record: any;
    if (existing) {
      record = await this.fs.update(COL.salaryRecords, existing.id, {
        baseSalary: dto.baseSalary,
        currency: dto.currency,
        updatedBy: actorId,
        effectiveAt: new Date(),
      });
    } else {
      record = await this.fs.create(COL.salaryRecords, {
        userId,
        baseSalary: dto.baseSalary,
        currency: dto.currency ?? 'USD',
        updatedBy: actorId,
        effectiveAt: new Date(),
      });
    }

    const oldValue = existing ? String(existing.baseSalary) : 'none';
    if (oldValue !== String(dto.baseSalary)) {
      await this.fs.create(COL.salaryChangeLogs, {
        userId,
        field: 'baseSalary',
        oldValue,
        newValue: String(dto.baseSalary),
        changedBy: actorId,
      });
    }

    return (await this.withUser([record]))[0];
  }

  async listEntries(filters: { userId?: number; from?: string; to?: string }) {
    const where: Record<string, unknown> = {};
    if (filters.userId != null) where.userId = filters.userId;
    let rows = await this.fs.findMany<any>(COL.payrollEntries, { where });
    if (filters.from)
      rows = rows.filter(
        (r) => new Date(r.periodStart).getTime() >= new Date(filters.from!).getTime(),
      );
    if (filters.to)
      rows = rows.filter(
        (r) => new Date(r.periodStart).getTime() <= new Date(filters.to!).getTime(),
      );
    rows.sort(
      (a, b) => new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime(),
    );
    return this.withUser(rows);
  }

  async createEntry(dto: CreateEntryDto, actorId: number) {
    const bonus = dto.bonus ?? 0;
    const deductions = dto.deductions ?? 0;
    const overtime = dto.overtime ?? 0;
    const netPay = dto.baseSalary + bonus + overtime - deductions;

    const entry = await this.fs.create(COL.payrollEntries, {
      userId: dto.userId,
      periodStart: new Date(dto.periodStart),
      periodEnd: new Date(dto.periodEnd),
      baseSalary: dto.baseSalary,
      bonus,
      deductions,
      overtime,
      netPay,
      note: dto.note ?? null,
      createdBy: actorId,
    });
    return (await this.withUser([entry]))[0];
  }

  async history(userId: number) {
    const rows = await this.fs.findMany<any>(COL.payrollEntries, { where: { userId } });
    rows.sort(
      (a, b) => new Date(b.periodStart).getTime() - new Date(a.periodStart).getTime(),
    );
    return rows;
  }

  async auditLog() {
    const rows = await this.fs.findMany<any>(COL.salaryChangeLogs);
    rows.sort((a, b) => b.id - a.id);
    return rows.slice(0, 200);
  }

  // CSV of pay-run entries (no extra dependency; opens in Excel).
  async exportCsv(filters: { userId?: number; from?: string; to?: string }) {
    const rows = await this.listEntries(filters);
    const header = [
      'id',
      'employee',
      'email',
      'periodStart',
      'periodEnd',
      'baseSalary',
      'bonus',
      'overtime',
      'deductions',
      'netPay',
    ];
    const csvEscape = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = rows.map((r: any) =>
      [
        r.id,
        `${r.user?.firstName ?? ''} ${r.user?.lastName ?? ''}`.trim(),
        r.user?.email ?? '',
        new Date(r.periodStart).toISOString().slice(0, 10),
        new Date(r.periodEnd).toISOString().slice(0, 10),
        r.baseSalary,
        r.bonus,
        r.overtime,
        r.deductions,
        r.netPay,
      ]
        .map(csvEscape)
        .join(','),
    );
    return [header.join(','), ...lines].join('\n');
  }
}
