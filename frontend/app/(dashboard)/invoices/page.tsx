'use client';

import { useEffect, useState } from 'react';
import { api, API_BASE, tokenStore } from '@/lib/api';
import { useList } from '@/lib/useList';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import {
  Button, Card, CardTitle, ConfirmDialog, Input, Label, Modal, PageHeader, Select, StatusBadge, Table, Td,
} from '@/components/ui';
import { toast } from '@/components/toast';

interface Invoice { id: number; amount: string; status: string; clientId?: number; client?: { name: string }; dueDate?: string; }
interface Client { id: number; name: string; }

const STATUSES = ['PENDING', 'PAID', 'OVERDUE'];

export default function InvoicesPage() {
  const { user } = useAuth();
  const { data, loading, reload } = useList<Invoice>('/invoices');
  const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ clientId: '', amount: '', dueDate: '' });
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState<Invoice | null>(null);
  const [editForm, setEditForm] = useState({ clientId: '', amount: '', dueDate: '', status: 'PENDING' });
  const [deleting, setDeleting] = useState<Invoice | null>(null);
  const setEF = (k: string, v: string) => setEditForm((f) => ({ ...f, [k]: v }));

  const canManage = can(user?.permissionTier, ['TIER_0', 'TIER_1']);

  useEffect(() => { api.get<Client[]>('/clients').then(setClients).catch(() => {}); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/invoices', {
        clientId: Number(form.clientId),
        amount: Number(form.amount),
        dueDate: form.dueDate || undefined,
      });
      toast.success('Invoice created.');
      setForm({ clientId: '', amount: '', dueDate: '' }); setOpen(false); reload();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  function startEdit(i: Invoice) {
    setEditing(i);
    setEditForm({
      clientId: String(i.clientId ?? ''),
      amount: String(i.amount ?? ''),
      dueDate: i.dueDate ? i.dueDate.slice(0, 10) : '',
      status: i.status || 'PENDING',
    });
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    try {
      await api.put(`/invoices/${editing.id}`, {
        clientId: editForm.clientId ? Number(editForm.clientId) : undefined,
        amount: editForm.amount ? Number(editForm.amount) : undefined,
        status: editForm.status,
        dueDate: editForm.dueDate || null,
      });
      toast.success('Invoice updated.');
      setEditing(null); reload();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try { await api.del(`/invoices/${deleting.id}`); toast.success('Invoice deleted.'); setDeleting(null); reload(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  async function downloadPdf(id: number) {
    const res = await fetch(`${API_BASE}/invoices/${id}/pdf`, { headers: { Authorization: `Bearer ${tokenStore.access}` } });
    const blob = await res.blob();
    window.open(URL.createObjectURL(blob), '_blank');
  }

  return (
    <div>
      <PageHeader title="Invoices" action={canManage && <Button onClick={() => setOpen(!open)}>+ New Invoice</Button>} />
      {open && canManage && (
        <Card className="mb-5">
          <CardTitle>New Invoice</CardTitle>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-3">
            <div><Label>Client</Label>
              <Select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required>
                <option value="">Select client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required /></div>
            <div><Label>Due Date</Label><Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
            <div className="sm:col-span-3"><Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create'}</Button></div>
          </form>
        </Card>
      )}
      {loading ? <p className="text-sm text-slate-400">Loading…</p> : (
        <Table head={['ID', 'Client', 'Amount', 'Status', 'Due', 'Actions']}>
          {data.map((i) => (
            <tr key={i.id}>
              <Td>{i.id}</Td><Td>{i.client?.name || '—'}</Td><Td>{i.amount}</Td><Td><StatusBadge status={i.status} /></Td>
              <Td>{i.dueDate ? i.dueDate.slice(0, 10) : '—'}</Td>
              <Td>
                <div className="flex flex-wrap gap-1.5">
                  <Button variant="outline" className="px-2.5 py-1 text-xs" onClick={() => downloadPdf(i.id)}>PDF</Button>
                  {canManage && <Button variant="outline" className="px-2.5 py-1 text-xs" onClick={() => startEdit(i)}>Edit</Button>}
                  {canManage && <Button variant="danger" className="px-2.5 py-1 text-xs" onClick={() => setDeleting(i)}>Delete</Button>}
                </div>
              </Td>
            </tr>
          ))}
          {data.length === 0 && <tr><Td className="text-slate-400">No invoices.</Td></tr>}
        </Table>
      )}

      {/* Edit modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Edit invoice #${editing?.id}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button>
            <Button onClick={saveEdit} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div><Label>Client</Label>
            <Select value={editForm.clientId} onChange={(e) => setEF('clientId', e.target.value)}>
              <option value="">— unchanged —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Amount</Label><Input type="number" value={editForm.amount} onChange={(e) => setEF('amount', e.target.value)} /></div>
            <div><Label>Status</Label><Select value={editForm.status} onChange={(e) => setEF('status', e.target.value)}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
          </div>
          <div><Label>Due Date</Label><Input type="date" value={editForm.dueDate} onChange={(e) => setEF('dueDate', e.target.value)} /></div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting}
        title="Delete invoice"
        message={`Delete invoice #${deleting?.id} (${deleting?.client?.name || '—'}, ${deleting?.amount})? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
