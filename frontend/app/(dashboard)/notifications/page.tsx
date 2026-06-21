'use client';

import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api, tokenStore } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import {
  Button,
  Card,
  CardTitle,
  ConfirmDialog,
  Input,
  Label,
  Modal,
  PageHeader,
  Select,
  Textarea,
} from '@/components/ui';
import { toast } from '@/components/toast';
import { Pencil, Trash2 } from 'lucide-react';

interface Notif {
  id: number; title: string; message: string; isRead: boolean; createdAt: string;
  senderRole?: string | null; category?: string | null;
}

const WS = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

// Which broadcast audiences each tier may send (backend enforces too).
const AUDIENCES_BY_TIER: Record<string, { value: string; label: string }[]> = {
  TIER_0: [
    { value: 'GLOBAL', label: 'Global (everyone)' },
    { value: 'TECHNICAL', label: 'Technical staff' },
    { value: 'TEAM', label: 'Engineering team' },
    { value: 'DEV', label: 'Developers & QA' },
  ],
  TIER_1: [
    { value: 'GLOBAL', label: 'Global (everyone)' },
    { value: 'TECHNICAL', label: 'Technical staff' },
    { value: 'TEAM', label: 'Engineering team' },
    { value: 'DEV', label: 'Developers & QA' },
  ],
  TIER_2: [
    { value: 'TEAM', label: 'Engineering team' },
    { value: 'DEV', label: 'Developers & QA' },
  ],
  TIER_3: [{ value: 'DEV', label: 'Developers & QA' }],
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const canManage = can(user?.permissionTier, ['TIER_0', 'TIER_1', 'TIER_2']);
  const [items, setItems] = useState<Notif[]>([]);
  const [audience, setAudience] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  // edit / delete state
  const [editing, setEditing] = useState<Notif | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editMessage, setEditMessage] = useState('');
  const [deleting, setDeleting] = useState<Notif | null>(null);
  const [busy, setBusy] = useState(false);

  const audiences = user ? AUDIENCES_BY_TIER[user.permissionTier] ?? [] : [];

  async function load() {
    try { setItems(await api.get<Notif[]>('/notifications')); } catch { /* ignore */ }
  }

  useEffect(() => {
    load();
    const socket: Socket = io(`${WS}/ws`, { auth: { token: tokenStore.access } });
    socket.on('notification', (n: Notif) => setItems((prev) => [n, ...prev]));
    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => {
    if (audiences.length && !audience) setAudience(audiences[0].value);
  }, [audiences, audience]);

  async function markAll() {
    await api.post('/notifications/mark-all-read');
    toast.success('All notifications marked read.');
    load();
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await api.post<{ delivered: number }>('/notifications/broadcast', { audience, title, message });
      toast.success(`Broadcast sent to ${res.delivered} recipient(s).`);
      setTitle(''); setMessage('');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  function openEdit(n: Notif) {
    setEditing(n);
    setEditTitle(n.title);
    setEditMessage(n.message);
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    try {
      await api.patch(`/notifications/${editing.id}`, { title: editTitle, message: editMessage });
      setItems((cur) => cur.map((x) => (x.id === editing.id ? { ...x, title: editTitle, message: editMessage } : x)));
      toast.success('Notification updated.');
      setEditing(null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.del(`/notifications/${deleting.id}`);
      setItems((cur) => cur.filter((x) => x.id !== deleting.id));
      toast.success('Notification deleted.');
      setDeleting(null);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader title="Notifications" action={<Button variant="outline" onClick={markAll}>Mark all read</Button>} />

      {audiences.length > 0 && (
        <Card className="mb-5">
          <CardTitle>Send Broadcast</CardTitle>
          <form onSubmit={send} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Audience</Label>
                <Select value={audience} onChange={(e) => setAudience(e.target.value)}>
                  {audiences.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </Select>
              </div>
              <div>
                <Label>Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
            </div>
            <div>
              <Label>Message</Label>
              <Input value={message} onChange={(e) => setMessage(e.target.value)} required />
            </div>
            <Button type="submit">Send</Button>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        {items.map((n) => (
          <Card key={n.id} className={n.isRead ? 'opacity-60' : ''}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 dark:text-slate-100">{n.title}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{n.message}</p>
                {(n.senderRole || n.category) && (
                  <p className="mt-1 text-xs text-slate-400">
                    {n.senderRole ? `From ${n.senderRole}` : 'System'}
                    {n.category ? ` · ${n.category}` : ''}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {!n.isRead && <span className="h-2 w-2 rounded-full bg-brand" />}
                {canManage && (
                  <>
                    <button
                      onClick={() => openEdit(n)}
                      title="Edit"
                      className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand dark:hover:bg-slate-700"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setDeleting(n)}
                      title="Delete"
                      className="rounded-md p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950"
                    >
                      <Trash2 size={15} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
        {items.length === 0 && <p className="text-sm text-slate-400">No notifications.</p>}
      </div>

      {/* Edit modal */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Edit notification"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={busy}>Cancel</Button>
            <Button onClick={saveEdit} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div><Label>Title</Label><Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} /></div>
          <div><Label>Message</Label><Textarea rows={3} value={editMessage} onChange={(e) => setEditMessage(e.target.value)} /></div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!deleting}
        title="Delete notification"
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
