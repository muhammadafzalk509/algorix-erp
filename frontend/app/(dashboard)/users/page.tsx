'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useList } from '@/lib/useList';
import { useAuth } from '@/lib/auth';
import { can, UNDELETABLE_ROLES } from '@/lib/permissions';
import { Button, Card, CardTitle, Input, Label, PageHeader, StatusBadge, Table, Td } from '@/components/ui';

interface U {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  designation?: string | null;
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
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', designation: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  function startEdit(u: U) {
    setErr(''); setMsg('');
    setEditing(u);
    setForm({ firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone ?? '', designation: u.designation ?? '' });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setErr(''); setMsg('');
    try {
      await api.put(`/users/${editing.id}`, {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || undefined,
        designation: form.designation || undefined,
      });
      setMsg('User updated.');
      setEditing(null);
      reload();
    } catch (e) { setErr((e as Error).message); }
  }

  async function remove(u: U) {
    if (!confirm(`Delete ${u.firstName} ${u.lastName} (${u.email})? This cannot be undone.`)) return;
    setErr(''); setMsg('');
    try { await api.del(`/users/${u.id}`); setMsg('User deleted.'); reload(); }
    catch (e) { setErr((e as Error).message); }
  }

  async function toggle(u: U) {
    const status = u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try { await api.patch(`/users/${u.id}/status`, { status }); reload(); }
    catch (e) { alert((e as Error).message); }
  }

  const showActions = canManage || canAdmin;

  return (
    <div>
      <PageHeader title="Users" />
      <p className="-mt-2 mb-4 text-sm text-slate-500">
        {seesAll ? 'All company users across every department.' : 'Members of your own department.'}
      </p>
      {msg && <p className="mb-3 text-sm text-emerald-600">{msg}</p>}
      {err && <p className="mb-3 text-sm text-rose-600">{err}</p>}

      {editing && canAdmin && (
        <Card className="mb-5">
          <CardTitle>Edit User #{editing.id}</CardTitle>
          <form onSubmit={save} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div><Label>First Name</Label><Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required /></div>
            <div><Label>Last Name</Label><Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required /></div>
            <div><Label>Email (login identifier)</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>Designation</Label><Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
            <div className="flex items-end gap-2">
              <Button type="submit">Save</Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? <p className="text-sm text-slate-400">Loading…</p> : (
        <Table head={['ID', 'Name', 'Email', 'Role', 'Status', ...(showActions ? ['Actions'] : [])]}>
          {data.map((u) => (
            <tr key={u.id}>
              <Td>{u.id}</Td><Td>{u.firstName} {u.lastName}</Td><Td>{u.email}</Td>
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
                      <Button variant="danger" className="px-2.5 py-1 text-xs" onClick={() => remove(u)}>Delete</Button>
                    )}
                    {UNDELETABLE_ROLES.includes(u.role?.name) && <span className="text-xs text-slate-400">protected</span>}
                  </div>
                </Td>
              )}
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
