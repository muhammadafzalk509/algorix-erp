import { Module } from '@nestjs/common';
import { IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import {
  Body,
  Controller,
  Get,
  Injectable,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { PermissionTier, TaskPriority, TicketStatus } from '../common/enums';
import { FirestoreService } from '../firebase/firestore.service';
import { COL } from '../common/collections';
import { Tiers } from '../common/decorators/tiers.decorator';
import { TierGuard } from '../auth/guards/tier.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

class CreateTicketDto {
  @IsString() title!: string;
  @IsString() description!: string;
  @IsString() category!: string;
  @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
}
class UpdateTicketDto {
  @IsOptional() @IsString() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
}
class UpdateTicketStatusDto {
  @IsEnum(TicketStatus) status!: TicketStatus;
}
class AssignTicketDto {
  @IsInt() assignedTo!: number;
}

@Injectable()
class TicketsService {
  constructor(private readonly fs: FirestoreService) {}

  async findAll() {
    const list = await this.fs.findMany<any>(COL.tickets, {
      orderBy: { field: 'id', dir: 'desc' },
    });
    return list;
  }
  async findOne(id: number) {
    const t = await this.fs.findById(COL.tickets, id);
    if (!t) throw new NotFoundException('Ticket not found.');
    return t;
  }
  create(dto: CreateTicketDto, createdBy: number) {
    return this.fs.create(COL.tickets, {
      ...dto,
      priority: (dto as { priority?: string }).priority ?? 'MEDIUM',
      status: 'OPEN',
      assignedTo: (dto as { assignedTo?: number }).assignedTo ?? null,
      createdBy,
    });
  }
  async update(id: number, dto: UpdateTicketDto) {
    await this.findOne(id);
    return this.fs.update(COL.tickets, id, { ...dto });
  }
  async setStatus(id: number, status: TicketStatus) {
    await this.findOne(id);
    return this.fs.update(COL.tickets, id, { status });
  }
  async assign(id: number, assignedTo: number) {
    await this.findOne(id);
    return this.fs.update(COL.tickets, id, { assignedTo, status: 'ASSIGNED' });
  }
}

// TIER_3+ = TIER_0, TIER_1, TIER_2, TIER_3
const TIER_3_PLUS = [
  PermissionTier.TIER_0,
  PermissionTier.TIER_1,
  PermissionTier.TIER_2,
  PermissionTier.TIER_3,
];

@UseGuards(TierGuard)
@Controller('api/tickets')
class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  findAll() {
    return this.tickets.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tickets.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateTicketDto, @CurrentUser('id') uid: number) {
    return this.tickets.create(dto, uid);
  }

  @Tiers(...TIER_3_PLUS)
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateTicketDto) {
    return this.tickets.update(id, dto);
  }

  @Tiers(...TIER_3_PLUS)
  @Patch(':id/status')
  setStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTicketStatusDto,
  ) {
    return this.tickets.setStatus(id, dto.status);
  }

  @Tiers(...TIER_3_PLUS)
  @Patch(':id/assign')
  assign(@Param('id', ParseIntPipe) id: number, @Body() dto: AssignTicketDto) {
    return this.tickets.assign(id, dto.assignedTo);
  }
}

@Module({
  controllers: [TicketsController],
  providers: [TicketsService],
})
export class TicketsModule {}
