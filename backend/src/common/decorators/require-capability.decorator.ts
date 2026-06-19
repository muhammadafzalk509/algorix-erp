import { SetMetadata } from '@nestjs/common';
import { Capability } from '../enums';

export const CAPABILITIES_KEY = 'capabilities';

/**
 * Restrict a route to users whose role holds ALL of the listed capabilities.
 * Functional access, orthogonal to the tier hierarchy enforced by @Tiers.
 */
export const RequireCapability = (...capabilities: Capability[]) =>
  SetMetadata(CAPABILITIES_KEY, capabilities);
