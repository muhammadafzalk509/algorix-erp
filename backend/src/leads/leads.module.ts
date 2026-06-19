import { Module } from '@nestjs/common';
import { IsDateString, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import {
  Body,
  Controller,
  Delete,
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
import { PermissionTier } from '../common/enums';
import { FirestoreService } from '../firebase/firestore.service';
import { COL } from '../common/collections';
import { Tiers } from '../common/decorators/tiers.decorator';
import { TierGuard } from '../auth/guards/tier.guard';

// ---------- DTOs ----------
class CreateLeadDto {
  @IsString() name!: string;
  @IsOptional() @IsInt() clientId?: number;
  @IsOptional() @IsString() company?: string;
  @IsOptional() @IsString() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() source?: string;
  @IsOptional() @IsNumber() budget?: number;
  @IsOptional() @IsString() requirement?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsDateString() nextFollowUp?: string;
}
class UpdateLeadDto extends CreateLeadDto {}
class UpdateLeadStatusDto {
  @IsString() status!: string;
}

// ---------- Service ----------
@Injectable()
class LeadsService {
  constructor(private readonly fs: FirestoreService) {}

  findAll() {
    return this.fs.findMany(COL.leads, { orderBy: { field: 'id', dir: 'desc' } });
  }
  async findOne(id: number) {
    const lead = await this.fs.findById(COL.leads, id);
    if (!lead) throw new NotFoundException('Lead not found.');
    return lead;
  }
  create(dto: CreateLeadDto) {
    return this.fs.create(COL.leads, {
      ...dto,
      status: (dto as { status?: string }).status ?? 'NEW',
      nextFollowUp: dto.nextFollowUp ? new Date(dto.nextFollowUp) : null,
    });
  }
  async update(id: number, dto: UpdateLeadDto) {
    await this.findOne(id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.nextFollowUp !== undefined)
      data.nextFollowUp = dto.nextFollowUp ? new Date(dto.nextFollowUp) : null;
    return this.fs.update(COL.leads, id, data);
  }
  async remove(id: number) {
    await this.findOne(id);
    await this.fs.delete(COL.leads, id);
    return { ok: true };
  }
  async setStatus(id: number, status: string) {
    await this.findOne(id);
    return this.fs.update(COL.leads, id, { status });
  }
}

// ---------- Controller ----------
@UseGuards(TierGuard)
@Controller('api/leads')
class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1, PermissionTier.TIER_2)
  @Get()
  findAll() {
    return this.leads.findAll();
  }

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1, PermissionTier.TIER_2)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.leads.findOne(id);
  }

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1, PermissionTier.TIER_2)
  @Post()
  create(@Body() dto: CreateLeadDto) {
    return this.leads.create(dto);
  }

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1, PermissionTier.TIER_2)
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLeadDto) {
    return this.leads.update(id, dto);
  }

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1, PermissionTier.TIER_2)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.leads.remove(id);
  }

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1, PermissionTier.TIER_2)
  @Patch(':id/status')
  setStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLeadStatusDto,
  ) {
    return this.leads.setStatus(id, dto.status);
  }
}

@Module({
  controllers: [LeadsController],
  providers: [LeadsService],
})
export class LeadsModule {}
