'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import {
  Button,
  Card,
  Input,
  Label,
  PageHeader,
  Select,
  StatusBadge,
} from '@/components/ui';
import { Download, Pencil, Plus, Save, Trash2 } from 'lucide-react';

type Scale = 'days' | 'weeks' | 'months';

interface GanttItem {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  progress: number;
  color?: string | null;
  orderIndex: number;
  status: string;
  statusColor?: string;
}

// Standardized status palette (matches backend STATUS_COLOR).
const STATUS_LEGEND: { label: string; color: string }[] = [
  { label: 'Completed', color: '#16a34a' },
  { label: 'In progress', color: '#eab308' },
  { label: 'Delayed', color: '#dc2626' },
  { label: 'Planned', color: '#2563eb' },
];
interface Chart {
  project: { id: number; title: string; status: string };
  progress: number;
  lastUpdated: string | null;
  items: GanttItem[];
}
interface ProjectLite { id: number; title: string }

const DAY = 86400000;
const d10 = (s: string | Date) => new Date(s).toISOString().slice(0, 10);

export default function GanttPage() {
  const { user } = useAuth();
  const editor = can(user?.permissionTier, ['TIER_0', 'TIER_1', 'TIER_2']);

  const [projects, setProjects] = useState<ProjectLite[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);
  const [chart, setChart] = useState<Chart | null>(null);
  const [scale, setScale] = useState<Scale>('weeks');
  const [autoUpdate, setAutoUpdate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Partial<GanttItem>>({});
  const [adding, setAdding] = useState<{ name: string; startDate: string; endDate: string; progress: number }>({
    name: '', startDate: d10(new Date()), endDate: d10(new Date(Date.now() + 7 * DAY)), progress: 0,
  });
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [err, setErr] = useState('');

  // load project list
  useEffect(() => {
    api.get<ProjectLite[]>('/projects')
      .then((ps) => {
        setProjects(ps);
        if (ps.length && projectId === null) setProjectId(ps[0].id);
      })
      .catch((e) => setErr((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadChart = useCallback(async (pid: number) => {
    try {
      const c = await api.get<Chart>(`/gantt/${pid}`);
      setChart(c);
      setSavedAt(c.lastUpdated);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  useEffect(() => {
    if (projectId !== null) loadChart(projectId);
  }, [projectId, loadChart]);

  // ----- timeline geometry -----
  const span = useMemo(() => {
    const items = chart?.items ?? [];
    if (!items.length) return null;
    const min = Math.min(...items.map((i) => new Date(i.startDate).getTime()));
    const max = Math.max(...items.map((i) => new Date(i.endDate).getTime()));
    const total = Math.max(DAY, max - min);
    return { min, max, total };
  }, [chart]);

  const ticks = useMemo(() => {
    if (!span) return [];
    const out: { label: string; left: number }[] = [];
    const step = scale === 'days' ? DAY : scale === 'weeks' ? 7 * DAY : 30 * DAY;
    for (let t = span.min; t <= span.max + step; t += step) {
      const left = ((t - span.min) / span.total) * 100;
      if (left > 100.5) break;
      const dt = new Date(t);
      const label = scale === 'months'
        ? dt.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })
        : dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      out.push({ label, left: Math.min(left, 100) });
    }
    return out;
  }, [span, scale]);

  // ----- edit helpers -----
  function startEdit(it: GanttItem) {
    setEditingId(it.id);
    setDraft({ name: it.name, startDate: d10(it.startDate), endDate: d10(it.endDate), progress: it.progress });
  }

  const persist = useCallback(async (id: number, data: Partial<GanttItem>) => {
    setErr('');
    await api.put(`/gantt/items/${id}`, {
      name: data.name,
      startDate: data.startDate ? new Date(data.startDate as string).toISOString() : undefined,
      endDate: data.endDate ? new Date(data.endDate as string).toISOString() : undefined,
      progress: data.progress !== undefined ? Number(data.progress) : undefined,
    });
    setSavedAt(new Date().toISOString());
    if (projectId !== null) await loadChart(projectId);
  }, [projectId, loadChart]);

  async function saveEdit() {
    if (editingId === null) return;
    try {
      await persist(editingId, draft);
      setEditingId(null);
      setDraft({});
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  // auto-update: debounce-save the open draft while the toggle is on
  const debTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!autoUpdate || editingId === null) return;
    if (debTimer.current) clearTimeout(debTimer.current);
    debTimer.current = setTimeout(() => {
      persist(editingId, draft).catch((e) => setErr((e as Error).message));
    }, 900);
    return () => { if (debTimer.current) clearTimeout(debTimer.current); };
  }, [draft, autoUpdate, editingId, persist]);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (projectId === null) return;
    setErr('');
    try {
      await api.post(`/gantt/${projectId}/items`, {
        name: adding.name,
        startDate: new Date(adding.startDate).toISOString(),
        endDate: new Date(adding.endDate).toISOString(),
        progress: Number(adding.progress),
      });
      setAdding({ name: '', startDate: d10(new Date()), endDate: d10(new Date(Date.now() + 7 * DAY)), progress: 0 });
      setSavedAt(new Date().toISOString());
      await loadChart(projectId);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function removeItem(id: number) {
    if (!confirm('Delete this task?')) return;
    try {
      await api.del(`/gantt/items/${id}`);
      if (projectId !== null) await loadChart(projectId);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  function generateReport() {
    if (projectId === null) return;
    api.download(`/gantt/${projectId}/report`, `progress-report-project-${projectId}.pdf`)
      .catch((e) => setErr((e as Error).message));
  }

  return (
    <div>
      <PageHeader
        title="Gantt Chart"
        action={
          <Button variant="outline" onClick={generateReport} disabled={projectId === null}>
            <Download size={15} /> Generate Report
          </Button>
        }
      />

      {/* Controls */}
      <Card className="mb-5">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-56">
            <Label>Project</Label>
            <Select value={projectId ?? ''} onChange={(e) => setProjectId(Number(e.target.value))}>
              {projects.length === 0 && <option value="">No projects</option>}
              {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </Select>
          </div>
          <div>
            <Label>Timeline scale</Label>
            <div className="flex gap-1 rounded-lg border border-slate-200 p-0.5">
              {(['days', 'weeks', 'months'] as Scale[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setScale(s)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize ${scale === s ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          {editor && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={autoUpdate} onChange={(e) => setAutoUpdate(e.target.checked)} className="h-4 w-4 accent-[#1f4e79]" />
              Auto-update (save while editing)
            </label>
          )}
          <div className="ml-auto text-right text-xs text-slate-400">
            {savedAt ? <>Last updated<br /><span className="font-medium text-slate-600">{new Date(savedAt).toLocaleString()}</span></> : 'Not yet saved'}
          </div>
        </div>
      </Card>

      {err && <p className="mb-4 text-sm text-rose-600">{err}</p>}

      {chart && (
        <>
          {/* Overall progress */}
          <Card className="mb-5">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-semibold text-slate-800">{chart.project.title}</h3>
                <StatusBadge status={chart.project.status} />
              </div>
              <span className="text-sm font-bold text-brand">{chart.progress}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${chart.progress}%` }} />
            </div>
          </Card>

          {/* Visual Gantt */}
          <Card className="mb-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Timeline</h3>
              <div className="flex gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                {STATUS_LEGEND.map((l) => (
                  <span key={l.label} className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: l.color }} />
                    {l.label}
                  </span>
                ))}
              </div>
            </div>
            {chart.items.length === 0 ? (
              <p className="text-sm text-slate-400">No tasks yet. Add one below to see the timeline.</p>
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[640px]">
                  {/* tick header */}
                  <div className="relative ml-44 h-5 border-b border-slate-200">
                    {ticks.map((t, i) => (
                      <span key={i} className="absolute -translate-x-1/2 text-[10px] text-slate-400" style={{ left: `${t.left}%` }}>{t.label}</span>
                    ))}
                  </div>
                  {/* bars */}
                  <div className="mt-2 space-y-2">
                    {chart.items.map((it) => {
                      const left = span ? ((new Date(it.startDate).getTime() - span.min) / span.total) * 100 : 0;
                      const width = span ? Math.max(2, ((new Date(it.endDate).getTime() - new Date(it.startDate).getTime()) / span.total) * 100) : 100;
                      return (
                        <div key={it.id} className="flex items-center">
                          <div className="w-44 shrink-0 truncate pr-2 text-xs text-slate-600" title={it.name}>{it.name}</div>
                          <div className="relative h-6 flex-1 rounded bg-slate-50">
                            <div className="absolute top-0 h-6 rounded bg-slate-300/40" style={{ left: `${left}%`, width: `${width}%` }}>
                              <div className="h-6 rounded" style={{ width: `${it.progress}%`, backgroundColor: it.color || it.statusColor || '#1f4e79' }} />
                              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white">{it.progress}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Editable table */}
          <Card>
            <h3 className="mb-4 text-sm font-semibold text-slate-800">Tasks / Phases {editor ? '(editable)' : '(read-only)'}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-2 py-2">Name</th>
                    <th className="px-2 py-2">Start</th>
                    <th className="px-2 py-2">End</th>
                    <th className="px-2 py-2">Progress</th>
                    <th className="px-2 py-2">Status</th>
                    {editor && <th className="px-2 py-2 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {chart.items.map((it) => {
                    const editing = editingId === it.id;
                    return (
                      <tr key={it.id}>
                        <td className="px-2 py-2">
                          {editing ? <Input value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /> : it.name}
                        </td>
                        <td className="px-2 py-2">
                          {editing ? <Input type="date" value={(draft.startDate as string) ?? ''} onChange={(e) => setDraft({ ...draft, startDate: e.target.value })} /> : d10(it.startDate)}
                        </td>
                        <td className="px-2 py-2">
                          {editing ? <Input type="date" value={(draft.endDate as string) ?? ''} onChange={(e) => setDraft({ ...draft, endDate: e.target.value })} /> : d10(it.endDate)}
                        </td>
                        <td className="px-2 py-2">
                          {editing ? (
                            <Input type="number" min={0} max={100} value={draft.progress ?? 0} onChange={(e) => setDraft({ ...draft, progress: Number(e.target.value) })} className="w-20" />
                          ) : `${it.progress}%`}
                        </td>
                        <td className="px-2 py-2"><StatusBadge status={it.status.replace('_', ' ')} /></td>
                        {editor && (
                          <td className="px-2 py-2">
                            <div className="flex justify-end gap-1">
                              {editing ? (
                                <Button variant="success" className="px-2 py-1" onClick={saveEdit}><Save size={14} /> Save</Button>
                              ) : (
                                <Button variant="outline" className="px-2 py-1" onClick={() => startEdit(it)}><Pencil size={14} /> Edit</Button>
                              )}
                              <Button variant="danger" className="px-2 py-1" onClick={() => removeItem(it.id)}><Trash2 size={14} /></Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {editor && (
              <form onSubmit={addItem} className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
                <div className="grow"><Label>New task name</Label><Input value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} required placeholder="e.g. Design phase" /></div>
                <div><Label>Start</Label><Input type="date" value={adding.startDate} onChange={(e) => setAdding({ ...adding, startDate: e.target.value })} required /></div>
                <div><Label>End</Label><Input type="date" value={adding.endDate} onChange={(e) => setAdding({ ...adding, endDate: e.target.value })} required /></div>
                <div><Label>Progress %</Label><Input type="number" min={0} max={100} value={adding.progress} onChange={(e) => setAdding({ ...adding, progress: Number(e.target.value) })} className="w-24" /></div>
                <Button type="submit"><Plus size={15} /> Add Task</Button>
              </form>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
