'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, API_BASE, tokenStore } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import {
  Button, Card, CardTitle, Input, Label, PageHeader, Select, Table, Td,
} from '@/components/ui';
import { toast } from '@/components/toast';

interface Employee { id: number; firstName: string; lastName: string; email: string; employeeId?: string | null }
interface SalaryRecord { id: number; userId: number; baseSalary: string; currency: string; user: Employee }
interface PayrollEntry {
  id: number; periodStart: string; periodEnd: string; baseSalary: string;
  bonus: string; overtime: string; deductions: string; netPay: string; note?: string | null; user: Employee;
}
interface AuditRow { id: number; userId: number; field: string; oldValue: string; newValue: string; changedBy: number; createdAt: string }

const canViewPayroll = (t: string) => t === 'TIER_7';
const canAuditPayroll = (t: string) => t === 'TIER_0' || t === 'TIER_1';

const empLabel = (u: Employee) =>
  `${u.firstName} ${u.lastName} — #${u.id}${u.employeeId ? ` (${u.employeeId})` : ''}`;

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
  const [employees, setEmployees] = useState<Employee[]>([]);

  // set-salary form
  const [salUserId, setSalUserId] = useState('');
  const [salAmount, setSalAmount] = useState('');

  // create-entry form
  const [payType, setPayType] = useState<'SALARY' | 'DIRECT'>('SALARY');
  const [e, setE] = useState({ userId: '', periodStart: '', periodEnd: '', baseSalary: '', bonus: '', overtime: '', deductions: '', directAmount: '', note: '' });
  const setEF = (k: string, v: string) => setE((f) => ({ ...f, [k]: v }));

  const load = useCallback(() => {
    api.get<SalaryRecord[]>('/payroll/salaries').then(setSalaries).catch(() => {});
    api.get<PayrollEntry[]>('/payroll/entries').then(setEntries).catch(() => {});
    api.get<Employee[]>('/users').then(setEmployees).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function saveSalary(ev: React.FormEvent) {
    ev.preventDefault();
    try {
      await api.put(`/payroll/salaries/${Number(salUserId)}`, { baseSalary: Number(salAmount) });
      setSalUserId(''); setSalAmount(''); toast.success('Salary saved.'); load();
    } catch (err) { toast.error((err as Error).message); }
  }

  async function createEntry(ev: React.FormEvent) {
    ev.preventDefault();
    try {
      const isDirect = payType === 'DIRECT';
      await api.post('/payroll/entries', {
        userId: Number(e.userId),
        periodStart: e.periodStart,
        periodEnd: e.periodEnd,
        // Direct pay: the entered amount IS the net pay (no bonus/OT/deductions).
        baseSalary: isDirect ? Number(e.directAmount) : Number(e.baseSalary),
        bonus: !isDirect && e.bonus ? Number(e.bonus) : undefined,
        overtime: !isDirect && e.overtime ? Number(e.overtime) : undefined,
        deductions: !isDirect && e.deductions ? Number(e.deductions) : undefined,
        note: isDirect ? `Direct payment${e.note ? ` — ${e.note}` : ''}` : (e.note || undefined),
      });
      setE({ userId: '', periodStart: '', periodEnd: '', baseSalary: '', bonus: '', overtime: '', deductions: '', directAmount: '', note: '' });
      toast.success(isDirect ? 'Direct payment recorded.' : 'Pay entry created.');
      load();
    } catch (err) { toast.error((err as Error).message); }
  }

  function exportCsv() {
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

      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardTitle>Set Employee Base Salary</CardTitle>
          <form onSubmit={saveSalary} className="flex flex-wrap items-end gap-3">
            <div className="min-w-[16rem] flex-1">
              <Label>Employee</Label>
              <Select value={salUserId} onChange={(ev) => setSalUserId(ev.target.value)} required>
                <option value="">Select employee…</option>
                {employees.map((u) => <option key={u.id} value={u.id}>{empLabel(u)}</option>)}
              </Select>
            </div>
            <div><Label>Base salary</Label><Input type="number" value={salAmount} onChange={(ev) => setSalAmount(ev.target.value)} required className="w-40" /></div>
            <Button type="submit">Save</Button>
          </form>
          <p className="mt-2 text-xs text-slate-400">For salaried employees. Direct-payment staff can be paid below without a base salary.</p>
        </Card>

        <Card>
          <CardTitle>Create Pay Entry</CardTitle>
          <div className="mb-3 inline-flex rounded-lg border border-slate-200 p-0.5 text-xs dark:border-slate-700">
            {(['SALARY', 'DIRECT'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setPayType(t)}
                className={`rounded-md px-3 py-1.5 font-medium transition ${payType === t ? 'bg-brand text-white' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {t === 'SALARY' ? 'Salary-based' : 'Direct pay'}
              </button>
            ))}
          </div>
          <form onSubmit={createEntry} className="grid grid-cols-2 gap-2 text-sm">
            <div className="col-span-2">
              <Select value={e.userId} onChange={(ev) => setEF('userId', ev.target.value)} required>
                <option value="">Select employee…</option>
                {employees.map((u) => <option key={u.id} value={u.id}>{empLabel(u)}</option>)}
              </Select>
            </div>
            <Input type="date" value={e.periodStart} onChange={(ev) => setEF('periodStart', ev.target.value)} required />
            <Input type="date" value={e.periodEnd} onChange={(ev) => setEF('periodEnd', ev.target.value)} required />
            {payType === 'SALARY' ? (
              <>
                <Input type="number" placeholder="Base salary" value={e.baseSalary} onChange={(ev) => setEF('baseSalary', ev.target.value)} required />
                <Input type="number" placeholder="Bonus" value={e.bonus} onChange={(ev) => setEF('bonus', ev.target.value)} />
                <Input type="number" placeholder="Overtime" value={e.overtime} onChange={(ev) => setEF('overtime', ev.target.value)} />
                <Input type="number" placeholder="Deductions" value={e.deductions} onChange={(ev) => setEF('deductions', ev.target.value)} />
              </>
            ) : (
              <div className="col-span-2">
                <Input type="number" placeholder="Direct payment amount" value={e.directAmount} onChange={(ev) => setEF('directAmount', ev.target.value)} required />
              </div>
            )}
            <Input className="col-span-2" placeholder="Note (optional)" value={e.note} onChange={(ev) => setEF('note', ev.target.value)} />
            <div className="col-span-2"><Button type="submit">{payType === 'DIRECT' ? 'Record direct pay' : 'Add entry'}</Button></div>
          </form>
        </Card>
      </div>

      <CardTitle>Current Salaries</CardTitle>
      <div className="mb-6">
        <Table head={['Emp ID', 'Name', 'Base Salary', 'Currency']}>
          {salaries.map((s) => (
            <tr key={s.id}><Td>{s.userId}</Td><Td>{s.user?.firstName} {s.user?.lastName}</Td><Td>{s.baseSalary}</Td><Td>{s.currency}</Td></tr>
          ))}
          {salaries.length === 0 && <tr><Td className="text-slate-400">No salary records yet.</Td></tr>}
        </Table>
      </div>

      <CardTitle>Pay Entries</CardTitle>
      <Table head={['Name', 'Period', 'Base', 'Bonus', 'OT', 'Deduct', 'Net Pay', 'Note']}>
        {entries.map((r) => (
          <tr key={r.id}>
            <Td>{r.user?.firstName} {r.user?.lastName}</Td>
            <Td>{r.periodStart.slice(0, 10)} → {r.periodEnd.slice(0, 10)}</Td>
            <Td>{r.baseSalary}</Td><Td>{r.bonus}</Td><Td>{r.overtime}</Td><Td>{r.deductions}</Td>
            <Td className="font-semibold">{r.netPay}</Td>
            <Td className="text-xs text-slate-400">{r.note || '—'}</Td>
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
