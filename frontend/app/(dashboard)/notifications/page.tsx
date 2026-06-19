'use client';

import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api, tokenStore } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, Card, CardTitle, Input, Label, PageHeader, Select } from '@/components/ui';

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
  const [items, setItems] = useState<Notif[]>([]);
  const [audience, setAudience] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [msg, setMsg] = useState('');

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
    load();
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      const res = await api.post<{ delivered: number }>('/notifications/broadcast', { audience, title, message });
      setMsg(`Sent to ${res.delivered} recipient(s).`);
      setTitle(''); setMessage('');
    } catch (err) {
      setMsg((err as Error).message);
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
            <div className="flex items-center gap-3">
              <Button type="submit">Send</Button>
              {msg && <span className="text-sm text-brand">{msg}</span>}
            </div>
          </form>
        </Card>
      )}

      <div className="space-y-3">
        {items.map((n) => (
          <Card key={n.id} className={n.isRead ? 'opacity-60' : ''}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100">{n.title}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{n.message}</p>
                {(n.senderRole || n.category) && (
                  <p className="mt-1 text-xs text-slate-400">
                    {n.senderRole ? `From ${n.senderRole}` : 'System'}
                    {n.category ? ` · ${n.category}` : ''}
                  </p>
                )}
              </div>
              {!n.isRead && <span className="h-2 w-2 rounded-full bg-brand" />}
            </div>
          </Card>
        ))}
        {items.length === 0 && <p className="text-sm text-slate-400">No notifications.</p>}
      </div>
    </div>
  );
}
