import { Module } from '@nestjs/common';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional } from 'class-validator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import PDFDocument from 'pdfkit';
import { InvoiceStatus, PermissionTier } from '../common/enums';
import { FirestoreService } from '../firebase/firestore.service';
import { COL } from '../common/collections';
import { Tiers } from '../common/decorators/tiers.decorator';
import { TierGuard } from '../auth/guards/tier.guard';

class CreateInvoiceDto {
  @IsInt() clientId!: number;
  @IsNumber() amount!: number;
  @IsOptional() @IsInt() projectId?: number;
  @IsOptional() @IsDateString() dueDate?: string;
}
class UpdateInvoiceStatusDto {
  @IsEnum(InvoiceStatus) status!: InvoiceStatus;
}
class UpdateInvoiceDto {
  @IsOptional() @IsInt() clientId?: number;
  @IsOptional() @IsNumber() amount?: number;
  @IsOptional() @IsEnum(InvoiceStatus) status?: InvoiceStatus;
  @IsOptional() @IsDateString() dueDate?: string;
}

@Injectable()
class InvoicesService {
  constructor(private readonly fs: FirestoreService) {}

  async findAll() {
    const invoices = await this.fs.findMany<any>(COL.invoices, {
      orderBy: { field: 'id', dir: 'desc' },
    });
    const ids = [...new Set(invoices.map((i) => i.clientId).filter((x) => x != null))];
    const clients = new Map<number, any>();
    await Promise.all(
      ids.map(async (id) => {
        const c = await this.fs.findById<any>(COL.clients, id);
        if (c) clients.set(id, { id: c.id, name: c.name });
      }),
    );
    return invoices.map((i) => ({ ...i, client: clients.get(i.clientId) ?? null }));
  }
  async create(dto: CreateInvoiceDto) {
    const client = await this.fs.findById(COL.clients, dto.clientId);
    if (!client) throw new NotFoundException('Client not found.');
    return this.fs.create(COL.invoices, {
      clientId: dto.clientId,
      projectId: dto.projectId ?? null,
      amount: dto.amount,
      status: 'PENDING',
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
    });
  }
  async setStatus(id: number, status: InvoiceStatus) {
    const inv = await this.fs.findById(COL.invoices, id);
    if (!inv) throw new NotFoundException('Invoice not found.');
    return this.fs.update(COL.invoices, id, { status });
  }
  async update(id: number, dto: UpdateInvoiceDto) {
    const inv = await this.fs.findById(COL.invoices, id);
    if (!inv) throw new NotFoundException('Invoice not found.');
    const data: Record<string, unknown> = {};
    if (dto.clientId !== undefined) data.clientId = dto.clientId;
    if (dto.amount !== undefined) data.amount = dto.amount;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    return this.fs.update(COL.invoices, id, data);
  }
  async remove(id: number) {
    const inv = await this.fs.findById(COL.invoices, id);
    if (!inv) throw new NotFoundException('Invoice not found.');
    await this.fs.delete(COL.invoices, id);
    return { ok: true };
  }
  async getFull(id: number) {
    const inv = await this.fs.findById<any>(COL.invoices, id);
    if (!inv) throw new NotFoundException('Invoice not found.');
    const client = inv.clientId != null ? await this.fs.findById<any>(COL.clients, inv.clientId) : null;
    const project = inv.projectId != null ? await this.fs.findById<any>(COL.projects, inv.projectId) : null;
    return { ...inv, client, project: project ? { title: project.title } : null };
  }
}

@UseGuards(TierGuard)
@Controller('api/invoices')
class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1)
  @Get()
  findAll() {
    return this.invoices.findAll();
  }

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1)
  @Post()
  create(@Body() dto: CreateInvoiceDto) {
    return this.invoices.create(dto);
  }

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1)
  @Put(':id/status')
  setStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInvoiceStatusDto,
  ) {
    return this.invoices.setStatus(id, dto.status);
  }

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1)
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateInvoiceDto) {
    return this.invoices.update(id, dto);
  }

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.invoices.remove(id);
  }

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1)
  @Get(':id/pdf')
  async pdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const inv = await this.invoices.getFull(id);
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="invoice-${id}.pdf"`,
    );
    doc.pipe(res);

    doc.fontSize(22).text('INVOICE', { align: 'right' });
    doc.fontSize(10).text(`Invoice #: ${inv.id}`, { align: 'right' });
    doc.text(`Date: ${new Date(inv.createdAt).toISOString().slice(0, 10)}`, {
      align: 'right',
    });
    if (inv.dueDate)
      doc.text(`Due: ${new Date(inv.dueDate).toISOString().slice(0, 10)}`, {
        align: 'right',
      });
    doc.moveDown(2);

    doc.fontSize(12).text('Bill To:', { underline: true });
    doc.fontSize(11).text(inv.client.name);
    if (inv.client.companyName) doc.text(inv.client.companyName);
    doc.text(inv.client.email);
    doc.moveDown(2);

    if (inv.project?.title) doc.fontSize(11).text(`Project: ${inv.project.title}`);
    doc.moveDown();

    doc.fontSize(14).text(`Amount: ${inv.client.currency} ${inv.amount}`);
    doc.fontSize(11).fillColor('gray').text(`Status: ${inv.status}`);
    doc.moveDown(3);
    doc.fillColor('black').fontSize(9).text('Thank you for your business.', {
      align: 'center',
    });

    doc.end();
  }
}

@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService],
})
export class InvoicesModule {}
