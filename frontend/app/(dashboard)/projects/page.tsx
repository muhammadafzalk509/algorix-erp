'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useList } from '@/lib/useList';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { Button, Card, CardTitle, Input, Label, PageHeader, Select, StatusBadge, Table, Td } from '@/components/ui';

interface Project { id: number; title: string; status: string; budget?: string; client?: { name: string }; }
interface Client { id: number; name: string; }

export default function ProjectsPage() {
  const { user } = useAuth();
  const { data, loading, reload } = useList<Project>('/projects');
  const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ clientId: '', title: '', budget: '' });
  const [err, setErr] = useState('');
  const canCreate = can(user?.permissionTier, ['TIER_0', 'TIER_1', 'TIER_2']);

  async function toggle() {
    if (!open && canCreate) {
      try { setClients(await api.get<Client[]>('/clients')); } catch { /* ignore */ }
    }
    setOpen(!open);
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await api.post('/projects', {
        clientId: Number(form.clientId),
        title: form.title,
        budget: form.budget ? Number(form.budget) : undefined,
      });
      setForm({ clientId: '', title: '', budget: '' });
      setOpen(false);
      reload();
    } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div>
      <PageHeader title="Projects" action={canCreate && <Button onClick={toggle}>+ New Project</Button>} />
      {open && canCreate && (
        <Card className="mb-5">
          <CardTitle>New Project</CardTitle>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
            <div><Label>Client</Label>
              <Select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
                <option value="">Select client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Budget</Label><Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></div>
            {err && <p className="text-sm text-rose-600 sm:col-span-2">{err}</p>}
            <div className="sm:col-span-2"><Button type="submit">Create</Button></div>
          </form>
        </Card>
      )}
      {loading ? <p className="text-sm text-slate-400">Loading…</p> : (
        <Table head={['ID', 'Title', 'Client', 'Budget', 'Status']}>
          {data.map((p) => (
            <tr key={p.id}>
              <Td>{p.id}</Td><Td>{p.title}</Td><Td>{p.client?.name || '—'}</Td><Td>{p.budget || '—'}</Td><Td><StatusBadge status={p.status} /></Td>
            </tr>
          ))}
          {data.length === 0 && <tr><Td className="text-slate-400">No projects.</Td></tr>}
        </Table>
      )}
    </div>
  );
}
