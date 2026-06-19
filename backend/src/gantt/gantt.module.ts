import { Module } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join } from 'path';
import {
  IsHexColor,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import {
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Logger,
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
import { PermissionTier } from '../common/enums';
import { FirestoreService } from '../firebase/firestore.service';
import { COL } from '../common/collections';
import { Tiers } from '../common/decorators/tiers.decorator';
import { TierGuard } from '../auth/guards/tier.guard';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';

// ---------- DTOs ----------
class CreateGanttItemDto {
  @IsString() name!: string;
  @IsISO8601() startDate!: string;
  @IsISO8601() endDate!: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) progress?: number;
  @IsOptional() @IsHexColor() color?: string;
  @IsOptional() @IsInt() orderIndex?: number;
}

class UpdateGanttItemDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsISO8601() startDate?: string;
  @IsOptional() @IsISO8601() endDate?: string;
  @IsOptional() @IsInt() @Min(0) @Max(100) progress?: number;
  @IsOptional() @IsHexColor() color?: string;
  @IsOptional() @IsInt() orderIndex?: number;
}

// Standardized status -> colour mapping:
//   COMPLETED=green, IN_PROGRESS=yellow, DELAYED=red, PLANNED=blue.
const STATUS_COLOR: Record<string, string> = {
  COMPLETED: '#16a34a',
  IN_PROGRESS: '#eab308',
  DELAYED: '#dc2626',
  PLANNED: '#2563eb',
};

function statusOf(
  item: { progress: number; endDate: Date | string },
  now: Date = new Date(),
): string {
  if (item.progress >= 100) return 'COMPLETED';
  if (new Date(item.endDate) < now) return 'DELAYED'; // past due, not complete
  if (item.progress > 0) return 'IN_PROGRESS';
  return 'PLANNED';
}

// Duration-weighted overall progress for a set of bars.
function overallProgress(
  items: { startDate: Date; endDate: Date; progress: number }[],
): number {
  if (!items.length) return 0;
  let weight = 0;
  let acc = 0;
  for (const it of items) {
    const days = Math.max(
      1,
      Math.round(
        (new Date(it.endDate).getTime() - new Date(it.startDate).getTime()) /
          86400000,
      ) + 1,
    );
    weight += days;
    acc += days * it.progress;
  }
  return weight ? Math.round(acc / weight) : 0;
}

// ---------- PDF helpers (shared by the report + the visual chart export) ----------
type PdfDoc = PDFKit.PDFDocument;

interface ReportChart {
  project: { title: string; status: string };
  progress: number;
  lastUpdated: Date | string | null;
  items: {
    name: string;
    startDate: Date | string;
    endDate: Date | string;
    progress: number;
    status: string;
  }[];
}

const STATUS_LEGEND: { label: string; status: string }[] = [
  { label: 'Completed', status: 'COMPLETED' },
  { label: 'In progress', status: 'IN_PROGRESS' },
  { label: 'Delayed', status: 'DELAYED' },
  { label: 'Planned', status: 'PLANNED' },
];

// ALGORIX letterhead + project summary + overall progress bar.
function drawReportHeader(
  doc: PdfDoc,
  chart: ReportChart,
  user: { firstName: string; lastName: string },
  subtitle: string,
) {
  doc.fontSize(20).fillColor('#1f4e79').text('ALGORIX', { continued: true });
  doc.fillColor('#64748b').fontSize(12).text(`  —  ${subtitle}`);
  doc.moveDown(1);

  doc.fillColor('#0f172a').fontSize(16).text(chart.project.title);
  doc.fillColor('#64748b').fontSize(10);
  doc.text(`Status: ${chart.project.status}`);
  doc.text(`Overall progress: ${chart.progress}%`);
  if (chart.lastUpdated)
    doc.text(`Last updated: ${new Date(chart.lastUpdated).toLocaleString()}`);
  doc.text(
    `Report generated: ${new Date().toLocaleString()} by ${user.firstName} ${user.lastName}`,
  );
  doc.moveDown(0.8);

  const left = doc.page.margins.left;
  const barW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const barY = doc.y;
  doc.rect(left, barY, barW, 14).fill('#e2e8f0');
  doc.rect(left, barY, (barW * chart.progress) / 100, 14).fill('#1f4e79');
  doc.fillColor('#0f172a');
  doc.x = left;
  doc.y = barY + 14;
  doc.moveDown(1.2);
}

