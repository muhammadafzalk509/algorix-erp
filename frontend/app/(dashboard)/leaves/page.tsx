'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useList } from '@/lib/useList';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { Button, Card, CardTitle, Input, Label, PageHeader, Select, StatusBadge, Table, Td } from '@/components/ui';

interface Leave { id: number; type: string; startDate: string; endDate: string; status: string; reason?: string; user?: { firstName: string; lastName: string }; }

export default function LeavesPage() {
  const { user } = useAuth();
  const { data, loading, reload } = useList<Leave>('/leaves');
  const [form, setForm] = useState({ type: 'ANNUAL', startDate: '', endDate: '', reason: '' });
  const [err, setErr] = useState('');
  const canApprove = can(user?.permissionTier, ['TIER_1', 'TIER_2', 'TIER_3']);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try { await api.post('/leaves', form); setForm({ type: 'ANNUAL', startDate: '', endDate: '', reason: '' }); reload(); }
    catch (e) { setErr((e as Error).message); }
  }
  async function decide(id: number, action: 'approve' | 'reject') {
    try { await api.patch(`/leaves/${id}/${action}`); reload(); } catch (e) { alert((e as Error).message); }
  }

  return (
    <div>
      <PageHeader title="Leaves" />
      <Card className="mb-5">
        <CardTitle>Apply for Leave</CardTitle>
        <form onSubmit={create} className="grid gap-3 sm:grid-cols-4">
          <div><Label>Type</Label>
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="ANNUAL">Annual</option><option value="SICK">Sick</option><option value="CASUAL">Casual</option>
            </Select>
          </div>
          <div><Label>Start</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></div>
          <div><Label>End</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
          <div><Label>Reason</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          {err && <p className="text-sm text-rose-600 sm:col-span-4">{err}</p>}
          <div className="sm:col-span-4"><Button type="submit">Submit</Button></div>
        </form>
      </Card>
      {loading ? <p className="text-sm text-slate-400">Loading…</p> : (
        <Table head={['ID', 'Employee', 'Type', 'From', 'To', 'Status', ...(canApprove ? ['Actions'] : [])]}>
          {data.map((l) => (
            <tr key={l.id}>
              <Td>{l.id}</Td><Td>{l.user ? `${l.user.firstName} ${l.user.lastName}` : 'You'}</Td>
              <Td>{l.type}</Td><Td>{l.startDate?.slice(0, 10)}</Td><Td>{l.endDate?.slice(0, 10)}</Td>
              <Td><StatusBadge status={l.status} /></Td>
              {canApprove && (
                <Td>{l.status === 'PENDING' ? (
                  <div className="flex gap-2">
                    <Button variant="success" className="px-2 py-1 text-xs" onClick={() => decide(l.id, 'approve')}>Approve</Button>
                    <Button variant="danger" className="px-2 py-1 text-xs" onClick={() => decide(l.id, 'reject')}>Reject</Button>
                  </div>
                ) : <span className="text-xs text-slate-400">—</span>}</Td>
              )}
            </tr>
          ))}
          {data.length === 0 && <tr><Td className="text-slate-400">No leaves.</Td></tr>}
        </Table>
      )}
    </div>
  );
}
