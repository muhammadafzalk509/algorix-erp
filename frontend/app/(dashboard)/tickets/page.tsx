'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useList } from '@/lib/useList';
import { Button, Card, CardTitle, Input, Label, PageHeader, StatusBadge, Table, Td, Textarea } from '@/components/ui';

interface Ticket { id: number; title: string; category: string; priority: string; status: string; }

export default function TicketsPage() {
  const { data, loading, reload } = useList<Ticket>('/tickets');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: 'Technical' });
  const [err, setErr] = useState('');

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try { await api.post('/tickets', form); setForm({ title: '', description: '', category: 'Technical' }); setOpen(false); reload(); }
    catch (e) { setErr((e as Error).message); }
  }

  return (
    <div>
      <PageHeader title="Support Tickets" action={<Button onClick={() => setOpen(!open)}>+ New Ticket</Button>} />
      {open && (
        <Card className="mb-5">
          <CardTitle>New Ticket</CardTitle>
          <form onSubmit={create} className="grid gap-3">
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            {err && <p className="text-sm text-rose-600">{err}</p>}
            <div><Button type="submit">Create</Button></div>
          </form>
        </Card>
      )}
      {loading ? <p className="text-sm text-slate-400">Loading…</p> : (
        <Table head={['ID', 'Title', 'Category', 'Priority', 'Status']}>
          {data.map((t) => (
            <tr key={t.id}>
              <Td>{t.id}</Td><Td>{t.title}</Td><Td>{t.category}</Td><Td>{t.priority}</Td><Td><StatusBadge status={t.status} /></Td>
            </tr>
          ))}
          {data.length === 0 && <tr><Td className="text-slate-400">No tickets.</Td></tr>}
        </Table>
      )}
    </div>
  );
}
