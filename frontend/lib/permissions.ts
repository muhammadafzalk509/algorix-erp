import {
  LayoutDashboard,
  Users,
  Building2,
  FolderKanban,
  ListChecks,
  Clock,
  Target,
  FileText,
  Receipt,
  CalendarDays,
  LifeBuoy,
  BarChart3,
  Bell,
  UserCheck,
  Settings,
  GanttChartSquare,
  TrendingUp,
  Wallet,
  CalendarCheck,
  Bug,
  Network,
  Building,
  Boxes,
  Gauge,
  type LucideIcon,
} from 'lucide-react';

export type Tier =
  | 'TIER_0'
  | 'TIER_1'
  | 'TIER_2'
  | 'TIER_3'
  | 'TIER_4'
  | 'TIER_5'
  | 'TIER_6'
  | 'TIER_7';

export const TIER_LABEL: Record<Tier, string> = {
  TIER_0: 'CEO',
  TIER_1: 'CTO',
  TIER_2: 'VP Engineering',
  TIER_3: 'Head of Developer',
  TIER_4: 'Head of Documentation',
  TIER_5: 'Developer',
  TIER_6: 'QA',
  TIER_7: 'HR / Payroll Officer',
};

const ALL: Tier[] = [
  'TIER_0',
  'TIER_1',
  'TIER_2',
  'TIER_3',
  'TIER_4',
  'TIER_5',
  'TIER_6',
  'TIER_7',
];

// ---- Organizational layers ----
// Management (executive) · Development (engineering/QA/IoT/docs) · HR (people/ops).
export type Layer = 'Management' | 'Development' | 'HR';

export const LAYER_OF: Record<Tier, Layer> = {
  TIER_0: 'Management', // CEO
  TIER_1: 'Management', // CTO
  TIER_2: 'Management', // VP Engineering
  TIER_3: 'Development', // Head of Developer / Tester Head (Head of QA) / IoT Head
  TIER_4: 'Development', // Head of Documentation (Document Expert)
  TIER_5: 'Development', // Developer / Documentation Specialist / IoT Engineer
  TIER_6: 'Development', // QA
  TIER_7: 'HR', // HR / Payroll Officer
};

export const LAYER_BLURB: Record<Layer, string> = {
  Management: 'Executive & strategic leadership',
  Development: 'Engineering, QA, IoT & documentation teams',
  HR: 'People, payroll & operations',
};

export function layerOfTier(tier: Tier): Layer {
  return LAYER_OF[tier];
}

// Layer → selectable departments. Used by the login/signup layer-or-department picker.
// Leadership + department heads — protected from deletion (mirrors the backend).
export const UNDELETABLE_ROLES = [
  'CEO',
  'CTO',
  'VP Engineering',
  'Head of Developer',
  'Tester Head',
  'IoT Head',
  'Head of Documentation',
];

export const LAYERS: Layer[] = ['Management', 'Development', 'HR'];
export const DEPARTMENTS_BY_LAYER: Record<Layer, string[]> = {
  Management: ['Executive'],
  Development: ['Development', 'QA', 'IoT', 'Documentation'],
  HR: ['HR'],
};

// Sidebar grouping. Mirrors the org layers, plus a General catch-all.
export type NavSection = 'General' | 'Management' | 'Development' | 'HR / People';
export const NAV_SECTIONS: NavSection[] = ['General', 'Management', 'Development', 'HR / People'];

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  tiers: Tier[];
  section: NavSection;
}

export const NAV: NavItem[] = [
  // General
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, tiers: ALL, section: 'General' },
  { label: 'Notifications', href: '/notifications', icon: Bell, tiers: ALL, section: 'General' },
  { label: 'Tickets', href: '/tickets', icon: LifeBuoy, tiers: ALL, section: 'General' },
  { label: 'Settings', href: '/settings', icon: Settings, tiers: ALL, section: 'General' },

  // Management layer
  { label: 'VPE Portal', href: '/vpe', icon: Gauge, tiers: ['TIER_0', 'TIER_1', 'TIER_2'], section: 'Management' },
  { label: 'Organization', href: '/organization', icon: Building, tiers: ['TIER_0', 'TIER_1', 'TIER_2'], section: 'Management' },
  { label: 'Analytics', href: '/analytics', icon: BarChart3, tiers: ['TIER_0', 'TIER_1', 'TIER_2', 'TIER_3'], section: 'Management' },
  { label: 'Clients', href: '/clients', icon: Building2, tiers: ['TIER_0', 'TIER_1', 'TIER_2'], section: 'Management' },
  { label: 'Leads', href: '/leads', icon: Target, tiers: ['TIER_0', 'TIER_1', 'TIER_2'], section: 'Management' },
  { label: 'Invoices', href: '/invoices', icon: Receipt, tiers: ['TIER_0', 'TIER_1', 'TIER_2'], section: 'Management' },
  { label: 'Signup Requests', href: '/cto/signup-requests', icon: UserCheck, tiers: ['TIER_0', 'TIER_1'], section: 'Management' },

  // Development layer
  { label: 'Engineering Portal', href: '/engineering', icon: Network, tiers: ['TIER_0', 'TIER_1', 'TIER_2'], section: 'Development' },
  { label: 'My Department', href: '/department', icon: Boxes, tiers: ['TIER_3', 'TIER_4'], section: 'Development' },
  { label: 'Projects', href: '/projects', icon: FolderKanban, tiers: ALL, section: 'Development' },
  { label: 'Project Progress', href: '/progress', icon: TrendingUp, tiers: ALL, section: 'Development' },
  { label: 'Gantt Chart', href: '/gantt', icon: GanttChartSquare, tiers: ALL, section: 'Development' },
  { label: 'Tasks', href: '/tasks', icon: ListChecks, tiers: ALL, section: 'Development' },
  { label: 'Task Logs', href: '/task-logs', icon: Clock, tiers: ALL, section: 'Development' },
  { label: 'QA / Bugs', href: '/qa', icon: Bug, tiers: ['TIER_0', 'TIER_1', 'TIER_2', 'TIER_3', 'TIER_6'], section: 'Development' },
  { label: 'Documents', href: '/documents', icon: FileText, tiers: ALL, section: 'Development' },

  // HR / People layer
  // HR, Department Heads, VP Engineering, CTO, CEO. Backend scopes the list (management + HR see all; HODs see their dept).
  { label: 'Users', href: '/users', icon: Users, tiers: ['TIER_0', 'TIER_1', 'TIER_2', 'TIER_3', 'TIER_4', 'TIER_7'], section: 'HR / People' },
  { label: 'Payroll', href: '/payroll', icon: Wallet, tiers: ['TIER_0', 'TIER_1', 'TIER_7'], section: 'HR / People' },
  { label: 'Leaves', href: '/leaves', icon: CalendarDays, tiers: ALL, section: 'HR / People' },
  { label: 'Attendance', href: '/attendance', icon: CalendarCheck, tiers: ALL, section: 'HR / People' },
];

export function navForTier(tier: Tier): NavItem[] {
  return NAV.filter((n) => n.tiers.includes(tier));
}

// Sidebar nav grouped into sections (empty sections dropped).
export function navSectionsForTier(tier: Tier): { section: NavSection; items: NavItem[] }[] {
  const items = navForTier(tier);
  return NAV_SECTIONS.map((section) => ({
    section,
    items: items.filter((i) => i.section === section),
  })).filter((g) => g.items.length > 0);
}

export function can(tier: Tier | undefined, tiers: Tier[]): boolean {
  return !!tier && tiers.includes(tier);
}
