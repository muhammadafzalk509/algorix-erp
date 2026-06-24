'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useList } from '@/lib/useList';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import {
  Button, Card, CardTitle, ConfirmDialog, Input, Label, Modal, PageHeader, Select, StatusBadge, Table, Td,
} from '@/components/ui';
import { toast } from '@/components/toast';

interface Project { id: number; title: string; status: string; budget?: string; clientId?: number; client?: { name: string }; }
interface Client { id: number; name: string; }

const STATUSES = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];

export default function ProjectsPage() {
  const { user } = useAuth();
  const { data, loading, reload } = useList<Project>('/projects');
  const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ clientId: '', title: '', budget: '' });
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState<Project | null>(null);
  const [editForm, setEditForm] = useState({ clientId: '', title: '', budget: '', status: 'PLANNING' });
  const [deleting, setDeleting] = useState<Project | null>(null);
  const setEF = (k: string, v: string) => setEditForm((f) => ({ ...f, [k]: v }));

  const canCreate = can(user?.permissionTier, ['TIER_0', 'TIER_1', 'TIER_2']);
  const canEdit = can(user?.permissionTier, ['TIER_0', 'TIER_1', 'TIER_2']);
  const canDelete = can(user?.permissionTier, ['TIER_0', 'TIER_1']);
  const showActions = canEdit || canDelete;

  useEffect(() => { if (canEdit) api.get<Client[]>('/clients').then(setClients).catch(() => {}); }, [canEdit]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/projects', {
        clientId: Number(form.clientId),
        title: form.title,
        budget: form.budget ? Number(form.budget) : undefined,
      });
      toast.success('Project created.');
      setForm({ clientId: '', title: '', budget: '' }); setOpen(false); reload();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  function startEdit(p: Project) {
    setEditing(p);
    setEditForm({ clientId: String(p.clientId ?? ''), title: p.title, budget: p.budget ? String(p.budget) : '', status: p.status || 'PLANNING' });
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    try {
      await api.put(`/projects/${editing.id}`, {
        title: editForm.title,
        status: editForm.status,
        clientId: editForm.clientId ? Number(editForm.clientId) : undefined,
        budget: editForm.budget ? Number(editForm.budget) : undefined,
      });
      toast.success('Project updated.');
      setEditing(null); reload();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try { await api.del(`/projects/${deleting.id}`); toast.success('Project deleted.'); setDeleting(null); reload(); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader title="Projects" action={canCreate && <Button onClick={() => setOpen(!open)}>+ New Project</Button>} />
      {open && canCreate && (
        <Card className="mb-5">
          <CardTitle>New Project</CardTitle>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
            <div><Label>Client</Label>
              <Select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required>
                <option value="">Select client…</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
            <div><Label>Budget</Label><Input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} /></div>
            <div className="sm:col-span-2"><Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create'}</Button></div>
          </form>
        </Card>
      )}
      {loading ? <p className="text-sm text-slate-400">Loading…</p> : (
        <Table head={['ID', 'Title', 'Client', 'Budget', 'Status', ...(showActions ? ['Actions'] : [])]}>
          {data.map((p) => (
            <tr key={p.id}>
              <Td>{p.id}</Td><Td>{p.title}</Td><Td>{p.client?.name || '—'}</Td><Td>{p.budget || '—'}</Td><Td><StatusBadge status={p.status} /></Td>
              {showActions && (
                <Td>
                  <div className="flex flex-wrap gap-1.5">
                    {canEdit && <Button variant="outline" className="px-2.5 py-1 text-xs" onClick={() => startEdit(p)}>Edit</Button>}
                    {canDelete && <Button variant="danger" className="px-2.5 py-1 text-xs" onClick={() => setDeleting(p)}>Delete</Button>}
                  </div>
                </Td>
              )}
            </tr>
          ))}
          {data.length === 0 && <tr><Td className="text-slate-400">No projects.</Td></tr>}
        </Table>
      )}

      {/* Edit modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={`Edit project #${editing?.id}`}
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button>
            <Button onClick={saveEdit} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={editForm.title} onChange={(e) => setEF('title', e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Client</Label>
              <Select value={editForm.clientId} onChange={(e) => setEF('clientId', e.target.value)}>
                <option value="">— unchanged —</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div><Label>Status</Label><Select value={editForm.status} onChange={(e) => setEF('status', e.target.value)}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div>
          </div>
          <div><Label>Budget</Label><Input type="number" value={editForm.budget} onChange={(e) => setEF('budget', e.target.value)} /></div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting}
        title="Delete project"
        message={`Delete "${deleting?.title}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        busy={busy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
