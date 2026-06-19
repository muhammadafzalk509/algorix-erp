// Mirrors the backend policy in src/common/validators/strong-password.ts.
export const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export const PASSWORD_RULE =
  'At least 8 characters with an uppercase letter, a lowercase letter, and a number.';

export function passwordError(pw: string): string | null {
  return STRONG_PASSWORD.test(pw) ? null : PASSWORD_RULE;
}
