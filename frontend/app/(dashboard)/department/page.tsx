'use client';

import { useCallback, useEffect, useState } from 'react';
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
interface TeamMember { id: number; name: string; role: string; tier: string }
interface MyTeam { team: Team | null; members: TeamMember[] }
interface Project { id: number; title: string }

const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export default function DepartmentPortalPage() {
  const { user } = useAuth();
  const allowed = can(user?.permissionTier, ['TIER_3', 'TIER_4']);

  const [data, setData] = useState<MyTeam | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  const [form, setForm] = useState({ assignedTo: '', projectId: '', title: '', dueDate: '', priority: 'MEDIUM' });
  const [assignMsg, setAssignMsg] = useState('');
  const [assignErr, setAssignErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setErr('');
    try {
      setData(await api.get<MyTeam>('/engineering/my-team'));
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
      setAssignMsg('Task assigned to your team.');
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
        <PageHeader title="My Department" />
        <p className="text-sm text-rose-600">This portal is available to department heads (Head of Developer, Head of QA, Head of IoT, Head of Documentation).</p>
      </div>
    );

  const team = data?.team;
  const members = data?.members ?? [];
  const title = team ? `${team.label} Portal` : 'My Department';

  return (
    <div>
      <PageHeader title={title} />
      <p className="-mt-2 mb-5 text-sm text-slate-500">
        Your department workspace — track your team and assign their work.
      </p>
      {err && <p className="mb-4 text-sm text-rose-600">{err}</p>}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : !team ? (
        <p className="text-sm text-slate-400">No department is mapped to your role.</p>
      ) : (
        <>
          {/* Team summary */}
          <Card className="mb-5">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-slate-800">{team.label} team</h3>
                <p className="text-xs text-slate-400 flex items-center gap-1">
                  <UsersIcon size={12} /> {team.members} {team.members === 1 ? 'person' : 'people'} · {team.roles.join(', ')}
                </p>
              </div>
              <span className="text-2xl font-extrabold text-brand">{team.completion}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${team.completion}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs">
              <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={13} /> {team.done} done</span>
              <span className="flex items-center gap-1 text-amber-600"><Clock size={13} /> {team.inProgress} in progress</span>
              <span className="flex items-center gap-1 text-slate-500">{team.todo} to do</span>
              {team.overdue > 0 && <span className="flex items-center gap-1 font-semibold text-rose-600"><AlertTriangle size={13} /> {team.overdue} overdue</span>}
            </div>
          </Card>

          {/* Assignment */}
          <Card className="mb-6">
            <CardTitle>Assign a task to your team</CardTitle>
            <form onSubmit={assign} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <Label>Assign to</Label>
                <Select value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} required disabled={members.length === 0}>
                  <option value="">{members.length ? 'Select team member…' : 'No members yet'}</option>
                  {members.map((m) => <option key={m.id} value={m.id}>{m.name} — {m.role}</option>)}
                </Select>
              </div>
              <div>
                <Label>Project</Label>
                <Select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} required>
                  <option value="">Select project…</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                </Select>
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </Select>
              </div>
              <div className="lg:col-span-2">
                <Label>Task name</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Fix login validation" />
              </div>
              <div>
                <Label>Deadline</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
              {members.length === 0 && <p className="text-xs text-slate-400 sm:col-span-2 lg:col-span-3">No active members in your department yet — they appear once added under Users.</p>}
              {assignErr && <p className="text-sm text-rose-600 sm:col-span-2 lg:col-span-3">{assignErr}</p>}
              {assignMsg && <p className="text-sm text-emerald-600 sm:col-span-2 lg:col-span-3">{assignMsg}</p>}
              <div className="sm:col-span-2 lg:col-span-3">
                <Button type="submit" disabled={submitting}><Send size={15} /> {submitting ? 'Assigning…' : 'Assign Task'}</Button>
              </div>
            </form>
          </Card>

          {/* Members */}
          <Card>
            <CardTitle>Team members</CardTitle>
            {team.people.length === 0 ? (
              <p className="text-sm text-slate-400">No members yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2">Member</th>
                    <th className="px-2 py-2">Role</th>
                    <th className="px-2 py-2 text-center">Done / Total</th>
                    <th className="px-2 py-2 text-center">Overdue</th>
                    <th className="px-2 py-2 text-right">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {team.people.map((p) => (
                    <tr key={p.id}>
                      <td className="px-2 py-2 text-slate-700">{p.name}</td>
                      <td className="px-2 py-2 text-slate-400">{p.role}</td>
                      <td className="px-2 py-2 text-center text-slate-600">{p.done}/{p.total}</td>
                      <td className="px-2 py-2 text-center">{p.overdue > 0 ? <span className="font-semibold text-rose-600">{p.overdue}</span> : <span className="text-slate-300">0</span>}</td>
                      <td className="px-2 py-2 text-right font-semibold text-brand">{p.completion}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