// The visual timeline — bars positioned by date, coloured by status, filled by
// progress. This is the same chart the portal renders, drawn to PDF.
function drawGanttChart(doc: PdfDoc, chart: ReportChart) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const labelW = 130;
  const chartX = left + labelW;
  const chartW = right - chartX;
  const rowH = 20;

  doc.fontSize(12).fillColor('#0f172a').text('Gantt Timeline', left, doc.y);
  doc.moveDown(0.4);

  // legend
  const ly = doc.y;
  let lx = left;
  doc.fontSize(8);
  for (const l of STATUS_LEGEND) {
    doc.rect(lx, ly + 1, 8, 8).fill(STATUS_COLOR[l.status]);
    doc.fillColor('#475569').text(l.label, lx + 12, ly, { lineBreak: false });
    lx += 12 + doc.widthOfString(l.label) + 18;
  }
  doc.x = left;
  doc.y = ly + 14;
  doc.moveDown(0.5);

  if (!chart.items.length) {
    doc.fontSize(9).fillColor('#94a3b8').text('No Gantt items to chart yet.', left);
    doc.x = left;
    doc.moveDown(0.5);
    return;
  }

  const times = chart.items.flatMap((i) => [
    new Date(i.startDate).getTime(),
    new Date(i.endDate).getTime(),
  ]);
  const min = Math.min(...times);
  const max = Math.max(...times);
  const total = Math.max(86400000, max - min);

  const headerY = doc.y;
  const gridBottom = headerY + 12 + chart.items.length * rowH;
  const TICKS = 6;
  doc.fontSize(7).fillColor('#94a3b8');
  for (let k = 0; k <= TICKS; k++) {
    const x = chartX + (chartW * k) / TICKS;
    const t = min + (total * k) / TICKS;
    doc.text(new Date(t).toISOString().slice(5, 10), x - 16, headerY, {
      width: 32,
      align: 'center',
      lineBreak: false,
    });
    doc
      .save()
      .strokeColor('#eef2f7')
      .lineWidth(0.5)
      .moveTo(x, headerY + 11)
      .lineTo(x, gridBottom)
      .stroke()
      .restore();
  }

  let y = headerY + 14;
  for (const it of chart.items) {
    if (y + rowH > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    const name = it.name.length > 26 ? `${it.name.slice(0, 25)}…` : it.name;
    doc
      .fontSize(8)
      .fillColor('#334155')
      .text(name, left, y + 4, { width: labelW - 8, lineBreak: false });

    const s = new Date(it.startDate).getTime();
    const e = new Date(it.endDate).getTime();
    const barX = chartX + ((s - min) / total) * chartW;
    const barW = Math.max(4, ((e - s) / total) * chartW);
    doc.roundedRect(barX, y + 2, barW, 13, 2).fill('#e2e8f0');
    const fillW = Math.max(1, (barW * it.progress) / 100);
    doc.roundedRect(barX, y + 2, fillW, 13, 2).fill(STATUS_COLOR[it.status] ?? '#1f4e79');
    doc
      .fontSize(7)
      .fillColor('#475569')
      .text(`${it.progress}%`, Math.min(barX + barW + 4, right - 24), y + 4, {
        width: 24,
        lineBreak: false,
      });
    y += rowH;
  }
  doc.x = left;
  doc.y = y + 4;
}

