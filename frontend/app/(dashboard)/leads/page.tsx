'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useList } from '@/lib/useList';
import { Button, Card, CardTitle, Input, Label, PageHeader, StatusBadge, Table, Td } from '@/components/ui';

interface Lead { id: number; name: string; company?: string; source?: string; budget?: string; status: string; }

export default function LeadsPage() {
  const { data, loading, reload } = useList<Lead>('/leads');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', company: '', source: '', budget: '' });
  const [err, setErr] = useState('');

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await api.post('/leads', { ...form, budget: form.budget ? Number(form.budget) : undefined });
      setForm({ name: '', company: '', source: '', budget: '' });
      setOpen(false);
      reload();
    } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div>
      <PageHeader title="Leads" action={<Button onClick={() => setOpen(!open)}>+ New Lead</Button>} />
      {open && (
        <Card className="mb-5">
          <CardTitle>New Lead</CardTitle>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Company</Label><Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} /></div>
            <div><Label>Source</Label><Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="website, linkedin…" /></div>
            <div><Label>Budget</Label><Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></div>
            {err && <p className="text-sm text-rose-600 sm:col-span-2">{err}</p>}
            <div className="sm:col-span-2"><Button type="submit">Create</Button></div>
          </form>
        </Card>
      )}
      {loading ? <p className="text-sm text-slate-400">Loading…</p> : (
        <Table head={['ID', 'Name', 'Company', 'Source', 'Budget', 'Status']}>
          {data.map((l) => (
            <tr key={l.id}>
              <Td>{l.id}</Td><Td>{l.name}</Td><Td>{l.company || '—'}</Td><Td>{l.source || '—'}</Td><Td>{l.budget || '—'}</Td><Td><StatusBadge status={l.status} /></Td>
            </tr>
          ))}
          {data.length === 0 && <tr><Td className="text-slate-400">No leads.</Td></tr>}
        </Table>
      )}
    </div>
  );
}
