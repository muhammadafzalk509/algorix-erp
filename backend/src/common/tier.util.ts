import { PermissionTier } from './enums';

export const isDeveloper = (tier: string): boolean =>
  tier === PermissionTier.TIER_5;

// TIER_0..TIER_4 see all projects/tasks; TIER_5 (Developer) is filtered to own.
// NOTE: TIER_3 (Head of Dev) "team-level" visibility is treated as org-wide
// because the schema has no team-membership model yet.
export const seesAllData = (tier: string): boolean =>
  tier !== PermissionTier.TIER_5;
