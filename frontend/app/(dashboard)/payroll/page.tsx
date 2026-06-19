'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, API_BASE, tokenStore } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Button,
  Card,
  CardTitle,
  Input,
  Label,
  PageHeader,
  Table,
  Td,
} from '@/components/ui';

interface Employee { id: number; firstName: string; lastName: string; email: string }
interface SalaryRecord { id: number; userId: number; baseSalary: string; currency: string; user: Employee }
interface PayrollEntry {
  id: number; periodStart: string; periodEnd: string; baseSalary: string;
  bonus: string; overtime: string; deductions: string; netPay: string; user: Employee;
}
interface AuditRow { id: number; userId: number; field: string; oldValue: string; newValue: string; changedBy: number; createdAt: string }

// HR can view/edit payroll; CEO/CTO can only audit (matches backend capabilities).
const canViewPayroll = (t: string) => t === 'TIER_7';
const canAuditPayroll = (t: string) => t === 'TIER_0' || t === 'TIER_1';

export default function PayrollPage() {
  const { user } = useAuth();
  if (!user) return null;
  const tier = user.permissionTier;

  if (canViewPayroll(tier)) return <PayrollManager />;
  if (canAuditPayroll(tier)) return <PayrollAudit />;
  return (
    <div>
      <PageHeader title="Payroll" />
      <Card><p className="text-sm text-slate-500">You do not have access to payroll.</p></Card>
    </div>
  );
}

