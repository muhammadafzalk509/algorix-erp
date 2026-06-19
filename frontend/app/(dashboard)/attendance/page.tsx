'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Button,
  Card,
  CardTitle,
  Input,
  Label,
  PageHeader,
  Select,
  StatusBadge,
  Table,
  Td,
} from '@/components/ui';

interface Session {
  id: number; date: string; status: string; durationMin: number;
  loginAt: string; lastSeenAt: string; markedBy?: number | null;
}
interface ReportRow { userId: number; name: string; presentDays: number; totalDays: number }
interface Report { scope: string; from: string; to: string; summary: ReportRow[] }

// Department heads (TIER_3/4) see their own department (scoped server-side);
// CEO/CTO/VPE (0/1/2) and HR (7) see all departments.
const isManager = (t: string) => ['TIER_0', 'TIER_1', 'TIER_2', 'TIER_3', 'TIER_4', 'TIER_7'].includes(t);
// CEO/CTO/VPE/HR hold ATTENDANCE_MANAGE and may post corrections.
const canOverride = (t: string) => ['TIER_0', 'TIER_1', 'TIER_2', 'TIER_7'].includes(t);

export default function AttendancePage() {
  const { user } = useAuth();
  const [mine, setMine] = useState<Session[]>([]);
  const [scope, setScope] = useState('weekly');
  const [report, setReport] = useState<Report | null>(null);
  const [ov, setOv] = useState({ userId: '', date: '', status: 'PRESENT' });
  const [msg, setMsg] = useState('');

  const loadReport = useCallback((s: string) => {
    api.get<Report>(`/attendance/report?scope=${s}`).then(setReport).catch(() => {});
  }, []);

  useEffect(() => {
    api.get<Session[]>('/attendance/me').then(setMine).catch(() => {});
  }, []);
  useEffect(() => {
    if (user && isManager(user.permissionTier)) loadReport(scope);
  }, [user, scope, loadReport]);

  if (!user) return null;

  async function submitOverride(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      await api.post('/attendance/override', {
        userId: Number(ov.userId),
        date: ov.date,
        status: ov.status,
      });
      setMsg('Attendance overridden.');
      loadReport(scope);
    } catch (err) {
      setMsg((err as Error).message);
    }
  }

  return (
    <div>
      <PageHeader title="Attendance" />

      <Card className="mb-5">
        <CardTitle>My Attendance</CardTitle>
        <Table head={['Date', 'Status', 'Duration (min)', 'First seen', 'Last seen']}>
          {mine.map((s) => (
            <tr key={s.id}>
              <Td>{s.date.slice(0, 10)}</Td>
              <Td><StatusBadge status={s.status} /></Td>
              <Td>{s.durationMin}</Td>
              <Td>{new Date(s.loginAt).toLocaleTimeString()}</Td>
              <Td>{new Date(s.lastSeenAt).toLocaleTimeString()}</Td>
            </tr>
          ))}
          {mine.length === 0 && <tr><Td className="text-slate-400">No sessions yet today — stay active for 20 minutes to be marked present.</Td></tr>}
        </Table>
      </Card>

      {isManager(user.permissionTier) && (
        <Card className="mb-5">
          <div className="mb-3 flex items-center justify-between">
            <CardTitle>Team Report</CardTitle>
            <div className="w-40">
              <Select value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </Select>
            </div>
          </div>
          {report && (
            <p className="mb-2 text-xs text-slate-400">{report.from} → {report.to}</p>
          )}
          <Table head={['Employee', 'Present Days', 'Total Days', 'Rate']}>
            {report?.summary.map((r) => (
              <tr key={r.userId}>
                <Td>{r.name}</Td>
                <Td>{r.presentDays}</Td>
                <Td>{r.totalDays}</Td>
                <Td>{r.totalDays ? Math.round((r.presentDays / r.totalDays) * 100) : 0}%</Td>
              </tr>
            ))}
            {(!report || report.summary.length === 0) && <tr><Td className="text-slate-400">No attendance data in range.</Td></tr>}
          </Table>
        </Card>
      )}

      {canOverride(user.permissionTier) && (
        <Card>
          <CardTitle>Attendance Correction</CardTitle>
          <p className="mb-3 text-xs text-slate-400">Update or correct an attendance record (CEO / CTO / VP Engineering / HR).</p>
          <form onSubmit={submitOverride} className="flex flex-wrap items-end gap-3">
            <div><Label>Employee ID</Label><Input value={ov.userId} onChange={(e) => setOv({ ...ov, userId: e.target.value })} required className="w-28" /></div>
            <div><Label>Date</Label><Input type="date" value={ov.date} onChange={(e) => setOv({ ...ov, date: e.target.value })} required /></div>
            <div>
              <Label>Status</Label>
              <Select value={ov.status} onChange={(e) => setOv({ ...ov, status: e.target.value })}>
                <option value="PRESENT">Present</option>
                <option value="ABSENT">Absent</option>
                <option value="MANUAL">Manual (present)</option>
              </Select>
            </div>
            <Button type="submit">Apply</Button>
            {msg && <span className="text-sm text-brand">{msg}</span>}
          </form>
        </Card>
      )}
    </div>
  );
}
