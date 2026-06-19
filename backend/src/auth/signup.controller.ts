import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PermissionTier } from '../common/enums';
import { SignupService } from './signup.service';
import { Public } from '../common/decorators/public.decorator';
import { Tiers } from '../common/decorators/tiers.decorator';
import { TierGuard } from './guards/tier.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RejectSignupDto, RequestSignupDto } from './dto/auth.dto';

@Controller('api/auth')
export class SignupController {
  constructor(private readonly signup: SignupService) {}

  // Public — developer submits a request.
  @Public()
  @Post('request-signup')
  @HttpCode(201)
  request(@Body() dto: RequestSignupDto) {
    return this.signup.requestSignup(dto);
  }

  // CTO only (TIER_1).
  @UseGuards(TierGuard)
  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1)
  @Get('signup-requests')
  list(@Query('status') status?: string) {
    return this.signup.listRequests(status);
  }

  @UseGuards(TierGuard)
  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1)
  @Post('signup-requests/:id/approve')
  @HttpCode(200)
  approve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') reviewerId: number,
  ) {
    return this.signup.approve(id, reviewerId);
  }

  @UseGuards(TierGuard)
  @Tiers(PermissionTier.TIER_0, PermissionTier.TIER_1)
  @Post('signup-requests/:id/reject')
  @HttpCode(200)
  reject(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') reviewerId: number,
    @Body() dto: RejectSignupDto,
  ) {
    return this.signup.reject(id, reviewerId, dto.reviewNote);
  }
}
