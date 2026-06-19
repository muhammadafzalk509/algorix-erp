'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { Button, Card, CardTitle, Input, Label, PageHeader, Select, StatusBadge } from '@/components/ui';
import {
  Activity, AlertTriangle, BarChart2, Boxes, CheckCircle2, CheckSquare, Clock, Cpu,
  FileText, GanttChartSquare, Gauge, GitBranch, ListChecks, MessageSquare, ScrollText,
  Send, ShieldAlert, TrendingUp, Users as UsersIcon,
} from 'lucide-react';

/* ---------------------------------- types --------------------------------- */
interface Project { id: number; title: string; status: string; priority?: string; startDate: string | null; endDate: string | null; client?: { name: string } | null; }
interface Task { id: number; title: string; status: string; priority: string; dueDate?: string | null; project?: { title: string }; assignee?: { id?: number; firstName: string; lastName: string } | null; }
interface Progress { id: number; title: string; status: string; progress: number; client: string | null; endDate: string | null; lastUpdated: string | null; }
interface PersonStat { id: number; name: string; role: string; total: number; done: number; inProgress: number; overdue: number; completion: number; }
interface Team { key: string; label: string; roles: string[]; members: number; totalTasks: number; done: number; inProgress: number; todo: number; overdue: number; completion: number; people: PersonStat[]; }
interface Overview { teams: Team[]; totals: { members: number; totalTasks: number; done: number; completion: number }; }
interface TeamMember { id: number; name: string; role: string }
interface TeamGroup { key: string; label: string; members: TeamMember[] }
interface Notification { id: number; title: string; message: string; createdAt: string; category?: string | null }
interface Bug { id: number; title?: string; severity?: string; status?: string }
interface AuditRow { id: number; action: string; method: string; statusCode?: number; createdAt: string; userId?: number | null }
interface OrgUser { id: number; firstName: string; lastName: string; role: { name: string; permissionTier: string }; status: string }

/* -------------------------------- sections -------------------------------- */
const SECTIONS = [
  { key: 'dashboard', label: 'Dashboard', icon: Gauge },
  { key: 'monitoring', label: 'Team Monitoring', icon: Activity },
  { key: 'projects', label: 'Project Tracking', icon: Boxes },
  { key: 'tasks', label: 'Task Management', icon: ListChecks },
  { key: 'gantt', label: 'Gantt Chart', icon: GanttChartSquare },
  { key: 'reports', label: 'Reports', icon: FileText },
  { key: 'performance', label: 'Team Performance', icon: TrendingUp },
  { key: 'risks', label: 'Risk Management', icon: ShieldAlert },
  { key: 'approvals', label: 'Approval Center', icon: CheckSquare },
  { key: 'resources', label: 'Resource Monitoring', icon: UsersIcon },
  { key: 'comms', label: 'Communication', icon: MessageSquare },
  { key: 'analytics', label: 'Analytics', icon: BarChart2 },
  { key: 'audit', label: 'Audit Log', icon: ScrollText },
  { key: 'settings', label: 'Settings', icon: GitBranch },
] as const;
type SectionKey = (typeof SECTIONS)[number]['key'];

const DAY = 86400000;
const isDelayed = (p: { endDate: string | null; status: string }) =>
  !!p.endDate && new Date(p.endDate).getTime() < Date.now() && !['COMPLETED', 'CANCELLED'].includes(p.status);

