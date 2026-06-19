import { SetMetadata } from '@nestjs/common';
import { PermissionTier } from '../enums';

export const TIERS_KEY = 'tiers';

/** Restrict a route to one or more permission tiers. */
export const Tiers = (...tiers: PermissionTier[]) =>
  SetMetadata(TIERS_KEY, tiers);
