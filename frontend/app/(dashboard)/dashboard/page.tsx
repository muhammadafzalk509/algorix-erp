'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button, Card, PageHeader, StatusBadge } from '@/components/ui';
import { TrendingUp } from 'lucide-react';

interface Stat {
  label: string;
  value: number | string;
  accent: string;
}

interface ProjectProgress {
  id: number;
  title: string;
  status: string;
  client: string | null;
  progress: number;
  lastUpdated: string | null;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stat[]>([]);
  const [progress, setProgress] = useState<ProjectProgress[]>([]);

  useEffect(() => {
    async function load() {
      const out: Stat[] = [];
      const safe = async (p: string) => {
        try {
          return (await api.get<unknown[]>(p)).length;
        } catch {
          return null;
        }
      };
      const projects = await safe('/projects');
      const tasks = await safe('/tasks');
      const clients = await safe('/clients');
      const logs = await safe('/task-logs');
      if (projects !== null) out.push({ label: 'Projects', value: projects, accent: 'text-brand' });
      if (tasks !== null) out.push({ label: 'Tasks', value: tasks, accent: 'text-emerald-600' });
      if (clients !== null) out.push({ label: 'Clients', value: clients, accent: 'text-sky-600' });
      if (logs !== null) out.push({ label: 'Work Logs', value: logs, accent: 'text-amber-600' });
      setStats(out);

      try {
        setProgress(await api.get<ProjectProgress[]>('/gantt/progress'));
      } catch {
        /* ignore */
      }
    }
    load();
  }, []);

  const avg = progress.length
    ? Math.round(progress.reduce((s, r) => s + r.progress, 0) / progress.length)
    : 0;

  return (
    <div>
      <PageHeader title="Dashboard" />
      <p className="mb-6 text-sm text-slate-500">
        Signed in as <b>{user?.firstName}</b>. Your view is scoped to your role.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <p className={`text-3xl font-extrabold ${s.accent}`}>{s.value}</p>
            <p className="mt-1 text-sm text-slate-500">{s.label}</p>
          </Card>
        ))}
        {stats.length === 0 && <p className="text-sm text-slate-400">Loading stats…</p>}
      </div>

      {/* Project progress — visible to everyone */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <TrendingUp size={16} className="text-brand" /> Project Progress
          </h2>
          <div className="flex items-center gap-3">
            {progress.length > 0 && (
              <span className="text-xs text-slate-500">Portfolio avg <b className="text-brand">{avg}%</b></span>
            )}
            <Link href="/progress">
              <Button variant="ghost" className="px-2 py-1 text-xs">View all</Button>
            </Link>
          </div>
        </div>

        {progress.length === 0 ? (
          <Card><p className="text-sm text-slate-400">No project progress yet. Add Gantt tasks under <Link href="/gantt" className="text-brand underline">Gantt Chart</Link>.</p></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {progress.slice(0, 6).map((r) => (
              <Card key={r.id}>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">{r.title}</h3>
                    <p className="text-xs text-slate-400">{r.client ?? 'No client'}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-slate-500">Progress</span>
                  <span className="font-bold text-brand">{r.progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${r.progress}%` }} />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