/* ------------------------------ small helpers ----------------------------- */
function Stat({ label, value, sub, accent = 'text-brand' }: { label: string; value: React.ReactNode; sub?: string; accent?: string }) {
  return (
    <Card>
      <p className={`text-3xl font-extrabold ${accent}`}>{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </Card>
  );
}

function Bar({ value, accent = '#1f4e79' }: { value: number; accent?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, value)}%`, backgroundColor: accent }} />
    </div>
  );
}

// A clearly-labeled panel for metrics that need a data source not yet integrated.
function Planned({ title, needs, fields }: { title: string; needs: string; fields: string[] }) {
  return (
    <Card>
      <div className="mb-1 flex items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">PENDING INTEGRATION</span>
      </div>
      <p className="mb-3 text-xs text-slate-400">Needs {needs}. Fields ready to populate once the source is connected:</p>
      <div className="flex flex-wrap gap-1.5">
        {fields.map((f) => (
          <span key={f} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-500 dark:bg-slate-700/50 dark:text-slate-300">{f}</span>
        ))}
      </div>
    </Card>
  );
}

/* ================================== PAGE =================================== */
export default function VpePortalPage() {
  const { user } = useAuth();
  const allowed = can(user?.permissionTier, ['TIER_0', 'TIER_1', 'TIER_2']);
  const [active, setActive] = useState<SectionKey>('dashboard');

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [groups, setGroups] = useState<TeamGroup[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [bugs, setBugs] = useState<Bug[] | null>(null);
  const [audit, setAudit] = useState<AuditRow[] | null>(null);
  const [auditDenied, setAuditDenied] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await Promise.allSettled([
      api.get<Project[]>('/projects'),
      api.get<Task[]>('/tasks'),
      api.get<Progress[]>('/gantt/progress'),
      api.get<Overview>('/engineering/overview'),
      api.get<TeamGroup[]>('/engineering/teams'),
      api.get<Notification[]>('/notifications'),
      api.get<OrgUser[]>('/users'),
      api.get<Bug[]>('/bugs'),
      api.get<{ items: AuditRow[]; total: number }>('/audit'),
    ]);
    if (r[0].status === 'fulfilled') setProjects(r[0].value);
    if (r[1].status === 'fulfilled') setTasks(r[1].value);
    if (r[2].status === 'fulfilled') setProgress(r[2].value);
    if (r[3].status === 'fulfilled') setOverview(r[3].value);
    if (r[4].status === 'fulfilled') setGroups(r[4].value);
    if (r[5].status === 'fulfilled') setNotifications(r[5].value);
    if (r[6].status === 'fulfilled') setUsers(r[6].value);
    setBugs(r[7].status === 'fulfilled' ? r[7].value : null);
    if (r[8].status === 'fulfilled') setAudit(r[8].value.items ?? []);
    else setAuditDenied(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!allowed) { setLoading(false); return; }
    load();
  }, [allowed, load]);

  /* ----------------------------- derived metrics ---------------------------- */
  const m = useMemo(() => {
    const active = projects.filter((p) => p.status === 'ACTIVE').length;
    const completed = projects.filter((p) => p.status === 'COMPLETED').length;
    const delayed = projects.filter(isDelayed).length;
    const highPriority = tasks.filter((t) => ['HIGH', 'CRITICAL'].includes(t.priority) && t.status !== 'DONE').length;
    const overdue = tasks.filter((t) => t.dueDate && new Date(t.dueDate).getTime() < Date.now() && t.status !== 'DONE');
    const upcoming = tasks
      .filter((t) => t.dueDate && t.status !== 'DONE' && new Date(t.dueDate).getTime() >= Date.now() && new Date(t.dueDate).getTime() <= Date.now() + 7 * DAY)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime());
    const doneTasks = tasks.filter((t) => t.status === 'DONE').length;
    const sprint = tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0;
    return { active, completed, delayed, highPriority, overdue, upcoming, doneTasks, sprint };
  }, [projects, tasks]);

  if (!allowed)
    return (
      <div>
        <PageHeader title="VPE Portal" />
        <p className="text-sm text-rose-600">This portal is available to VP Engineering, CTO and CEO only.</p>
      </div>
    );

  return (
    <div>
      <PageHeader title="Vice President Engineering — Portal" />
      <p className="-mt-2 mb-4 text-sm text-slate-500">Live oversight of Development, QA, IoT and Documentation across the engineering org.</p>

      <div className="flex flex-col gap-5 lg:flex-row">
        {/* section navigator */}
        <aside className="lg:w-56 lg:shrink-0">
          <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-800 lg:flex-col">
            {SECTIONS.map((s) => {
              const Icon = s.icon;
              const on = active === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setActive(s.key)}
                  className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium transition lg:w-full ${on ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                >
                  <Icon size={16} /> {s.label}
                </button>
              );
            })}
          </div>
        </aside>

        {/* content */}
        <section className="min-w-0 flex-1">
          {loading ? (
            <p className="text-sm text-slate-400">Loading portal…</p>
          ) : (
            <>
              {active === 'dashboard' && <DashboardSection m={m} overview={overview} notifications={notifications} audit={audit} />}
              {active === 'monitoring' && <MonitoringSection overview={overview} bugs={bugs} />}
              {active === 'projects' && <ProjectsSection projects={projects} progress={progress} />}
              {active === 'tasks' && <TasksSection tasks={tasks} groups={groups} reload={load} />}
              {active === 'gantt' && <GanttSection progress={progress} />}
              {active === 'reports' && <ReportsSection projects={projects} />}
              {active === 'performance' && <PerformanceSection overview={overview} />}
              {active === 'risks' && <RisksSection projects={projects} m={m} />}
              {active === 'approvals' && <ApprovalsSection />}
              {active === 'resources' && <ResourcesSection overview={overview} />}
              {active === 'comms' && <CommsSection notifications={notifications} />}
              {active === 'analytics' && <AnalyticsSection overview={overview} tasks={tasks} projects={projects} />}
              {active === 'audit' && <AuditSection audit={audit} denied={auditDenied} />}
              {active === 'settings' && <SettingsSection />}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/* ------------------------------- 1. Dashboard ------------------------------ */
function DashboardSection({ m, overview, notifications, audit }: { m: any; overview: Overview | null; notifications: Notification[]; audit: AuditRow[] | null }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Stat label="Active Projects" value={m.active} accent="text-emerald-600" />
        <Stat label="Completed Projects" value={m.completed} accent="text-brand" />
        <Stat label="Delayed Projects" value={m.delayed} accent="text-rose-600" />
        <Stat label="High Priority Tasks" value={m.highPriority} accent="text-amber-600" />
        <Stat label="Blocked / Overdue" value={m.overdue.length} accent="text-rose-600" sub="overdue, not done" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Team Performance Summary</CardTitle>
          {overview?.teams.map((t) => (
            <div key={t.key} className="mb-2">
              <div className="mb-1 flex justify-between text-xs"><span className="text-slate-600">{t.label}</span><span className="font-semibold text-brand">{t.completion}%</span></div>
              <Bar value={t.completion} />
            </div>
          ))}
          {!overview && <p className="text-sm text-slate-400">No data.</p>}
        </Card>

        <Card>
          <div className="mb-1 flex items-center justify-between">
            <CardTitle>Sprint Progress</CardTitle>
            <span className="text-xs text-slate-400">overall task completion</span>
          </div>
          <p className="mb-2 text-3xl font-extrabold text-brand">{m.sprint}%</p>
          <Bar value={m.sprint} />
          <p className="mt-2 text-[11px] text-amber-600">No sprint model configured — showing overall completion as a proxy.</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Upcoming Deadlines (7 days)</CardTitle>
          {m.upcoming.length === 0 ? <p className="text-sm text-slate-400">Nothing due this week.</p> : (
            <ul className="space-y-1.5">
              {m.upcoming.slice(0, 8).map((t: Task) => (
                <li key={t.id} className="flex items-center justify-between text-sm">
                  <span className="truncate text-slate-700">{t.title}</span>
                  <span className="ml-2 shrink-0 text-xs text-amber-600">{new Date(t.dueDate!).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle>Recent Activity</CardTitle>
          {audit && audit.length > 0 ? (
            <ul className="space-y-1.5 text-xs">
              {audit.slice(0, 8).map((a) => (
                <li key={a.id} className="flex items-center justify-between">
                  <span className="truncate text-slate-600">{a.action}</span>
                  <span className="ml-2 shrink-0 text-slate-400">{new Date(a.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="space-y-1.5 text-xs">
              {notifications.slice(0, 8).map((n) => (
                <li key={n.id} className="flex items-center justify-between">
                  <span className="truncate text-slate-600">{n.title}</span>
                  <span className="ml-2 shrink-0 text-slate-400">{new Date(n.createdAt).toLocaleString()}</span>
                </li>
              ))}
              {notifications.length === 0 && <li className="text-slate-400">No recent activity.</li>}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ---------------------------- 2. Team Monitoring --------------------------- */
function MonitoringSection({ overview, bugs }: { overview: Overview | null; bugs: Bug[] | null }) {
  const team = (key: string) => overview?.teams.find((t) => t.key === key);
  const dev = team('development');
  const qa = team('qa');
  const iot = team('iot');
  const doc = team('documentation');

  const critical = bugs?.filter((b) => (b.severity ?? '').toUpperCase() === 'CRITICAL').length ?? 0;
  const openBugs = bugs?.filter((b) => ['OPEN', 'IN_PROGRESS'].includes((b.status ?? '').toUpperCase())).length ?? 0;
  const fixedBugs = bugs?.filter((b) => ['RESOLVED', 'CLOSED'].includes((b.status ?? '').toUpperCase())).length ?? 0;

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-500">Monitor every department head. Live task metrics are shown; engineering-tool metrics activate once integrated.</p>

      {/* Head of Development */}
      <HeadCard title="Head of Development" team={dev} accent="#1f4e79">
        <Planned title="Engineering signals" needs="Git + CI integration" fields={['Git Commits Summary', 'Code Review Status', 'Team Velocity', 'Sprint Status', 'Performance Graph']} />
      </HeadCard>

      {/* Head of QA */}
      <HeadCard title="Head of QA" team={qa} accent="#7c3aed">
        <Card>
          <CardTitle>Bug Reports {bugs === null && <span className="text-[10px] text-amber-600">(restricted)</span>}</CardTitle>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><p className="text-2xl font-bold text-rose-600">{critical}</p><p className="text-[11px] text-slate-500">Critical</p></div>
            <div><p className="text-2xl font-bold text-amber-600">{openBugs}</p><p className="text-[11px] text-slate-500">Open</p></div>
            <div><p className="text-2xl font-bold text-emerald-600">{fixedBugs}</p><p className="text-[11px] text-slate-500">Fixed</p></div>
          </div>
        </Card>
        <Planned title="Test management" needs="a test-case/automation tool" fields={['Test Cases', 'Executed', 'Passed', 'Failed', 'Regression', 'Smoke', 'Automation %', 'Reopened Bugs', 'Release Readiness']} />
      </HeadCard>

      {/* Head of IoT */}
      <HeadCard title="Head of IoT" team={iot} accent="#ea580c">
        <Planned title="Hardware & devices" needs="an IoT device/telemetry gateway" fields={['Hardware Status', 'Device Connectivity', 'Firmware Version', 'Sensor Status', 'Device Health', 'Deployment Status', 'Integration Progress', 'Production Readiness']} />
      </HeadCard>

      {/* Head of Documentation */}
      <HeadCard title="Head of Documentation" team={doc} accent="#0891b2">
        <Planned title="Document tracking" needs="a structured docs register (SRS/SDS/API)" fields={['SRS Status', 'SDS Status', 'API Documentation', 'User Manual', 'Release Notes', 'Approved Documents', 'Review Status', 'Completion %', 'Version History']} />
      </HeadCard>
    </div>
  );
}

function HeadCard({ title, team, accent, children }: { title: string; team?: Team; accent: string; children: React.ReactNode }) {
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2">
        <h3 className="font-bold text-slate-800">{title}</h3>
        <span className="text-sm font-bold" style={{ color: accent }}>{team?.completion ?? 0}%</span>
      </div>
      {!team || team.members === 0 ? (
        <p className="text-sm text-slate-400">No team members assigned yet.</p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap gap-3 text-xs">
            <span className="flex items-center gap-1 text-slate-500"><UsersIcon size={13} /> {team.members} people</span>
            <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={13} /> {team.done} done</span>
            <span className="flex items-center gap-1 text-amber-600"><Clock size={13} /> {team.inProgress} in progress</span>
            <span className="text-slate-500">{team.todo} to do</span>
            {team.overdue > 0 && <span className="flex items-center gap-1 font-semibold text-rose-600"><AlertTriangle size={13} /> {team.overdue} overdue</span>}
          </div>
          <div className="mb-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-left text-[10px] uppercase tracking-wide text-slate-400"><th className="pb-1">Member</th><th className="pb-1">Role</th><th className="pb-1 text-center">Done/Total</th><th className="pb-1 text-right">Progress</th></tr></thead>
              <tbody className="divide-y divide-slate-50">
                {team.people.map((p) => (
                  <tr key={p.id}><td className="py-1 text-slate-700">{p.name}</td><td className="py-1 text-slate-400">{p.role}</td><td className="py-1 text-center text-slate-600">{p.done}/{p.total}</td><td className="py-1 text-right font-semibold" style={{ color: accent }}>{p.completion}%</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </Card>
  );
}

/* --------------------------- 3. Project Tracking --------------------------- */
function ProjectsSection({ projects, progress }: { projects: Project[]; progress: Progress[] }) {
  const [openId, setOpenId] = useState<number | null>(projects[0]?.id ?? null);
  const prog = (id: number) => progress.find((p) => p.id === id);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardTitle>Projects ({projects.length})</CardTitle>
        <div className="space-y-1">
          {projects.map((p) => (
            <button key={p.id} onClick={() => setOpenId(p.id)} className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm ${openId === p.id ? 'bg-brand/10 font-semibold text-brand' : 'hover:bg-slate-100 dark:hover:bg-slate-700'}`}>
              <span className="truncate">{p.title}</span>
              <StatusBadge status={p.status} />
            </button>
          ))}
          {projects.length === 0 && <p className="text-sm text-slate-400">No projects.</p>}
        </div>
      </Card>
      <div className="lg:col-span-2">
        {(() => {
          const p = projects.find((x) => x.id === openId);
          if (!p) return <Card><p className="text-sm text-slate-400">Select a project.</p></Card>;
          const pr = prog(p.id);
          const rows: [string, React.ReactNode][] = [
            ['Client', p.client?.name ?? '—'],
            ['Status', <StatusBadge key="s" status={p.status} />],
            ['Priority', p.priority ?? '—'],
            ['Start Date', p.startDate ? new Date(p.startDate).toLocaleDateString() : '—'],
            ['End Date', p.endDate ? new Date(p.endDate).toLocaleDateString() : '—'],
            ['Current Phase', pr ? `${pr.progress}% complete` : '—'],
            ['Delayed', isDelayed(p) ? 'Yes — past end date' : 'No'],
            ['Last Updated', pr?.lastUpdated ? new Date(pr.lastUpdated).toLocaleString() : '—'],
          ];
          return (
            <Card>
              <CardTitle>{p.title}</CardTitle>
              {pr && <div className="mb-3"><Bar value={pr.progress} /></div>}
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                {rows.map(([k, v]) => (<div key={k} className="flex justify-between border-b border-slate-50 py-1"><dt className="text-slate-400">{k}</dt><dd className="text-slate-700">{v}</dd></div>))}
              </dl>
              <div className="mt-3 flex gap-2">
                <Link href="/projects"><Button variant="outline" className="px-2.5 py-1.5 text-xs">Open in Projects</Button></Link>
                <Link href="/gantt"><Button variant="ghost" className="px-2.5 py-1.5 text-xs"><GanttChartSquare size={14} /> Milestones / Gantt</Button></Link>
              </div>
              <p className="mt-3 text-[11px] text-amber-600">Budget · Resources · Risks · Dependencies · Deliverables · Attachments populate once those project fields are added to the schema.</p>
            </Card>
          );
        })()}
      </div>
    </div>
  );
}