function PayrollManager() {
  const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [msg, setMsg] = useState<string>('');

  // set-salary form
  const [salUserId, setSalUserId] = useState('');
  const [salAmount, setSalAmount] = useState('');

  // create-entry form
  const [e, setE] = useState({ userId: '', periodStart: '', periodEnd: '', baseSalary: '', bonus: '', overtime: '', deductions: '', note: '' });

  const load = useCallback(() => {
    api.get<SalaryRecord[]>('/payroll/salaries').then(setSalaries).catch(() => {});
    api.get<PayrollEntry[]>('/payroll/entries').then(setEntries).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function saveSalary(ev: React.FormEvent) {
    ev.preventDefault();
    setMsg('');
    try {
      await api.put(`/payroll/salaries/${Number(salUserId)}`, { baseSalary: Number(salAmount) });
      setSalUserId(''); setSalAmount(''); setMsg('Salary saved.'); load();
    } catch (err) { setMsg((err as Error).message); }
  }

  async function createEntry(ev: React.FormEvent) {
    ev.preventDefault();
    setMsg('');
    try {
      await api.post('/payroll/entries', {
        userId: Number(e.userId),
        periodStart: e.periodStart,
        periodEnd: e.periodEnd,
        baseSalary: Number(e.baseSalary),
        bonus: e.bonus ? Number(e.bonus) : undefined,
        overtime: e.overtime ? Number(e.overtime) : undefined,
        deductions: e.deductions ? Number(e.deductions) : undefined,
        note: e.note || undefined,
      });
      setE({ userId: '', periodStart: '', periodEnd: '', baseSalary: '', bonus: '', overtime: '', deductions: '', note: '' });
      setMsg('Pay entry created.'); load();
    } catch (err) { setMsg((err as Error).message); }
  }

  function exportCsv() {
    // Stream via fetch with auth header, then trigger download.
    fetch(`${API_BASE}/payroll/export`, { headers: { Authorization: `Bearer ${tokenStore.access}` } })
      .then((r) => r.blob())
      .then((b) => {
        const url = URL.createObjectURL(b);
        const a = document.createElement('a');
        a.href = url; a.download = 'payroll.csv'; a.click();
        URL.revokeObjectURL(url);
      });
  }

  return (
    <div>
      <PageHeader title="Payroll" action={<Button variant="outline" onClick={exportCsv}>Export CSV</Button>} />
      {msg && <p className="mb-4 text-sm text-brand">{msg}</p>}

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle>Set Employee Salary</CardTitle>
          <form onSubmit={saveSalary} className="flex flex-wrap items-end gap-3">
            <div><Label>Employee ID</Label><Input value={salUserId} onChange={(ev) => setSalUserId(ev.target.value)} required className="w-32" /></div>
            <div><Label>Base salary</Label><Input type="number" value={salAmount} onChange={(ev) => setSalAmount(ev.target.value)} required className="w-40" /></div>
            <Button type="submit">Save</Button>
          </form>
        </Card>

        <Card>
          <CardTitle>Create Pay Entry</CardTitle>
          <form onSubmit={createEntry} className="grid grid-cols-2 gap-2 text-sm">
            <Input placeholder="Employee ID" value={e.userId} onChange={(ev) => setE({ ...e, userId: ev.target.value })} required />
            <Input type="number" placeholder="Base salary" value={e.baseSalary} onChange={(ev) => setE({ ...e, baseSalary: ev.target.value })} required />
            <Input type="date" value={e.periodStart} onChange={(ev) => setE({ ...e, periodStart: ev.target.value })} required />
            <Input type="date" value={e.periodEnd} onChange={(ev) => setE({ ...e, periodEnd: ev.target.value })} required />
            <Input type="number" placeholder="Bonus" value={e.bonus} onChange={(ev) => setE({ ...e, bonus: ev.target.value })} />
            <Input type="number" placeholder="Overtime" value={e.overtime} onChange={(ev) => setE({ ...e, overtime: ev.target.value })} />
            <Input type="number" placeholder="Deductions" value={e.deductions} onChange={(ev) => setE({ ...e, deductions: ev.target.value })} />
            <Button type="submit">Add entry</Button>
          </form>
        </Card>
      </div>

      <CardTitle>Current Salaries</CardTitle>
      <div className="mb-6">
        <Table head={['Emp ID', 'Name', 'Base Salary', 'Currency']}>
          {salaries.map((s) => (
            <tr key={s.id}><Td>{s.userId}</Td><Td>{s.user.firstName} {s.user.lastName}</Td><Td>{s.baseSalary}</Td><Td>{s.currency}</Td></tr>
          ))}
          {salaries.length === 0 && <tr><Td className="text-slate-400">No salary records yet.</Td></tr>}
        </Table>
      </div>

      <CardTitle>Pay Entries</CardTitle>
      <Table head={['Name', 'Period', 'Base', 'Bonus', 'OT', 'Deduct', 'Net Pay']}>
        {entries.map((r) => (
          <tr key={r.id}>
            <Td>{r.user.firstName} {r.user.lastName}</Td>
            <Td>{r.periodStart.slice(0, 10)} → {r.periodEnd.slice(0, 10)}</Td>
            <Td>{r.baseSalary}</Td><Td>{r.bonus}</Td><Td>{r.overtime}</Td><Td>{r.deductions}</Td>
            <Td className="font-semibold">{r.netPay}</Td>
          </tr>
        ))}
        {entries.length === 0 && <tr><Td className="text-slate-400">No pay entries yet.</Td></tr>}
      </Table>
    </div>
  );
}

function PayrollAudit() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  useEffect(() => { api.get<AuditRow[]>('/payroll/audit').then(setRows).catch(() => {}); }, []);
  return (
    <div>
      <PageHeader title="Payroll — Salary Change Audit" />
      <Table head={['When', 'Employee ID', 'Field', 'Old', 'New', 'Changed By']}>
        {rows.map((r) => (
          <tr key={r.id}>
            <Td>{new Date(r.createdAt).toLocaleString()}</Td>
            <Td>{r.userId}</Td><Td>{r.field}</Td><Td>{r.oldValue}</Td><Td>{r.newValue}</Td><Td>{r.changedBy}</Td>
          </tr>
        ))}
        {rows.length === 0 && <tr><Td className="text-slate-400">No salary changes recorded.</Td></tr>}
      </Table>
    </div>
  );
}
