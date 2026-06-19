'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useList } from '@/lib/useList';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { Button, Card, CardTitle, Input, Label, PageHeader, Table, Td } from '@/components/ui';

interface Client { id: number; name: string; companyName?: string; email: string; phone?: string; currency: string; }

export default function ClientsPage() {
  const { user } = useAuth();
  const { data, loading, reload } = useList<Client>('/clients');
  const [form, setForm] = useState({ name: '', email: '', companyName: '', phone: '' });
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');
  const canCreate = can(user?.permissionTier, ['TIER_1', 'TIER_2']);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await api.post('/clients', form);
      setForm({ name: '', email: '', companyName: '', phone: '' });
      setOpen(false);
      reload();
    } catch (e) { setErr((e as Error).message); }
  }

  return (
    <div>
      <PageHeader title="Clients" action={canCreate && <Button onClick={() => setOpen(!open)}>+ New Client</Button>} />
      {open && canCreate && (
        <Card className="mb-5">
          <CardTitle>New Client</CardTitle>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Company</Label><Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            {err && <p className="text-sm text-rose-600 sm:col-span-2">{err}</p>}
            <div className="sm:col-span-2"><Button type="submit">Create</Button></div>
          </form>
        </Card>
      )}
      {loading ? <p className="text-sm text-slate-400">Loading…</p> : (
        <Table head={['ID', 'Name', 'Company', 'Email', 'Phone']}>
          {data.map((c) => (
            <tr key={c.id}>
              <Td>{c.id}</Td><Td>{c.name}</Td><Td>{c.companyName || '—'}</Td><Td>{c.email}</Td><Td>{c.phone || '—'}</Td>
            </tr>
          ))}
          {data.length === 0 && <tr><Td className="text-slate-400">No clients.</Td></tr>}
        </Table>
      )}
    </div>
  );
}