/* --------------------------- 4. Task Management ---------------------------- */
const STATUSES = ['TODO', 'IN_PROGRESS', 'REVIEW', 'TESTING', 'DONE'];
function TasksSection({ tasks, groups, reload }: { tasks: Task[]; groups: TeamGroup[]; reload: () => void }) {
  const [busy, setBusy] = useState<number | null>(null);
  const members = useMemo(() => groups.flatMap((g) => g.members), [groups]);

  async function setStatus(id: number, status: string) {
    setBusy(id);
    try { await api.patch(`/tasks/${id}/status`, { status }); reload(); } catch (e) { alert((e as Error).message); } finally { setBusy(null); }
  }
  async function reassign(id: number, userId: string) {
    if (!userId) return;
    setBusy(id);
    try { await api.post(`/tasks/${id}/assign`, { assignedTo: Number(userId) }); reload(); } catch (e) { alert((e as Error).message); } finally { setBusy(null); }
  }
  return (
    <Card>
      <CardTitle>All Team Tasks ({tasks.length})</CardTitle>
      <p className="mb-3 text-xs text-slate-400">Update status or reassign across teams. Use <Link href="/tasks" className="text-brand underline">Tasks</Link> to create new ones.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-2 py-2">Task</th><th className="px-2 py-2">Project</th><th className="px-2 py-2">Assignee</th><th className="px-2 py-2">Due</th><th className="px-2 py-2">Priority</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">Reassign</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {tasks.map((t) => {
              const overdue = t.dueDate && new Date(t.dueDate).getTime() < Date.now() && t.status !== 'DONE';
              return (
                <tr key={t.id} className={busy === t.id ? 'opacity-50' : ''}>
                  <td className="px-2 py-2 text-slate-700">{t.title}</td>
                  <td className="px-2 py-2 text-slate-500">{t.project?.title ?? '—'}</td>
                  <td className="px-2 py-2 text-slate-500">{t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : '—'}</td>
                  <td className="px-2 py-2"><span className={overdue ? 'font-semibold text-rose-600' : 'text-slate-500'}>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '—'}</span></td>
                  <td className="px-2 py-2"><StatusBadge status={t.priority} /></td>
                  <td className="px-2 py-2">
                    <Select value={t.status} onChange={(e) => setStatus(t.id, e.target.value)} className="w-32 py-1 text-xs">{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
                  </td>
                  <td className="px-2 py-2">
                    <Select defaultValue="" onChange={(e) => reassign(t.id, e.target.value)} className="w-40 py-1 text-xs"><option value="">Reassign…</option>{members.map((mem) => <option key={mem.id} value={mem.id}>{mem.name}</option>)}</Select>
                  </td>
                </tr>
              );
            })}
            {tasks.length === 0 && <tr><td className="px-2 py-3 text-slate-400" colSpan={7}>No tasks.</td></tr>}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ------------------------------- 5. Gantt ---------------------------------- */
function GanttSection({ progress }: { progress: Progress[] }) {
  const delayed = progress.filter((p) => isDelayed(p));
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>Project Timelines</CardTitle>
          <Link href="/gantt"><Button variant="outline" className="px-3 py-1.5 text-xs"><GanttChartSquare size={14} /> Open Gantt</Button></Link>
        </div>
        <div className="space-y-2">
          {progress.map((p) => (
            <div key={p.id}><div className="mb-1 flex justify-between text-xs"><span className="text-slate-600">{p.title}</span><span className="font-semibold text-brand">{p.progress}%</span></div><Bar value={p.progress} accent={isDelayed(p) ? '#dc2626' : '#1f4e79'} /></div>
          ))}
          {progress.length === 0 && <p className="text-sm text-slate-400">No timelines yet.</p>}
        </div>
      </Card>
      <Card>
        <CardTitle>Delayed Tasks / Critical Path</CardTitle>
        {delayed.length === 0 ? <p className="text-sm text-emerald-600">No delayed projects.</p> : (
          <ul className="space-y-1 text-sm">{delayed.map((p) => <li key={p.id} className="flex justify-between"><span className="text-rose-600">{p.title}</span><span className="text-xs text-slate-400">due {p.endDate ? new Date(p.endDate).toLocaleDateString() : '—'}</span></li>)}</ul>
        )}
        <p className="mt-3 text-[11px] text-amber-600">Sprint Timeline · Critical Path · Resource Allocation overlays activate with a sprint/scheduling model.</p>
      </Card>
    </div>
  );
}

/* ------------------------------- 6. Reports -------------------------------- */
function ReportsSection({ projects }: { projects: Project[] }) {
  function dl(id: number, kind: 'report' | 'chart') {
    api.download(`/gantt/${id}/${kind}`, `${kind}-project-${id}.pdf`).catch((e) => alert((e as Error).message));
  }
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Project Progress Reports (PDF)</CardTitle>
        <div className="space-y-1.5">
          {projects.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-700/40">
              <span className="text-slate-700">{p.title}</span>
              <div className="flex gap-2"><Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => dl(p.id, 'report')}>Report</Button><Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => dl(p.id, 'chart')}>Gantt PDF</Button></div>
            </div>
          ))}
          {projects.length === 0 && <p className="text-sm text-slate-400">No projects.</p>}
        </div>
      </Card>
      <Planned title="Roll-up reports" needs="a reporting/export service" fields={['Development Report', 'QA Report', 'IoT Report', 'Documentation Report', 'Weekly Report', 'Monthly Report', 'Team Productivity', 'Resource Utilization', 'Delay Analysis', 'Risk Report', 'Client Progress', 'Executive Summary']} />
    </div>
  );
}

