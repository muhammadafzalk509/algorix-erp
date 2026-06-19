'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { TIER_LABEL } from '@/lib/permissions';
import { passwordError, PASSWORD_RULE } from '@/lib/password';
import { Button, Card, CardTitle, Input, Label, PageHeader } from '@/components/ui';

interface Me {
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl?: string | null;
}

type Msg = { type: 'ok' | 'err'; text: string } | null;

function Notice({ msg }: { msg: Msg }) {
  if (!msg) return null;
  return (
    <p className={msg.type === 'ok' ? 'text-sm text-emerald-600' : 'text-sm text-rose-600'}>
      {msg.text}
    </p>
  );
}

export default function SettingsPage() {
  const { user, updateUser, logout } = useAuth();

  // Profile (name + email)
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [profileMsg, setProfileMsg] = useState<Msg>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarMsg, setAvatarMsg] = useState<Msg>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Change password (knows current password)
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwMsg, setPwMsg] = useState<Msg>(null);
  const [pwBusy, setPwBusy] = useState(false);

  // Reset password (forgot current → email OTP)
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [resetPw, setResetPw] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetMsg, setResetMsg] = useState<Msg>(null);
  const [resetBusy, setResetBusy] = useState(false);

  useEffect(() => {
    api
      .get<Me>('/users/me')
      .then((m) => {
        setFirstName(m.firstName);
        setLastName(m.lastName);
        setEmail(m.email);
        setAvatarUrl(m.avatarUrl ?? null);
      })
      .catch(() => {});
  }, []);

  if (!user) return null;

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    if (!firstName.trim() || !lastName.trim())
      return setProfileMsg({ type: 'err', text: 'First and last name are required.' });
    setSavingProfile(true);
    try {
      const updated = await api.put<Me>(`/users/${user!.id}`, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim().toLowerCase(),
      });
      updateUser({
        firstName: updated.firstName,
        lastName: updated.lastName,
        email: updated.email,
      });
      setProfileMsg({ type: 'ok', text: 'Profile updated.' });
    } catch (err) {
      setProfileMsg({ type: 'err', text: (err as Error).message });
    } finally {
      setSavingProfile(false);
    }
  }

  async function onAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarMsg(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const updated = await api.upload<Me>('/users/me/avatar', form);
      setAvatarUrl(updated.avatarUrl ?? null);
      setAvatarMsg({ type: 'ok', text: 'Profile picture updated.' });
    } catch (err) {
      setAvatarMsg({ type: 'err', text: (err as Error).message });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    const pwErr = passwordError(next);
    if (pwErr) return setPwMsg({ type: 'err', text: pwErr });
    if (next !== confirm)
      return setPwMsg({ type: 'err', text: 'New password and confirmation do not match.' });
    setPwBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword: current, newPassword: next });
      setPwMsg({ type: 'ok', text: 'Password changed. Logging you out…' });
      setTimeout(() => logout(), 1200);
    } catch (err) {
      setPwMsg({ type: 'err', text: (err as Error).message });
    } finally {
      setPwBusy(false);
    }
  }

  async function sendResetCode() {
    setResetMsg(null);
    setResetBusy(true);
    try {
      await api.post('/auth/forgot-password', { email: user!.email });
      setOtpSent(true);
      setResetMsg({ type: 'ok', text: `We sent a 6-digit code to ${user!.email}.` });
    } catch (err) {
      setResetMsg({ type: 'err', text: (err as Error).message });
    } finally {
      setResetBusy(false);
    }
  }

  async function resetPassword(e: React.FormEvent) {
    e.preventDefault();
    setResetMsg(null);
    if (otp.trim().length !== 6)
      return setResetMsg({ type: 'err', text: 'Enter the 6-digit code from your email.' });
    const pwErr = passwordError(resetPw);
    if (pwErr) return setResetMsg({ type: 'err', text: pwErr });
    if (resetPw !== resetConfirm)
      return setResetMsg({ type: 'err', text: 'New password and confirmation do not match.' });
    setResetBusy(true);
    try {
      await api.post('/auth/reset-password', {
        email: user!.email,
        otp: otp.trim(),
        newPassword: resetPw,
      });
      setResetMsg({ type: 'ok', text: 'Password reset. Logging you out…' });
      setTimeout(() => logout(), 1200);
    } catch (err) {
      setResetMsg({ type: 'err', text: (err as Error).message });
    } finally {
      setResetBusy(false);
    }
  }

  const initials = `${firstName[0] ?? user.firstName[0] ?? ''}${
    lastName[0] ?? user.lastName[0] ?? ''
  }`.toUpperCase();

  return (
    <div>
      <PageHeader title="Settings" />
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Profile: avatar + editable name & email */}
        <Card>
          <CardTitle>Profile</CardTitle>
          <div className="mb-4 flex items-center gap-4">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Avatar" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-full bg-brand text-lg font-bold text-white">
                {initials}
              </div>
            )}
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={onAvatarPick}
                className="hidden"
              />
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? 'Uploading…' : 'Change picture'}
              </Button>
              <p className="mt-1 text-xs text-slate-400">PNG, JPG, WEBP, or GIF · max 2MB</p>
              <Notice msg={avatarMsg} />
            </div>
          </div>

          <form onSubmit={saveProfile} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>First name</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoComplete="given-name" />
              </div>
              <div>
                <Label>Last name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name" />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              <p className="mt-1 text-xs text-slate-400">This is your login email. You stay signed in after changing it.</p>
            </div>
            <Notice msg={profileMsg} />
            <Button type="submit" disabled={savingProfile}>
              {savingProfile ? 'Saving…' : 'Save changes'}
            </Button>
          </form>

          <dl className="mt-5 space-y-2 border-t border-slate-200 pt-4 text-sm dark:border-slate-700">
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Role</dt>
              <dd className="font-medium">{user.role}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Permission Tier</dt>
              <dd className="font-medium">{user.permissionTier} — {TIER_LABEL[user.permissionTier]}</dd>
            </div>
          </dl>
        </Card>

        <div className="space-y-5">
          {/* Change password (knows current password) */}
          <Card>
            <CardTitle>Change Password</CardTitle>
            <form onSubmit={changePassword} className="space-y-3">
              <div>
                <Label>Current password</Label>
                <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
              </div>
              <div>
                <Label>New password</Label>
                <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} required autoComplete="new-password" placeholder="New password" />
                <p className="mt-1 text-xs text-slate-400">{PASSWORD_RULE}</p>
              </div>
              <div>
                <Label>Confirm new password</Label>
                <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
              </div>
              <Notice msg={pwMsg} />
              <Button type="submit" disabled={pwBusy}>{pwBusy ? 'Saving…' : 'Update password'}</Button>
              <p className="text-xs text-slate-400">For security, you will be logged out after changing your password.</p>
            </form>
          </Card>

          {/* Reset password via email OTP (forgot current password) */}
          <Card>
            <CardTitle>Reset Password</CardTitle>
            <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
              Forgot your current password? We&apos;ll email a one-time code to{' '}
              <span className="font-medium">{user.email}</span> so you can set a new one.
            </p>
            {!otpSent ? (
              <div className="space-y-3">
                <Notice msg={resetMsg} />
                <Button variant="outline" onClick={sendResetCode} disabled={resetBusy}>
                  {resetBusy ? 'Sending…' : 'Email me a reset code'}
                </Button>
              </div>
            ) : (
              <form onSubmit={resetPassword} className="space-y-3">
                <div>
                  <Label>6-digit code</Label>
                  <Input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" maxLength={6} required placeholder="000000" />
                </div>
                <div>
                  <Label>New password</Label>
                  <Input type="password" value={resetPw} onChange={(e) => setResetPw(e.target.value)} required autoComplete="new-password" />
                  <p className="mt-1 text-xs text-slate-400">{PASSWORD_RULE}</p>
                </div>
                <div>
                  <Label>Confirm new password</Label>
                  <Input type="password" value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)} required autoComplete="new-password" />
                </div>
                <Notice msg={resetMsg} />
                <div className="flex items-center gap-2">
                  <Button type="submit" disabled={resetBusy}>{resetBusy ? 'Resetting…' : 'Reset password'}</Button>
                  <Button type="button" variant="outline" onClick={sendResetCode} disabled={resetBusy}>
                    Resend code
                  </Button>
                </div>
                <p className="text-xs text-slate-400">For security, you will be logged out after resetting your password.</p>
              </form>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
