'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useList } from '@/lib/useList';
import { Button, PageHeader, StatusBadge, Table, Td } from '@/components/ui';

interface Req {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  intro?: string;
  layer?: string | null;
  department?: string | null;
  occupation?: string | null;
  status: string;
}

export default function SignupRequestsPage() {
  const { data, loading, error, reload } = useList<Req>('/auth/signup-requests');
  const [msg, setMsg] = useState('');

  async function act(id: number, action: 'approve' | 'reject') {
    setMsg('');
    try {
      const r = await api.post<{ message: string }>(`/auth/signup-requests/${id}/${action}`, action === 'reject' ? { reviewNote: 'Not a fit' } : {});
      setMsg(r.message);
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  return (
    <div>
      <PageHeader title="Developer Signup Requests" />
      <p className="mb-4 text-sm text-slate-500">CEO / CTO. Approve to auto-create a Developer account (max 5).</p>
      {msg && <p className="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-700">{msg}</p>}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <Table head={['Name', 'Email', 'Requested', 'Phone', 'Intro', 'Status', 'Actions']}>
          {data.map((r) => (
            <tr key={r.id}>
              <Td>{r.firstName} {r.lastName}</Td>
              <Td>{r.email}</Td>
              <Td>{r.department ? `${r.department}${r.occupation ? ` · ${r.occupation}` : ''}${r.layer ? ` (${r.layer})` : ''}` : (r.occupation || '—')}</Td>
              <Td>{r.phone || '—'}</Td>
              <Td className="max-w-xs">{r.intro || '—'}</Td>
              <Td><StatusBadge status={r.status} /></Td>
              <Td>
                {r.status === 'PENDING' ? (
                  <div className="flex gap-2">
                    <Button variant="success" className="px-3 py-1 text-xs" onClick={() => act(r.id, 'approve')}>Approve</Button>
                    <Button variant="danger" className="px-3 py-1 text-xs" onClick={() => act(r.id, 'reject')}>Reject</Button>
                  </div>
                ) : <span className="text-xs text-slate-400">—</span>}
              </Td>
            </tr>
          ))}
          {data.length === 0 && <tr><Td className="text-slate-400">No requests.</Td></tr>}
        </Table>
      )}
    </div>
  );
}