/* --------------------------- 7. Team Performance --------------------------- */
function PerformanceSection({ overview }: { overview: Overview | null }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Performance by Team / Head</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-2 py-2">Team</th><th className="px-2 py-2 text-center">People</th><th className="px-2 py-2 text-center">Tasks</th><th className="px-2 py-2 text-center">Done</th><th className="px-2 py-2 text-center">Overdue</th><th className="px-2 py-2 text-right">KPI (completion)</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {overview?.teams.map((t) => (
                <tr key={t.key}><td className="px-2 py-2 font-medium text-slate-700">{t.label}</td><td className="px-2 py-2 text-center">{t.members}</td><td className="px-2 py-2 text-center">{t.totalTasks}</td><td className="px-2 py-2 text-center text-emerald-600">{t.done}</td><td className="px-2 py-2 text-center text-rose-600">{t.overdue}</td><td className="px-2 py-2 text-right font-bold text-brand">{t.completion}%</td></tr>
              ))}
              {!overview && <tr><td className="px-2 py-3 text-slate-400" colSpan={6}>No data.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      <Planned title="Extended KPIs" needs="attendance + time-tracking aggregation" fields={['Attendance Summary', 'Workload', 'Average Completion Time', 'Team Efficiency', 'Quality Score', 'Performance Ranking']} />
    </div>
  );
}

