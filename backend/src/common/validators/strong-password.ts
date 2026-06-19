// Password policy: min 8 chars, at least one uppercase, one lowercase, one number.
export const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export const STRONG_PASSWORD_MSG =
  'Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number.';
