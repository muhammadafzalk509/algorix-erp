'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button, Input, Label } from '@/components/ui';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setMsg('If the email exists, an OTP has been sent. Continue to reset.');
      setTimeout(() => router.push(`/reset-password?email=${encodeURIComponent(email)}`), 1200);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-800">Forgot Password</h2>
      <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      {msg && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-600">{msg}</p>}
      <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Sending…' : 'Send OTP'}</Button>
      <div className="text-center"><Link href="/login" className="text-sm text-brand hover:underline">Back to login</Link></div>
    </form>
  );
}
