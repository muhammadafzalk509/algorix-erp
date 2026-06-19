import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { PermissionTier } from '../common/enums';
import { ClientsService } from './clients.service';
import { Tiers } from '../common/decorators/tiers.decorator';
import { TierGuard } from '../auth/guards/tier.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';

@UseGuards(TierGuard)
@Controller('api/clients')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1, PermissionTier.TIER_2)
  @Get()
  findAll() {
    return this.clients.findAll();
  }

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1, PermissionTier.TIER_2)
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.clients.findOne(id);
  }

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1, PermissionTier.TIER_2)
  @Post()
  create(@Body() dto: CreateClientDto, @CurrentUser('id') userId: number) {
    return this.clients.create(dto, userId);
  }

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1, PermissionTier.TIER_2)
  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateClientDto) {
    return this.clients.update(id, dto);
  }

  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1)
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.clients.remove(id);
  }
}
