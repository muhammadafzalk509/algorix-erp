'use client';

import { useState } from 'react';
import { api, API_BASE, tokenStore } from '@/lib/api';
import { useList } from '@/lib/useList';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { Button, Card, CardTitle, Input, Label, PageHeader, StatusBadge, Table, Td } from '@/components/ui';

interface Invoice { id: number; amount: string; status: string; client?: { name: string }; dueDate?: string; }

export default function InvoicesPage() {
  const { user } = useAuth();
  const { data, loading, reload } = useList<Invoice>('/invoices');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ clientId: '', amount: '', dueDate: '' });
  const [err, setErr] = useState('');
  const canCreate = can(user?.permissionTier, ['TIER_1', 'TIER_2']);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await api.post('/invoices', {
        clientId: Number(form.clientId),
        amount: Number(form.amount),
        dueDate: form.dueDate || undefined,
      });
      setForm({ clientId: '', amount: '', dueDate: '' });
      setOpen(false);
      reload();
    } catch (e) { setErr((e as Error).message); }
  }

  async function downloadPdf(id: number) {
    const res = await fetch(`${API_BASE}/invoices/${id}/pdf`, {
      headers: { Authorization: `Bearer ${tokenStore.access}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  }

  return (
    <div>
      <PageHeader title="Invoices" action={canCreate && <Button onClick={() => setOpen(!open)}>+ New Invoice</Button>} />
      {open && canCreate && (
        <Card className="mb-5">
          <CardTitle>New Invoice</CardTitle>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-3">
            <div><Label>Client ID</Label><Input type="number" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} /></div>
            <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div><Label>Due Date</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
            {err && <p className="text-sm text-rose-600 sm:col-span-3">{err}</p>}
            <div className="sm:col-span-3"><Button type="submit">Create</Button></div>
          </form>
        </Card>
      )}
      {loading ? <p className="text-sm text-slate-400">Loading…</p> : (
        <Table head={['ID', 'Client', 'Amount', 'Status', 'Due', 'PDF']}>
          {data.map((i) => (
            <tr key={i.id}>
              <Td>{i.id}</Td><Td>{i.client?.name || '—'}</Td><Td>{i.amount}</Td><Td><StatusBadge status={i.status} /></Td>
              <Td>{i.dueDate ? i.dueDate.slice(0, 10) : '—'}</Td>
              <Td><Button variant="outline" className="px-3 py-1 text-xs" onClick={() => downloadPdf(i.id)}>PDF</Button></Td>
            </tr>
          ))}
          {data.length === 0 && <tr><Td className="text-slate-400">No invoices.</Td></tr>}
        </Table>
      )}
    </div>
  );
}
