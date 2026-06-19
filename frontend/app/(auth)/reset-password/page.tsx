'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { passwordError, PASSWORD_RULE } from '@/lib/password';
import { Button, Input, Label } from '@/components/ui';

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get('email') || '');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const pwErr = passwordError(newPassword);
    if (pwErr) return setError(pwErr);
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { email, otp, newPassword });
      router.push('/login');
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Reset Password</h2>
      <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div><Label>OTP (6 digits)</Label><Input value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={6} /></div>
      <div>
        <Label>New Password</Label>
        <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        <p className="mt-1 text-xs text-slate-400">{PASSWORD_RULE}</p>
      </div>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Updating…' : 'Reset Password'}</Button>
      <div className="text-center"><Link href="/login" className="text-sm text-brand hover:underline">Back to login</Link></div>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-center text-slate-400">Loading…</div>}>
      <ResetForm />
    </Suspense>
  );
}
