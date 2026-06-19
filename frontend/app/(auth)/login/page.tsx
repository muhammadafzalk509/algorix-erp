'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { Button, Input, Label, Select } from '@/components/ui';
import { GoogleSignInButton } from '@/components/GoogleSignInButton';
import { LAYERS, DEPARTMENTS_BY_LAYER, type Layer } from '@/lib/permissions';

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();

  // Step 1 — pick the layer / department.
  const [layer, setLayer] = useState<Layer | ''>('');
  const [department, setDepartment] = useState('');
  const [picked, setPicked] = useState(false);

  // Step 2 — credentials.
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const departments = layer ? DEPARTMENTS_BY_LAYER[layer] : [];
  const canContinue = !!layer && !!department;

  function proceed(e: React.FormEvent) {
    e.preventDefault();
    if (!canContinue) return;
    setPicked(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email, password, department);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const handleGoogle = useCallback(
    async (idToken: string) => {
      setError('');
      setBusy(true);
      try {
        await loginWithGoogle(idToken, department);
      } catch (err) {
        setError((err as Error).message);
        setBusy(false);
      }
    },
    [loginWithGoogle, department],
  );

  // ---- Step 1: layer / department selection ----
  if (!picked) {
    return (
      <form onSubmit={proceed} className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Sign in</h2>
        <p className="text-xs text-slate-500">Select your layer and department to continue.</p>
        <div>
          <Label>Layer</Label>
          <Select
            value={layer}
            onChange={(e) => {
              const l = e.target.value as Layer | '';
              setLayer(l);
              // auto-pick the only department for single-department layers
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
        <div className="flex justify-between text-sm">
          <Link href="/forgot-password" className="text-brand hover:underline">Forgot password?</Link>
          <Link href="/request-signup" className="text-brand hover:underline">Request account</Link>
        </div>
      </form>
    );
  }

  // ---- Step 2: credentials ----
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Sign in</h2>
        <button type="button" onClick={() => setPicked(false)} className="text-xs text-brand hover:underline">Change</button>
      </div>
      <p className="rounded-lg bg-brand/10 px-3 py-2 text-xs font-medium text-brand">{layer} · {department}</p>
      <div>
        <Label>Email</Label>
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
      </div>
      <div>
        <Label>Password</Label>
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
      </div>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </Button>

      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        or
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <GoogleSignInButton onCredential={handleGoogle} onError={setError} />

      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="text-brand hover:underline">Forgot password?</Link>
        <Link href="/request-signup" className="text-brand hover:underline">Request account</Link>
      </div>
    </form>
  );
}
