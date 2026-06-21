'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { Button, Card, CardTitle, Input, Label, Modal, PageHeader, Select, StatusBadge } from '@/components/ui';
import { toast } from '@/components/toast';
import { AlertTriangle, CheckCircle2, Clock, Send, Users as UsersIcon } from 'lucide-react';

interface PersonStat {
  id: number;
  name: string;
  role: string;
  total: number;
  done: number;
  inProgress: number;
  overdue: number;
  completion: number;
}
interface Team {
  key: string;
  label: string;
  roles: string[];
  members: number;
  totalTasks: number;
  done: number;
  inProgress: number;
  todo: number;
  overdue: number;
  completion: number;
  people: PersonStat[];
}
interface Overview {
  generatedAt: string;
  teams: Team[];
  totals: { members: number; totalTasks: number; done: number; completion: number };
}
interface TeamMember { id: number; name: string; role: string; tier: string }
interface TeamGroup { key: string; label: string; members: TeamMember[] }
interface Project { id: number; title: string }
interface Task {
  id: number; projectId?: number; title: string; status: string; priority: string;
  dueDate?: string | null; project?: { title: string }; assignee?: { id?: number; firstName: string; lastName: string } | null;
}

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const STATUSES = ['TODO', 'IN_PROGRESS', 'REVIEW', 'TESTING', 'DONE'];

