'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useList } from '@/lib/useList';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import {
  Button, Card, CardTitle, ConfirmDialog, Input, Label, Modal, PageHeader, Table, Td,
} from '@/components/ui';
import { toast } from '@/components/toast';

interface Client { id: number; name: string; companyName?: string; email: string; phone?: string; currency: string; }

const EMPTY = { name: '', email: '', companyName: '', phone: '' };

export default function ClientsPage() {
  const { user } = useAuth();
  const { data, loading, reload } = useList<Client>('/clients');
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState<Client | null>(null);
  const [editForm, setEditForm] = useState(EMPTY);
  const [deleting, setDeleting] = useState<Client | null>(null);

  const canCreate = can(user?.permissionTier, ['TIER_0', 'TIER_1', 'TIER_2']);
  const canEdit = can(user?.permissionTier, ['TIER_0', 'TIER_1', 'TIER_2']);
  const canDelete = can(user?.permissionTier, ['TIER_0', 'TIER_1']);
  const showActions = canEdit || canDelete;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/clients', form);
      toast.success('Client created.');
      setForm(EMPTY); setOpen(false); reload();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  function startEdit(c: Client) {
    setEditing(c);
    setEditForm({ name: c.name, email: c.email, companyName: c.companyName ?? '', phone: c.phone ?? '' });
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    try {
      await api.put(`/clients/${editing.id}`, editForm);
      toast.success('Client updated.');
      setEditing(null); reload();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.del(`/clients/${deleting.id}`);
      toast.success('Client deleted.');
      setDeleting(null); reload();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader title="Clients" action={canCreate && <Button onClick={() => setOpen(!open)}>+ New Client</Button>} />
      {open && canCreate && (
        <Card className="mb-5">
          <CardTitle>New Client</CardTitle>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <div><Label>Company</Label><Input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="sm:col-span-2"><Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create'}</Button></div>
          </form>
        </Card>
      )}

      {loading ? <p className="text-sm text-slate-400">Loading…</p> : (
        <Table head={['ID', 'Name', 'Company', 'Email', 'Phone', ...(showActions ? ['Actions'] : [])]}>
          {data.map((c) => (
            <tr key={c.id}>
              <Td>{c.id}</Td><Td>{c.name}</Td><Td>{c.companyName || '—'}</Td><Td>{c.email}</Td><Td>{c.phone || '—'}</Td>
              {showActions && (
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    {canEdit && <Button variant="outline" className="px-2.5 py-1 text-xs" onClick={() => startEdit(c)}>Edit</Button>}
                    {canDelete && <Button variant="danger" className="px-2.5 py-1 text-xs" onClick={() => setDeleting(c)}>Delete</Button>}
                  </div>
                </Td>
              )}
            </tr>
          ))}
          {data.length === 0 && <tr><Td className="text-slate-400">No clients.</Td></tr>}
        </Table>
      )}

      {/* Edit modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Edit client #${editing?.id}`}
        wide
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button>
            <Button onClick={saveEdit} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Name</Label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
          <div><Label>Email</Label><Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></div>
          <div><Label>Company</Label><Input value={editForm.companyName} onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting}
        title="Delete client"
        message={`Delete "${deleting?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
