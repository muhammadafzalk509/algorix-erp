'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useList } from '@/lib/useList';
import { useAuth } from '@/lib/auth';
import { can, UNDELETABLE_ROLES } from '@/lib/permissions';
import {
  Button, Card, CardTitle, ConfirmDialog, Input, Label, Modal, PageHeader, StatusBadge, Table, Td,
} from '@/components/ui';
import { toast } from '@/components/toast';

interface U {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  designation?: string | null;
  employeeId?: string | null;
  status: string;
  role: { name: string };
}

export default function UsersPage() {
  const { user } = useAuth();
  const { data, loading, reload } = useList<U>('/users');
  const canManage = can(user?.permissionTier, ['TIER_1']); // status toggle (CTO)
  const canAdmin = can(user?.permissionTier, ['TIER_0', 'TIER_1']); // edit / delete (CEO/CTO)
  const seesAll = can(user?.permissionTier, ['TIER_0', 'TIER_1', 'TIER_2']);

  const [editing, setEditing] = useState<U | null>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', designation: '', employeeId: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<U | null>(null);
  const [busy, setBusy] = useState(false);
  const setF = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function startEdit(u: U) {
    setEditing(u);
    setForm({
      firstName: u.firstName, lastName: u.lastName, email: u.email,
      phone: u.phone ?? '', designation: u.designation ?? '', employeeId: u.employeeId ?? '',
    });
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      await api.put(`/users/${editing.id}`, {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        designation: form.designation || undefined,
        employeeId: form.employeeId || undefined,
      });
      toast.success('User updated.');
      setEditing(null);
      reload();
    } catch (e) { toast.error((e as Error).message); } finally { setSaving(false); }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try { await api.del(`/users/${deleting.id}`); toast.success('User deleted.'); setDeleting(null); reload(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  async function toggle(u: U) {
    const status = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try { await api.patch(`/users/${u.id}/status`, { status }); toast.success(`User ${status === 'ACTIVE' ? 'activated' : 'deactivated'}.`); reload(); }
    catch (e) { toast.error((e as Error).message); }
  }

  const showActions = canManage || canAdmin;

  return (
    <div>
      <PageHeader title="Users" />
      <p className="-mt-2 mb-4 text-sm text-slate-500">
        {seesAll ? 'All company users across every department.' : 'Members of your own department.'}
      </p>

      {loading ? <p className="text-sm text-slate-400">Loading…</p> : (
        <Table head={['ID', 'Emp. ID', 'Name', 'Email', 'Role', 'Status', ...(showActions ? ['Actions'] : [])]}>
          {data.map((u) => (
            <tr key={u.id}>
              <Td>{u.id}</Td>
              <Td>{u.employeeId || '—'}</Td>
              <Td>{u.firstName} {u.lastName}</Td><Td>{u.email}</Td>
              <Td>{u.role?.name}</Td><Td><StatusBadge status={u.status} /></Td>
              {showActions && (
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    {canAdmin && <Button variant="outline" className="px-2.5 py-1 text-xs" onClick={() => startEdit(u)}>Edit</Button>}
                    {canManage && u.role?.name !== 'CEO' && (
                      <Button variant="outline" className="px-2.5 py-1 text-xs" onClick={() => toggle(u)}>
                        {u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </Button>
                    )}
                    {canAdmin && !UNDELETABLE_ROLES.includes(u.role?.name) && (
                      <Button variant="danger" className="px-2.5 py-1 text-xs" onClick={() => setDeleting(u)}>Delete</Button>
                    )}
                    {UNDELETABLE_ROLES.includes(u.role?.name) && <span className="text-xs text-slate-400">protected</span>}
                  </div>
                </Td>
              )}
            </tr>
          ))}
        </Table>
      )}

      {/* Edit modal */}
      <Modal
        open={!!editing && canAdmin}
        onClose={() => setEditing(null)}
        title={`Edit user #${editing?.id}`}
        wide
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>First Name</Label><Input value={form.firstName} onChange={(e) => setF('firstName', e.target.value)} /></div>
          <div><Label>Last Name</Label><Input value={form.lastName} onChange={(e) => setF('lastName', e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>Email (login identifier)</Label><Input type="email" value={form.email} onChange={(e) => setF('email', e.target.value)} /></div>
          <div><Label>Employee ID</Label><Input value={form.employeeId} onChange={(e) => setF('employeeId', e.target.value)} placeholder="e.g. ALX-0007" /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setF('phone', e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>Designation</Label><Input value={form.designation} onChange={(e) => setF('designation', e.target.value)} /></div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting}
        title="Delete user"
        message={`Delete ${deleting?.firstName} ${deleting?.lastName} (${deleting?.email})? This also removes their personal records and cannot be undone.`}
        confirmLabel="Delete"
        danger
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
