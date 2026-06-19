'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button, Card, PageHeader, StatusBadge } from '@/components/ui';
import { Download, GanttChartSquare, Printer } from 'lucide-react';

interface ProjectProgress {
  id: number;
  title: string;
  status: string;
  client: string | null;
  startDate: string | null;
  endDate: string | null;
  items: number;
  progress: number;
  lastUpdated: string | null;
}

export default function ProgressPage() {
  const [rows, setRows] = useState<ProjectProgress[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<ProjectProgress[]>('/gantt/progress')
      .then(setRows)
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  function report(id: number) {
    api.download(`/gantt/${id}/report`, `progress-report-project-${id}.pdf`)
      .catch((e) => setErr((e as Error).message));
  }

  function printGantt(id: number) {
    api.download(`/gantt/${id}/chart`, `gantt-chart-project-${id}.pdf`)
      .catch((e) => setErr((e as Error).message));
  }

  const avg = rows.length ? Math.round(rows.reduce((s, r) => s + r.progress, 0) / rows.length) : 0;

  return (
    <div>
      <PageHeader title="Project Progress" />
      {err && <p className="mb-4 text-sm text-rose-600">{err}</p>}

      {!loading && rows.length > 0 && (
        <Card className="mb-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Portfolio average progress</p>
              <p className="text-3xl font-extrabold text-brand">{avg}%</p>
            </div>
            <p className="text-sm text-slate-400">{rows.length} project{rows.length > 1 ? 's' : ''}</p>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-brand" style={{ width: `${avg}%` }} />
          </div>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400">No projects to show.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((r) => (
            <Card key={r.id}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-800">{r.title}</h3>
                  <p className="text-xs text-slate-400">{r.client ?? 'No client'} · {r.items} task{r.items === 1 ? '' : 's'}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-slate-500">Progress</span>
                <span className="font-bold text-brand">{r.progress}%</span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${r.progress}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-400">
                {r.lastUpdated ? `Updated ${new Date(r.lastUpdated).toLocaleString()}` : 'Not updated yet'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link href="/gantt"><Button variant="outline" className="px-2.5 py-1.5"><GanttChartSquare size={15} /> Open Gantt</Button></Link>
                <Button variant="outline" className="px-2.5 py-1.5" onClick={() => printGantt(r.id)}><Printer size={15} /> Print Gantt</Button>
                <Button variant="ghost" className="px-2.5 py-1.5" onClick={() => report(r.id)}><Download size={15} /> Report</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
