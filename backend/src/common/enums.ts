// Local enum definitions (formerly imported from @prisma/client).
// String enums so values are stored/validated identically to before.

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
}

export enum PermissionTier {
  TIER_0 = 'TIER_0',
  TIER_1 = 'TIER_1',
  TIER_2 = 'TIER_2',
  TIER_3 = 'TIER_3',
  TIER_4 = 'TIER_4',
  TIER_5 = 'TIER_5',
  TIER_6 = 'TIER_6',
  TIER_7 = 'TIER_7',
}

export enum Capability {
  PAYROLL_VIEW = 'PAYROLL_VIEW',
  PAYROLL_EDIT = 'PAYROLL_EDIT',
  PAYROLL_AUDIT = 'PAYROLL_AUDIT',
  QA_VALIDATE = 'QA_VALIDATE',
  ATTENDANCE_MANAGE = 'ATTENDANCE_MANAGE',
  NOTIFY_GLOBAL = 'NOTIFY_GLOBAL',
  USER_MANAGE = 'USER_MANAGE',
  AUDIT_VIEW = 'AUDIT_VIEW',
}

export enum ProjectStatus {
  PLANNING = 'PLANNING',
  ACTIVE = 'ACTIVE',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TaskStatus {
  TODO = 'TODO',
  IN_PROGRESS = 'IN_PROGRESS',
  REVIEW = 'REVIEW',
  TESTING = 'TESTING',
  DONE = 'DONE',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum InvoiceStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
}

export enum LeaveType {
  CASUAL = 'CASUAL',
  SICK = 'SICK',
  ANNUAL = 'ANNUAL',
}

export enum LeaveStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum TicketStatus {
  OPEN = 'OPEN',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  MANUAL = 'MANUAL',
}

export enum BugSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum BugStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}