/* --------------------------- 8. Risk Management ---------------------------- */
function RisksSection({ projects, m }: { projects: Project[]; m: any }) {
  const timelineRisks = projects.filter(isDelayed);
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Live Risk Signals (derived)</CardTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg bg-rose-50 p-3"><p className="text-2xl font-bold text-rose-600">{timelineRisks.length}</p><p className="text-xs text-slate-500">Timeline risks (delayed projects)</p></div>
          <div className="rounded-lg bg-amber-50 p-3"><p className="text-2xl font-bold text-amber-600">{m.overdue.length}</p><p className="text-xs text-slate-500">Overdue tasks</p></div>
          <div className="rounded-lg bg-slate-50 p-3"><p className="text-2xl font-bold text-slate-700">{m.highPriority}</p><p className="text-xs text-slate-500">High-priority open</p></div>
        </div>
        {timelineRisks.length > 0 && (
          <ul className="mt-3 space-y-1 text-sm">{timelineRisks.map((p) => <li key={p.id} className="flex justify-between"><span className="text-slate-700">{p.title}</span><span className="text-xs text-rose-600">past due</span></li>)}</ul>
        )}
      </Card>
      <Planned title="Risk register" needs="a Risk model (new table)" fields={['Project Risks', 'Technical Risks', 'Resource Risks', 'Budget Risks', 'Risk Priority', 'Risk Owner', 'Mitigation Plan']} />
    </div>
  );
}