// Aligned, zebra-striped task/phase table.
function drawTaskTable(doc: PdfDoc, chart: ReportChart) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  doc.fontSize(12).fillColor('#0f172a').text('Tasks / Phases', left, doc.y);
  doc.moveDown(0.4);

  const cols = [
    { key: 'name', label: 'Name', x: left, w: 180 },
    { key: 'start', label: 'Start', x: left + 185, w: 80 },
    { key: 'end', label: 'End', x: left + 270, w: 80 },
    { key: 'progress', label: 'Progress', x: left + 355, w: 60 },
    { key: 'status', label: 'Status', x: left + 420, w: right - (left + 420) },
  ];

  let y = doc.y;
  doc.rect(left, y, right - left, 16).fill('#f1f5f9');
  doc.fontSize(8).fillColor('#475569');
  for (const c of cols)
    doc.text(c.label, c.x + 3, y + 4, { width: c.w - 6, lineBreak: false });
  y += 16;

  doc.fontSize(8);
  if (!chart.items.length) {
    doc.fillColor('#94a3b8').text('No Gantt items added yet.', left + 3, y + 4);
    doc.x = left;
    doc.y = y + 16;
    return;
  }
  let zebra = false;
  for (const it of chart.items) {
    if (y + 16 > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
      y = doc.page.margins.top;
    }
    if (zebra) doc.rect(left, y, right - left, 16).fill('#f8fafc');
    zebra = !zebra;
    const vals: Record<string, string> = {
      name: it.name,
      start: new Date(it.startDate).toISOString().slice(0, 10),
      end: new Date(it.endDate).toISOString().slice(0, 10),
      progress: `${it.progress}%`,
      status: it.status.replace('_', ' '),
    };
    doc.fillColor('#0f172a');
    for (const c of cols)
      doc.text(vals[c.key], c.x + 3, y + 4, { width: c.w - 6, lineBreak: false });
    y += 16;
  }
  doc.x = left;
  doc.y = y;
}

function drawFooter(doc: PdfDoc) {
  doc.moveDown(2);
  doc
    .fontSize(8)
    .fillColor('#94a3b8')
    .text(
      'Generated by ALGORIX — Project Management & ERP Platform',
      doc.page.margins.left,
      doc.y,
      {
        align: 'center',
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
      },
    );
}

@Injectable()
class GanttService {
  private readonly logger = new Logger(GanttService.name);
  // All Gantt data is mirrored to local disk under backend/data/gantt.
  private readonly dataDir = join(process.cwd(), 'data', 'gantt');
  private readonly snapDir = join(this.dataDir, 'snapshots');

  constructor(private readonly fs: FirestoreService) {}

  // Persist the project's current Gantt state to local disk + a timestamped snapshot.
  private async saveToDisk(projectId: number) {
    try {
      await fs.mkdir(this.snapDir, { recursive: true });
      const chart = await this.getChart(projectId);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const json = JSON.stringify(chart, null, 2);
      await fs.writeFile(join(this.dataDir, `project-${projectId}.json`), json);
      await fs.writeFile(
        join(this.snapDir, `project-${projectId}-${stamp}.json`),
        json,
      );
    } catch (e) {
      this.logger.warn(`Disk persistence failed: ${(e as Error).message}`);
    }
  }

  // Single project's chart with computed progress + last-updated timestamp.
  async getChart(projectId: number) {
    const full = await this.fs.findById<any>(COL.projects, projectId);
    if (!full) throw new NotFoundException('Project not found.');
    const project = {
      id: full.id,
      title: full.title,
      status: full.status,
      startDate: full.startDate ?? null,
      endDate: full.endDate ?? null,
    };
    const items = await this.fs.findMany<any>(COL.ganttItems, {
      where: { projectId },
    });
    items.sort(
      (a, b) =>
        a.orderIndex - b.orderIndex ||
        new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
    );
    const lastUpdated = items.reduce<Date | null>(
      (max, i) => (!max || i.updatedAt > max ? i.updatedAt : max),
      null,
    );
    return {
      project,
      progress: overallProgress(items),
      lastUpdated,
      items: items.map((i) => {
        const status = statusOf(i);
        return { ...i, status, statusColor: STATUS_COLOR[status] };
      }),
    };
  }

  // Progress overview across all projects — visible to everyone.
  async progressOverview() {
    const projects = await this.fs.findMany<any>(COL.projects, {
      orderBy: { field: 'id', dir: 'desc' },
    });
    const allItems = await this.fs.findMany<any>(COL.ganttItems);
    const byProject = new Map<number, any[]>();
    for (const i of allItems) {
      const arr = byProject.get(i.projectId) ?? [];
      arr.push(i);
      byProject.set(i.projectId, arr);
    }
    const clientIds = [...new Set(projects.map((p) => p.clientId).filter((x) => x != null))];
    const clients = new Map<number, any>();
    await Promise.all(
      clientIds.map(async (id) => {
        const c = await this.fs.findById<any>(COL.clients, id);
        if (c) clients.set(id, c);
      }),
    );
    return projects.map((p) => {
      const items = byProject.get(p.id) ?? [];
      const lastUpdated = items.reduce<Date | null>(
        (max, i) =>
          !max || new Date(i.updatedAt) > max ? new Date(i.updatedAt) : max,
        null,
      );
      return {
        id: p.id,
        title: p.title,
        status: p.status,
        client: clients.get(p.clientId)?.name ?? null,
        startDate: p.startDate ?? null,
        endDate: p.endDate ?? null,
        items: items.length,
        progress: overallProgress(items),
        lastUpdated,
      };
    });
  }

