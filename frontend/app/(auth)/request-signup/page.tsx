'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button, Input, Label, Select, Textarea } from '@/components/ui';
import { LAYERS, DEPARTMENTS_BY_LAYER, type Layer } from '@/lib/permissions';

export default function RequestSignupPage() {
  // Step 1 — layer / department.
  const [layer, setLayer] = useState<Layer | ''>('');
  const [department, setDepartment] = useState('');
  const [picked, setPicked] = useState(false);

  // Step 2 — applicant details.
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', occupation: '', intro: '', password: '', confirm: '' });
  const [done, setDone] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Min 8 chars with an uppercase, lowercase and a number (matches the server policy).
  const STRONG = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  const pwStrong = STRONG.test(form.password);
  const pwMatch = form.password.length > 0 && form.password === form.confirm;

  const departments = layer ? DEPARTMENTS_BY_LAYER[layer] : [];
  const canContinue = !!layer && !!department;

  function proceed(e: React.FormEvent) {
    e.preventDefault();
    if (canContinue) setPicked(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!pwStrong) { setError('Password must be at least 8 characters with an uppercase letter, a lowercase letter, and a number.'); return; }
    if (!pwMatch) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const { confirm, ...payload } = form;
      void confirm;
      const r = await api.post<{ message: string }>('/auth/request-signup', { ...payload, layer, department });
      setDone(r.message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done)
    return (
      <div className="space-y-3 text-center">
        <p className="text-emerald-600">✓ {done}</p>
        <Link href="/login" className="text-sm text-brand hover:underline">Back to login</Link>
      </div>
    );

  // ---- Step 1: layer / department ----
  if (!picked)
    return (
      <form onSubmit={proceed} className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">Request an account</h2>
        <p className="text-xs text-slate-500">Choose the layer and department you are applying to. The CTO will review your request.</p>
        <div>
          <Label>Layer</Label>
          <Select
            value={layer}
            onChange={(e) => {
              const l = e.target.value as Layer | '';
              setLayer(l);
              const deps = l ? DEPARTMENTS_BY_LAYER[l as Layer] : [];
              setDepartment(deps.length === 1 ? deps[0] : '');
            }}
          >
            <option value="">Select layer…</option>
            {LAYERS.map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>
        </div>
        {layer && departments.length > 1 && (
          <div>
            <Label>Department</Label>
            <Select value={department} onChange={(e) => setDepartment(e.target.value)}>
              <option value="">Select department…</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </Select>
          </div>
        )}
        <Button type="submit" className="w-full" disabled={!canContinue}>Continue</Button>
        <div className="text-center"><Link href="/login" className="text-sm text-brand hover:underline">Back to login</Link></div>
      </form>
    );

  // ---- Step 2: applicant details ----
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Signup Request</h2>
        <button type="button" onClick={() => setPicked(false)} className="text-xs text-brand hover:underline">Change</button>
      </div>
      <p className="rounded-lg bg-brand/10 px-3 py-2 text-xs font-medium text-brand">{layer} · {department}</p>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>First Name</Label><Input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} /></div>
        <div><Label>Last Name</Label><Input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} /></div>
      </div>
      <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => set('phone', e.target.value)} /></div>
        <div><Label>Occupation</Label><Input value={form.occupation} onChange={(e) => set('occupation', e.target.value)} placeholder="e.g. Backend Developer" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Password</Label>
          <Input type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="••••••••" />
        </div>
        <div>
          <Label>Confirm Password</Label>
          <Input type="password" value={form.confirm} onChange={(e) => set('confirm', e.target.value)} placeholder="••••••••" />
        </div>
      </div>
      {form.password.length > 0 && (
        <p className={`text-xs ${pwStrong ? 'text-emerald-600' : 'text-slate-500'}`}>
          {pwStrong ? '✓ Strong password' : 'Min 8 chars with an uppercase, lowercase, and a number.'}
          {form.confirm.length > 0 && !pwMatch && <span className="text-rose-600"> · Passwords do not match</span>}
        </p>
      )}
      <div><Label>Intro</Label><Textarea rows={3} value={form.intro} onChange={(e) => set('intro', e.target.value)} /></div>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy || !pwStrong || !pwMatch}>{busy ? 'Submitting…' : 'Submit Request'}</Button>
      <div className="text-center"><Link href="/login" className="text-sm text-brand hover:underline">Back to login</Link></div>
    </form>
  );
}
