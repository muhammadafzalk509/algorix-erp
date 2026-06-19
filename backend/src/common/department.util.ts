// Role-based user visibility. Departments are derived from role names, mirroring
// the org structure used across the app (Engineering Hub teams + Management + HR).
//
// Management (CEO/CTO/VP Engineering) can view every user. Everyone else is
// scoped to their own department. Enforced on the backend in UsersService.

export const MANAGEMENT_TIERS = ['TIER_0', 'TIER_1', 'TIER_2'];

// Department -> the roles that belong to it.
export const DEPARTMENTS: Record<string, string[]> = {
  Management: ['CEO', 'CTO', 'VP Engineering'],
  Development: ['Head of Developer', 'Developer'],
  QA: ['Tester Head', 'QA'],
  Documentation: ['Head of Documentation', 'Documentation Specialist'],
  IoT: ['IoT Head', 'IoT Engineer'],
  HR: ['HR / Payroll Officer'],
};

const ROLE_TO_DEPT = new Map<string, string>();
for (const [dept, roles] of Object.entries(DEPARTMENTS))
  for (const role of roles) ROLE_TO_DEPT.set(role, dept);

/** The department a role belongs to, or null if unmapped. */
export function departmentOfRole(roleName: string): string | null {
  return ROLE_TO_DEPT.get(roleName) ?? null;
}

/** The role names that make up a department. */
export function rolesInDepartment(dept: string): string[] {
  return DEPARTMENTS[dept] ?? [];
}

/** CEO / CTO / VP Engineering may view every user in the company. */
export function canSeeAllUsers(tier: string): boolean {
  return MANAGEMENT_TIERS.includes(tier);
}

// The login screen labels the Management department "Executive"; every other
// department label matches the canonical names above.
export function normalizeLoginDepartment(selected: string): string {
  return selected === 'Executive' ? 'Management' : selected;
}

/**
 * True if a role is allowed to sign in under the department picked on the login
 * screen. Unmapped roles are not blocked (treated as a misconfiguration rather
 * than locking the user out).
 */
export function roleMatchesLoginDepartment(
  roleName: string,
  selected: string,
): boolean {
  const dept = departmentOfRole(roleName);
  if (!dept) return true;
  return dept === normalizeLoginDepartment(selected);
}

// Leadership + department heads are protected — they can never be deleted.
export const UNDELETABLE_ROLES = [
  'CEO',
  'CTO',
  'VP Engineering',
  'Head of Developer',
  'Tester Head',
  'IoT Head',
  'Head of Documentation',
];

export function isUndeletableRole(roleName: string): boolean {
  return UNDELETABLE_ROLES.includes(roleName);
}