  private async assertProject(projectId: number) {
    const p = await this.fs.findById(COL.projects, projectId);
    if (!p) throw new NotFoundException('Project not found.');
  }

  async createItem(projectId: number, dto: CreateGanttItemDto) {
    await this.assertProject(projectId);
    const item = await this.fs.create(COL.ganttItems, {
      projectId,
      name: dto.name,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      progress: dto.progress ?? 0,
      color: dto.color ?? null,
      orderIndex: dto.orderIndex ?? 0,
    });
    await this.saveToDisk(projectId);
    return item;
  }

  async updateItem(id: number, dto: UpdateGanttItemDto) {
    const existing = await this.fs.findById<{ projectId: number }>(COL.ganttItems, id);
    if (!existing) throw new NotFoundException('Gantt item not found.');
    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = new Date(dto.endDate);
    if (dto.progress !== undefined) data.progress = dto.progress;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.orderIndex !== undefined) data.orderIndex = dto.orderIndex;
    const item = await this.fs.update(COL.ganttItems, id, data);
    await this.saveToDisk(existing.projectId);
    return item;
  }

  async deleteItem(id: number) {
    const existing = await this.fs.findById<{ projectId: number }>(COL.ganttItems, id);
    if (!existing) throw new NotFoundException('Gantt item not found.');
    await this.fs.delete(COL.ganttItems, id);
    await this.saveToDisk(existing.projectId);
    return { ok: true };
  }
}

@UseGuards(TierGuard)
@Controller('api/gantt')
class GanttController {
  constructor(private readonly gantt: GanttService) {}

  // ---- Read (all authenticated users) ----
  @Get('progress')
  progress() {
    return this.gantt.progressOverview();
  }

  @Get(':projectId')
  chart(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.gantt.getChart(projectId);
  }

  // ---- Edit (CEO, CTO, VP Engineering) ----
  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1, PermissionTier.TIER_2)
  @Post(':projectId/items')
  create(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateGanttItemDto,
  ) {
    return this.gantt.createItem(projectId, dto);
  }

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1, PermissionTier.TIER_2)
  @Put('items/:id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGanttItemDto,
  ) {
    return this.gantt.updateItem(id, dto);
  }

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1, PermissionTier.TIER_2)
  @Delete('items/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.gantt.deleteItem(id);
  }

  // ---- Project progress report (PDF) — anyone can generate ----
  // Now includes the visual Gantt timeline (same as the portal) above an
  // aligned, zebra-striped task table.
  @Get(':projectId/report')
  async report(
    @Param('projectId', ParseIntPipe) projectId: number,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const chart = await this.gantt.getChart(projectId);
    const doc = new PDFDocument({ margin: 50 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="progress-report-project-${projectId}.pdf"`,
    );
    doc.pipe(res);

    drawReportHeader(doc, chart, user, 'Project Progress Report');
    drawGanttChart(doc, chart);
    doc.moveDown(1);
    drawTaskTable(doc, chart);
    drawFooter(doc);

    doc.end();
  }

  // ---- Visual Gantt chart export (PDF, landscape) — anyone can generate ----
  // Prints just the on-screen Gantt timeline, full width.
  @Get(':projectId/chart')
  async chartPdf(
    @Param('projectId', ParseIntPipe) projectId: number,
    @CurrentUser() user: AuthUser,
    @Res() res: Response,
  ) {
    const chart = await this.gantt.getChart(projectId);
    const doc = new PDFDocument({ margin: 40, layout: 'landscape' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="gantt-chart-project-${projectId}.pdf"`,
    );
    doc.pipe(res);

    drawReportHeader(doc, chart, user, 'Gantt Chart');
    drawGanttChart(doc, chart);
    drawFooter(doc);

    doc.end();
  }
}

@Module({
  controllers: [GanttController],
  providers: [GanttService],
})
export class GanttModule {}
