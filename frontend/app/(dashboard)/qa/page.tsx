'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Button,
  Card,
  CardTitle,
  Input,
  Label,
  PageHeader,
  Select,
  StatusBadge,
  Table,
  Td,
} from '@/components/ui';

interface BugRow {
  id: number; title: string; description?: string | null; severity: string;
  status: string; taskId?: number | null; task?: { id: number; title: string } | null;
}

const isQA = (t: string) => t === 'TIER_6';
const BUG_STATUSES = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export default function QaPage() {
  const { user } = useAuth();
  const [bugs, setBugs] = useState<BugRow[]>([]);
  const [form, setForm] = useState({ taskId: '', title: '', description: '', severity: 'MEDIUM' });
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    api.get<BugRow[]>('/bugs').then(setBugs).catch(() => {});
  }, []);
  useEffect(load, [load]);

  if (!user) return null;

  async function fileBug(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      await api.post('/bugs', {
        taskId: form.taskId ? Number(form.taskId) : undefined,
        title: form.title,
        description: form.description || undefined,
        severity: form.severity,
      });
      setForm({ taskId: '', title: '', description: '', severity: 'MEDIUM' });
      setMsg('Bug filed.');
      load();
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  async function changeStatus(id: number, status: string) {
    await api.patch(`/bugs/${id}/status`, { status });
    load();
  }

  return (
    <div>
      <PageHeader title="QA / Bug Tracker" />

      {isQA(user.permissionTier) && (
        <Card className="mb-5">
          <CardTitle>File a Bug</CardTitle>
          <form onSubmit={fileBug} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div><Label>Task ID (optional)</Label><Input value={form.taskId} onChange={(e) => setForm({ ...form, taskId: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            </div>
            <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div className="flex items-end gap-3">
              <div className="w-40">
                <Label>Severity</Label>
                <Select value={form.severity} onChange={(e) => setForm({ ...form, severity: e.target.value })}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </Select>
              </div>
              <Button type="submit">File bug</Button>
              {msg && <span className="text-sm text-brand">{msg}</span>}
            </div>
          </form>
        </Card>
      )}

      <Table head={['ID', 'Title', 'Task', 'Severity', 'Status', 'Change status']}>
        {bugs.map((b) => (
          <tr key={b.id}>
            <Td>{b.id}</Td>
            <Td>{b.title}</Td>
            <Td>{b.task ? `#${b.task.id} ${b.task.title}` : '—'}</Td>
            <Td><StatusBadge status={b.severity} /></Td>
            <Td><StatusBadge status={b.status} /></Td>
            <Td>
              <Select value={b.status} onChange={(e) => changeStatus(b.id, e.target.value)} className="w-36">
                {BUG_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Td>
          </tr>
        ))}
        {bugs.length === 0 && <tr><Td className="text-slate-400">No bugs reported.</Td></tr>}
      </Table>
    </div>
  );
}
