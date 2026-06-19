import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PermissionTier } from '../common/enums';
import { UsersService } from './users.service';
import { Tiers } from '../common/decorators/tiers.decorator';
import { TierGuard } from '../auth/guards/tier.guard';
import {
  CurrentUser,
  AuthUser,
} from '../common/decorators/current-user.decorator';
import { CreateUserDto, UpdateStatusDto, UpdateUserDto } from './dto/user.dto';

@Controller('api/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  // Visible to HR, Department Heads, VP Engineering, CTO and CEO only.
  // UsersService scopes the result (management + HR see everyone; HODs see
  // only their own department). Regular employees get 403.
  @UseGuards(TierGuard)
  @Tiers(
    PermissionTier.TIER_0,
    PermissionTier.TIER_1,
    PermissionTier.TIER_2,
    PermissionTier.TIER_3,
    PermissionTier.TIER_4,
    PermissionTier.TIER_7,
  )
  @Get()
  findAll(@CurrentUser() user: AuthUser) {
    return this.users.findAll(user);
  }

  // Own profile (declared before :id so "me" isn't parsed as an id).
  @Get('me')
  me(@CurrentUser('id') userId: number) {
    return this.users.getMe(userId);
  }

  // Upload/replace own profile picture (images only).
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file'))
  uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser('id') userId: number,
  ) {
    return this.users.updateAvatar(userId, file);
  }

  // HR / HOD / VPE / CTO / CEO; service further scopes by department.
  @UseGuards(TierGuard)
  @Tiers(
    PermissionTier.TIER_0,
    PermissionTier.TIER_1,
    PermissionTier.TIER_2,
    PermissionTier.TIER_3,
    PermissionTier.TIER_4,
    PermissionTier.TIER_7,
  )
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
  ) {
    return this.users.findOneForActor(id, user);
  }

  @UseGuards(TierGuard)
  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1)
  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser('id') createdBy: number) {
    return this.users.create(dto, createdBy);
  }

  // CEO, CTO, VP Engineering, or self — enforced in service.
  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.users.update(id, dto, user);
  }

  @UseGuards(TierGuard)
  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1)
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') actorId: number,
  ) {
    return this.users.remove(id, actorId);
  }

  // User ACTIVE/INACTIVE toggle: CTO only (intentionally NOT granted to CEO).
  @UseGuards(TierGuard)
  @Tiers(PermissionTier.TIER_1)
  @Patch(':id/status')
  setStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.users.setStatus(id, dto.status);
  }
}
