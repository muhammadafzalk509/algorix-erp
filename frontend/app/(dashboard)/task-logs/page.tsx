'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useList } from '@/lib/useList';
import { useAuth } from '@/lib/auth';
import { Button, Card, CardTitle, Input, Label, PageHeader, Table, Td, Textarea } from '@/components/ui';

interface Log { id: number; date: string; hoursSpent: string; workDescription: string; task?: { title: string }; user?: { firstName: string; lastName: string }; }

const today = () => new Date().toISOString().slice(0, 10);

export default function TaskLogsPage() {
  const { user } = useAuth();
  const isDev = user?.permissionTier === 'TIER_5';
  const { data, loading, reload } = useList<Log>('/task-logs');
  const [form, setForm] = useState({ taskId: '', hoursSpent: '', date: today(), workDescription: '', githubUrl: '' });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(''); setOk('');
    try {
      await api.post('/task-logs', {
        taskId: Number(form.taskId),
        hoursSpent: Number(form.hoursSpent),
        date: form.date,
        workDescription: form.workDescription,
        githubUrl: form.githubUrl || undefined,
      });
      setOk('Logged ✓');
      setForm({ taskId: '', hoursSpent: '', date: today(), workDescription: '', githubUrl: '' });
      reload();
    } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div>
      <PageHeader title="Task Logs" />
      {isDev && (
        <Card className="mb-5">
          <CardTitle>Submit Work Log</CardTitle>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <div><Label>Task ID</Label><Input type="number" value={form.taskId} onChange={(e) => setForm({ ...form, taskId: e.target.value })} /></div>
            <div><Label>Hours (max 12/day)</Label><Input type="number" step="0.5" value={form.hoursSpent} onChange={(e) => setForm({ ...form, hoursSpent: e.target.value })} /></div>
            <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
            <div><Label>GitHub URL</Label><Input value={form.githubUrl} onChange={(e) => setForm({ ...form, githubUrl: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Work Description</Label><Textarea rows={2} value={form.workDescription} onChange={(e) => setForm({ ...form, workDescription: e.target.value })} /></div>
            {err && <p className="text-sm text-rose-600 sm:col-span-2">{err}</p>}
            {ok && <p className="text-sm text-emerald-600 sm:col-span-2">{ok}</p>}
            <div className="sm:col-span-2"><Button type="submit">Submit Log</Button></div>
          </form>
        </Card>
      )}
      {loading ? <p className="text-sm text-slate-400">Loading…</p> : (
        <Table head={['Date', 'Task', 'Developer', 'Hours', 'Description']}>
          {data.map((l) => (
            <tr key={l.id}>
              <Td>{l.date?.slice(0, 10)}</Td><Td>{l.task?.title || '—'}</Td>
              <Td>{l.user ? `${l.user.firstName} ${l.user.lastName}` : '—'}</Td>
              <Td>{l.hoursSpent}</Td><Td>{l.workDescription}</Td>
            </tr>
          ))}
          {data.length === 0 && <tr><Td className="text-slate-400">No logs.</Td></tr>}
        </Table>
      )}
    </div>
  );
}