/* --------------------------- 9. Approval Center ---------------------------- */
function ApprovalsSection() {
  const [leaves, setLeaves] = useState<any[] | null>(null);
  const [signups, setSignups] = useState<any[] | null>(null);
  const [signupDenied, setSignupDenied] = useState(false);
  useEffect(() => {
    api.get<any[]>('/leaves').then(setLeaves).catch(() => setLeaves([]));
    api.get<any[]>('/auth/signup-requests?status=PENDING').then(setSignups).catch(() => setSignupDenied(true));
  }, []);
  const pendingLeaves = (leaves ?? []).filter((l) => (l.status ?? '').toUpperCase() === 'PENDING');
  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Pending Leave Approvals</CardTitle>
        {leaves === null ? <p className="text-sm text-slate-400">Loading…</p> : pendingLeaves.length === 0 ? <p className="text-sm text-slate-400">No pending leave requests.</p> : (
          <ul className="space-y-1.5 text-sm">{pendingLeaves.map((l) => <li key={l.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-700/40"><span className="text-slate-700">{l.type ?? 'Leave'} · {l.user ? `${l.user.firstName} ${l.user.lastName}` : `#${l.userId}`}</span><span className="text-xs text-amber-600">PENDING</span></li>)}</ul>
        )}
        <Link href="/leaves" className="mt-2 inline-block text-xs text-brand underline">Manage in Leaves</Link>
      </Card>
      <Card>
        <CardTitle>Signup / Account Requests</CardTitle>
        {signupDenied ? <p className="text-sm text-amber-600">Account approvals are handled by the CTO/CEO.</p> : signups === null ? <p className="text-sm text-slate-400">Loading…</p> : signups.length === 0 ? <p className="text-sm text-slate-400">No pending requests.</p> : (
          <ul className="space-y-1.5 text-sm">{signups.map((s) => <li key={s.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2"><span>{s.firstName} {s.lastName} · {s.department ?? '—'}</span><span className="text-xs text-amber-600">PENDING</span></li>)}</ul>
        )}
      </Card>
      <Planned title="Engineering approvals" needs="approval workflow models" fields={['Project Plan', 'Sprint Plan', 'Release Approval', 'Architecture Approval', 'Resource Request', 'Budget Request', 'Change Request', 'Leave Escalation']} />
    </div>
  );
}

/* -------------------------- 10. Resource Monitoring ------------------------ */
function ResourcesSection({ overview }: { overview: Overview | null }) {
  const people = useMemo(() => (overview?.teams ?? []).flatMap((t) => t.people.map((p) => ({ ...p, team: t.label }))), [overview]);
  const open = (p: PersonStat) => p.total - p.done;
  const overloaded = people.filter((p) => open(p) >= 4);
  const free = people.filter((p) => open(p) === 0);
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="People tracked" value={people.length} />
        <Stat label="Overloaded (4+ open)" value={overloaded.length} accent="text-rose-600" />
        <Stat label="Free (0 open)" value={free.length} accent="text-emerald-600" />
      </div>
      <Card>
        <CardTitle>Capacity & Allocation</CardTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-2 py-2">Member</th><th className="px-2 py-2">Team</th><th className="px-2 py-2 text-center">Open</th><th className="px-2 py-2 text-center">Done</th><th className="px-2 py-2">Load</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {people.map((p) => { const load = Math.min(100, open(p) * 20); return (
                <tr key={`${p.team}-${p.id}`}><td className="px-2 py-2 text-slate-700">{p.name}</td><td className="px-2 py-2 text-slate-400">{p.team}</td><td className="px-2 py-2 text-center font-semibold">{open(p)}</td><td className="px-2 py-2 text-center text-emerald-600">{p.done}</td><td className="px-2 py-2"><Bar value={load} accent={load >= 80 ? '#dc2626' : load >= 50 ? '#eab308' : '#16a34a'} /></td></tr>
              ); })}
              {people.length === 0 && <tr><td className="px-2 py-3 text-slate-400" colSpan={5}>No team members yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-amber-600">Load is an open-task proxy. Hiring Requirement planning needs a capacity model.</p>
      </Card>
    </div>
  );
}

/* ------------------------- 11. Communication Center ------------------------ */
function CommsSection({ notifications }: { notifications: Notification[] }) {
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>Notifications</CardTitle>
          <Link href="/notifications"><Button variant="outline" className="px-3 py-1.5 text-xs">Open & Broadcast</Button></Link>
        </div>
        {notifications.length === 0 ? <p className="text-sm text-slate-400">No messages.</p> : (
          <ul className="space-y-1.5">
            {notifications.slice(0, 12).map((n) => (
              <li key={n.id} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-700/40">
                <div className="flex items-center justify-between"><span className="text-sm font-medium text-slate-700">{n.title}</span><span className="text-[10px] text-slate-400">{n.category ?? 'MSG'} · {new Date(n.createdAt).toLocaleString()}</span></div>
                <p className="text-xs text-slate-500">{n.message}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Planned title="Collaboration" needs="a meetings module" fields={['CEO Messages', 'CTO Messages', 'Announcements', 'Team Broadcast', 'Meeting Schedule', 'Meeting Minutes']} />
    </div>
  );
}

/* ------------------------------ 12. Analytics ------------------------------ */
function AnalyticsSection({ overview, tasks, projects }: { overview: Overview | null; tasks: Task[]; projects: Project[] }) {
  const byStatus = STATUSES.map((s) => ({ s, n: tasks.filter((t) => t.status === s).length }));
  const max = Math.max(1, ...byStatus.map((x) => x.n));
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Task Status Distribution</CardTitle>
          <div className="space-y-2">
            {byStatus.map((x) => (<div key={x.s}><div className="mb-1 flex justify-between text-xs"><span className="text-slate-600">{x.s}</span><span className="text-slate-500">{x.n}</span></div><Bar value={(x.n / max) * 100} /></div>))}
          </div>
        </Card>
        <Card>
          <CardTitle>Team Comparison (completion)</CardTitle>
          <div className="space-y-2">
            {overview?.teams.map((t) => (<div key={t.key}><div className="mb-1 flex justify-between text-xs"><span className="text-slate-600">{t.label}</span><span className="font-semibold text-brand">{t.completion}%</span></div><Bar value={t.completion} /></div>))}
            {!overview && <p className="text-sm text-slate-400">No data.</p>}
          </div>
        </Card>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Total Tasks" value={tasks.length} />
        <Stat label="Projects" value={projects.length} />
        <Stat label="Org Completion" value={`${overview?.totals.completion ?? 0}%`} />
      </div>
      <Planned title="Agile analytics" needs="sprint + test-coverage data" fields={['Burndown Chart', 'Velocity Chart', 'Sprint Analytics', 'Bug Analytics', 'Test Coverage', 'Productivity Trends', 'Department Comparison']} />
    </div>
  );
}

/* ------------------------------ 13. Audit Log ------------------------------ */
function AuditSection({ audit, denied }: { audit: AuditRow[] | null; denied: boolean }) {
  const rows = Array.isArray(audit) ? audit : [];
  if (denied || !audit)
    return (
      <Card>
        <CardTitle>Audit Log</CardTitle>
        <p className="text-sm text-amber-600">The full audit trail is restricted to CEO/CTO (AUDIT_VIEW capability). Ask an admin to grant VP audit access to enable this view.</p>
        <p className="mt-2 text-[11px] text-slate-400">Captured events: Login/Logout History · Task Changes · Approval History · Project Updates · File Downloads · Document Changes · User Activities.</p>
      </Card>
    );
  return (
    <Card>
      <CardTitle>Audit Log ({rows.length})</CardTitle>
      <div className="max-h-[60vh] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-white dark:bg-slate-800"><tr className="border-b border-slate-200 text-left uppercase tracking-wide text-slate-500"><th className="px-2 py-2">Action</th><th className="px-2 py-2">Status</th><th className="px-2 py-2">User</th><th className="px-2 py-2 text-right">When</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.slice(0, 200).map((a) => (
              <tr key={a.id}><td className="px-2 py-1.5 text-slate-700">{a.action}</td><td className="px-2 py-1.5"><span className={(a.statusCode ?? 0) >= 400 ? 'text-rose-600' : 'text-emerald-600'}>{a.statusCode ?? '—'}</span></td><td className="px-2 py-1.5 text-slate-500">{a.userId ?? 'system'}</td><td className="px-2 py-1.5 text-right text-slate-400">{new Date(a.createdAt).toLocaleString()}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ------------------------------ 14. Settings ------------------------------- */
function SettingsSection() {
  const items = ['Profile', 'Change Password', 'Two-Factor (OTP)', 'Google Authentication', 'Dark / Light Mode', 'Notification Settings', 'Email Preferences', 'Profile Picture', 'Language', 'Time Zone'];
  return (
    <Card>
      <div className="flex items-center justify-between">
        <CardTitle>Settings</CardTitle>
        <Link href="/settings"><Button variant="outline" className="px-3 py-1.5 text-xs">Open Settings</Button></Link>
      </div>
      <p className="mb-3 text-xs text-slate-400">Account settings are managed on the shared Settings page.</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((i) => <span key={i} className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-600 dark:bg-slate-700/50 dark:text-slate-300">{i}</span>)}
      </div>
    </Card>
  );
}
