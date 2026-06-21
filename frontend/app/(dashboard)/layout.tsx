'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { navSectionsForTier, layerOfTier, TIER_LABEL } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Toaster } from '@/components/toast';
import { LogOut } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  // Attendance heartbeat: ping on mount, then every 3 minutes while signed in.
  useEffect(() => {
    if (!user) return;
    const ping = () => api.post('/attendance/ping').catch(() => {});
    ping();
    const id = setInterval(ping, 3 * 60 * 1000);
    return () => clearInterval(id);
  }, [user]);

  // Unread-notification count → pulsing banner badge on the Notifications nav item.
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!user) return;
    const refresh = () =>
      api
        .get<{ isRead: boolean }[]>('/notifications')
        .then((list) => setUnread(list.filter((n) => !n.isRead).length))
        .catch(() => {});
    refresh();
    const id = setInterval(refresh, 60 * 1000);
    return () => clearInterval(id);
  }, [user, pathname]);

  if (loading || !user)
    return <div className="grid min-h-screen place-items-center text-slate-400">Loading…</div>;

  const sections = navSectionsForTier(user.permissionTier);
  const layer = layerOfTier(user.permissionTier);

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden w-60 flex-col border-r border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 md:flex">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-sm font-extrabold text-white">AX</div>
            <span className="font-bold tracking-wide text-slate-800 dark:text-slate-100">ALGORIX</span>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            <span className="font-semibold text-slate-500 dark:text-slate-300">{layer}</span> layer · {TIER_LABEL[user.permissionTier]}
          </p>
        </div>
        <nav className="flex-1 space-y-3 overflow-y-auto p-3">
          {sections.map((group) => (
            <div key={group.section}>
              <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{group.section}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  const badge = item.href === '/notifications' ? unread : 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                        active
                          ? 'bg-brand text-white'
                          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700',
                      )}
                    >
                      <Icon size={17} />
                      <span className="flex-1">{item.label}</span>
                      {badge > 0 && (
                        <span className="animate-pulse-ring grid h-5 min-w-[20px] place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                          {badge > 9 ? '9+' : badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Welcome, <span className="font-semibold text-slate-800 dark:text-slate-100">{user.firstName} {user.lastName}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand">
              {TIER_LABEL[user.permissionTier]}
            </span>
            <ThemeToggle />
            <button onClick={logout} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-rose-600 dark:text-slate-400">
              <LogOut size={16} /> Logout
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
