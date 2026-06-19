'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { Button, Card, CardTitle, Input, Label, PageHeader, Select } from '@/components/ui';
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

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
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

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      const [ov, gr] = await Promise.all([
        api.get<Overview>('/engineering/overview'),
        api.get<TeamGroup[]>('/engineering/teams'),
      ]);
      setOverview(ov);
      setGroups(gr);
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
            <Label>Deadline</Label>
            <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
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
    </div>
  );
}