// ISO → value for <input type="datetime-local"> (local time, no seconds).
function toLocalInput(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
const TEAM_ACCENT: Record<string, string> = {
  development: '#1f4e79',
  qa: '#7c3aed',
  documentation: '#0891b2',
  iot: '#ea580c',
};

export default function EngineeringHubPage() {
  const { user } = useAuth();
  const allowed = can(user?.permissionTier, ['TIER_0', 'TIER_1', 'TIER_2']);

  const [overview, setOverview] = useState<Overview | null>(null);
  const [groups, setGroups] = useState<TeamGroup[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // assignment form
  const [form, setForm] = useState({ teamKey: '', assignedTo: '', projectId: '', title: '', dueDate: '', priority: 'MEDIUM' });
  const [assignMsg, setAssignMsg] = useState('');
  const [assignErr, setAssignErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // editable task list
  const [tasks, setTasks] = useState<Task[]>([]);
  const [edit, setEdit] = useState<Task | null>(null);
  const [editForm, setEditForm] = useState({ title: '', projectId: '', assignedTo: '', dueDate: '', priority: 'MEDIUM', status: 'TODO' });
  const [saving, setSaving] = useState(false);
  const setEF = (k: string, v: string) => setEditForm((f) => ({ ...f, [k]: v }));

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const [ov, gr, tk] = await Promise.all([
        api.get<Overview>('/engineering/overview'),
        api.get<TeamGroup[]>('/engineering/teams'),
        api.get<Task[]>('/tasks'),
      ]);
      setOverview(ov);
      setGroups(gr);
      setTasks(tk);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!allowed) { setLoading(false); return; }
    load();
    api.get<Project[]>('/projects').then(setProjects).catch(() => { /* ignore */ });
  }, [allowed, load]);

  const membersForTeam = useMemo(
    () => groups.find((g) => g.key === form.teamKey)?.members ?? [],
    [groups, form.teamKey],
  );
  const allMembers = useMemo(() => groups.flatMap((g) => g.members), [groups]);

  function openEdit(t: Task) {
    setEditForm({
      title: t.title,
      projectId: String(t.projectId ?? ''),
      assignedTo: String(t.assignee?.id ?? ''),
      dueDate: toLocalInput(t.dueDate),
      priority: t.priority || 'MEDIUM',
      status: t.status || 'TODO',
    });
    setEdit(t);
  }
  async function saveEdit() {
    if (!edit) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        title: editForm.title,
        priority: editForm.priority,
        status: editForm.status,
        dueDate: editForm.dueDate ? new Date(editForm.dueDate).toISOString() : null,
      };
      if (editForm.projectId) payload.projectId = Number(editForm.projectId);
      if (editForm.assignedTo) payload.assignedTo = Number(editForm.assignedTo);
      await api.put(`/tasks/${edit.id}`, payload);
      toast.success('Task updated.');
      setEdit(null);
      load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    setAssignErr('');
    setAssignMsg('');
    setSubmitting(true);
    try {
      await api.post('/tasks', {
        projectId: Number(form.projectId),
        title: form.title,
        assignedTo: form.assignedTo ? Number(form.assignedTo) : undefined,
        priority: form.priority,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
      });
      setAssignMsg('Task assigned.');
      setForm({ ...form, title: '', dueDate: '' });
      await load();
    } catch (e) {
      setAssignErr((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!allowed)
    return (
      <div>
        <PageHeader title="VP Engineering Portal" />
        <p className="text-sm text-rose-600">This portal is available to VP Engineering, CTO and CEO only.</p>
      </div>
    );

  return (
    <div>
      <PageHeader title="VP Engineering Portal" />
      <p className="-mt-2 mb-5 text-sm text-slate-500">
        VP Engineering overview — track Development, QA / Testing, Documentation and IoT progress, and assign work to any team.
      </p>
      {err && <p className="mb-4 text-sm text-rose-600">{err}</p>}

      {/* Portfolio totals */}
      {overview && (
        <Card className="mb-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm text-slate-500">People tracked</p>
              <p className="text-3xl font-extrabold text-brand">{overview.totals.members}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Tasks</p>
              <p className="text-3xl font-extrabold text-brand">{overview.totals.done}<span className="text-lg text-slate-400">/{overview.totals.totalTasks}</span></p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Overall completion</p>
              <p className="text-3xl font-extrabold text-brand">{overview.totals.completion}%</p>
            </div>
          </div>
        </Card>
      )}

      {/* Assignment panel */}
      <Card className="mb-6">
        <CardTitle>Assign a task</CardTitle>
        <form onSubmit={assign} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>Team</Label>
            <Select value={form.teamKey} onChange={(e) => setForm({ ...form, teamKey: e.target.value, assignedTo: '' })} required>
              <option value="">Select team…</option>
              {groups.map((g) => <option key={g.key} value={g.key}>{g.label} ({g.members.length})</option>)}
            </Select>
          </div>
          <div>
            <Label>Assign to (head or member)</Label>
            <Select value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} required disabled={!form.teamKey}>
              <option value="">{form.teamKey ? 'Select person…' : 'Pick a team first'}</option>
              {membersForTeam.map((m) => <option key={m.id} value={m.id}>{m.name} — {m.role}</option>)}
            </Select>
          </div>
          <div>
            <Label>Project</Label>
            <Select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} required>
              <option value="">Select project…</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
          </div>
          <div className="lg:col-span-2">
            <Label>Task name</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Integrate sensor telemetry" />
          </div>
          <div>
            <Label>Priority</Label>
            <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </div>
          <div>
            <Label>Deadline (date &amp; time)</Label>
            <Input type="datetime-local" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>
          {form.teamKey && membersForTeam.length === 0 && (
            <p className="text-xs text-slate-400 sm:col-span-2 lg:col-span-3">No active people in this team yet — add them under Users first.</p>
          )}
          {assignErr && <p className="text-sm text-rose-600 sm:col-span-2 lg:col-span-3">{assignErr}</p>}
          {assignMsg && <p className="text-sm text-emerald-600 sm:col-span-2 lg:col-span-3">{assignMsg}</p>}
          <div className="sm:col-span-2 lg:col-span-3">
            <Button type="submit" disabled={submitting}><Send size={15} /> {submitting ? 'Assigning…' : 'Assign Task'}</Button>
          </div>
        </form>
      </Card>

      {/* Team progress tracking */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Team progress</h2>
      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {overview?.teams.map((t) => {
            const accent = TEAM_ACCENT[t.key] ?? '#1f4e79';
            return (
              <Card key={t.key}>
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-800">{t.label}</h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1"><UsersIcon size={12} /> {t.members} {t.members === 1 ? 'person' : 'people'} · {t.roles.join(', ')}</p>
                  </div>
                  <span className="text-lg font-bold" style={{ color: accent }}>{t.completion}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full transition-all" style={{ width: `${t.completion}%`, backgroundColor: accent }} />
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs">
                  <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={13} /> {t.done} done</span>
                  <span className="flex items-center gap-1 text-amber-600"><Clock size={13} /> {t.inProgress} in progress</span>
                  <span className="flex items-center gap-1 text-slate-500">{t.todo} to do</span>
                  {t.overdue > 0 && <span className="flex items-center gap-1 font-semibold text-rose-600"><AlertTriangle size={13} /> {t.overdue} overdue</span>}
                </div>

                {t.people.length > 0 && (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-wide text-slate-400">
                          <th className="pb-1">Member</th>
                          <th className="pb-1">Role</th>
                          <th className="pb-1 text-center">Done/Total</th>
                          <th className="pb-1 text-right">Progress</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {t.people.map((p) => (
                          <tr key={p.id}>
                            <td className="py-1 text-slate-700">{p.name}</td>
                            <td className="py-1 text-slate-400">{p.role}</td>
                            <td className="py-1 text-center text-slate-600">{p.done}/{p.total}{p.overdue > 0 && <span className="text-rose-500"> · {p.overdue}!</span>}</td>
                            <td className="py-1 text-right font-semibold" style={{ color: accent }}>{p.completion}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {t.members === 0 && <p className="mt-3 text-xs text-slate-400">No active members in this team yet.</p>}
              </Card>
            );
          })}
        </div>
      )}

      {/* Editable team tasks — edit any field incl. deadline date & time */}
      <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-slate-500">All team tasks — edit any field</h2>
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500"><th className="px-2 py-2">Task</th><th className="px-2 py-2">Project</th><th className="px-2 py-2">Assignee</th><th className="px-2 py-2">Deadline</th><th className="px-2 py-2">Priority</th><th className="px-2 py-2">Status</th><th className="px-2 py-2 text-right">Edit</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.map((t) => {
                const overdue = t.dueDate && new Date(t.dueDate).getTime() < Date.now() && t.status !== 'DONE';
                return (
                  <tr key={t.id}>
                    <td className="px-2 py-2 text-slate-700">{t.title}</td>
                    <td className="px-2 py-2 text-slate-500">{t.project?.title ?? '—'}</td>
                    <td className="px-2 py-2 text-slate-500">{t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : '—'}</td>
                    <td className="px-2 py-2"><span className={overdue ? 'font-semibold text-rose-600' : 'text-slate-500'}>{t.dueDate ? new Date(t.dueDate).toLocaleString() : '—'}</span></td>
                    <td className="px-2 py-2"><StatusBadge status={t.priority} /></td>
                    <td className="px-2 py-2"><StatusBadge status={t.status} /></td>
                    <td className="px-2 py-2 text-right"><Button variant="outline" className="px-2.5 py-1 text-xs" onClick={() => openEdit(t)}>Edit</Button></td>
                  </tr>
                );
              })}
              {tasks.length === 0 && <tr><td className="px-2 py-3 text-slate-400" colSpan={7}>No tasks yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title="Edit task"
        footer={
          <>
            <Button variant="outline" onClick={() => setEdit(null)} disabled={saving}>Cancel</Button>
            <Button onClick={saveEdit} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div><Label>Task title</Label><Input value={editForm.title} onChange={(e) => setEF('title', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Project</Label>
              <Select value={editForm.projectId} onChange={(e) => setEF('projectId', e.target.value)}>
                <option value="">— unchanged —</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </Select>
            </div>
            <div>
              <Label>Assignee</Label>
              <Select value={editForm.assignedTo} onChange={(e) => setEF('assignedTo', e.target.value)}>
                <option value="">— unassigned —</option>
                {allMembers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Priority</Label><Select value={editForm.priority} onChange={(e) => setEF('priority', e.target.value)}>{PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}</Select></div>
            <div><Label>Status</Label><Select value={editForm.status} onChange={(e) => setEF('status', e.target.value)}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
          </div>
          <div><Label>Deadline (date &amp; time)</Label><Input type="datetime-local" value={editForm.dueDate} onChange={(e) => setEF('dueDate', e.target.value)} /></div>
        </div>
      </Modal>
    </div>
  );
}
