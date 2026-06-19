'use client';

import { Fragment, useState, type ReactNode } from 'react';
import { api } from '@/lib/api';
import { useList } from '@/lib/useList';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { Button, Card, CardTitle, Input, Label, PageHeader, Select, StatusBadge, Table, Td, Textarea } from '@/components/ui';

interface Task {
  id: number;
  title: string;
  status: string;
  priority: string;
  dueDate?: string | null;
  submittedAt?: string | null;
  submissionNote?: string | null;
  reviewFeedback?: string | null;
  reviewedAt?: string | null;
  project?: { title: string };
  assignee?: { id: number; firstName: string; lastName: string } | null;
}
interface Project { id: number; title: string; }
interface UserLite { id: number; firstName: string; lastName: string; role: { name: string; permissionTier: string }; }

const STATUSES = ['TODO', 'IN_PROGRESS', 'REVIEW', 'TESTING', 'DONE'];
// Tasks are assigned down the dev chain: Head of Developer + Developers.
const ASSIGNABLE_TIERS = ['TIER_3', 'TIER_5'];

const fmt = (iso: string) =>
  new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });

export default function TasksPage() {
  const { user } = useAuth();
  const { data, loading, reload } = useList<Task>('/tasks');
  const [projects, setProjects] = useState<Project[]>([]);
  const [assignees, setAssignees] = useState<UserLite[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ projectId: '', title: '', assignedTo: '', dueDate: '' });
  const [err, setErr] = useState('');
  const canCreate = can(user?.permissionTier, ['TIER_0', 'TIER_1', 'TIER_2', 'TIER_3', 'TIER_4']);
  // CEO / CTO / VP + department heads can review submissions and leave feedback.
  const canReview = can(user?.permissionTier, ['TIER_0', 'TIER_1', 'TIER_2', 'TIER_3', 'TIER_4']);
  // Only CEO / CTO / VP / Head of Development may change a task's status.
  const canSetStatus =
    can(user?.permissionTier, ['TIER_0', 'TIER_1', 'TIER_2']) || user?.role === 'Head of Developer';

  // Inline "submit task" form (one open at a time).
  const [submitId, setSubmitId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitErr, setSubmitErr] = useState('');

  // Inline "review" form (one open at a time).
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewErr, setReviewErr] = useState('');

  async function toggle() {
    if (!open) {
      try { setProjects(await api.get<Project[]>('/projects')); } catch { /* ignore */ }
      try {
        const users = await api.get<UserLite[]>('/users');
        setAssignees(users.filter((u) => ASSIGNABLE_TIERS.includes(u.role.permissionTier)));
      } catch { /* ignore */ }
    }
    setOpen(!open);
  }
  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await api.post('/tasks', {
        projectId: Number(form.projectId),
        title: form.title,
        assignedTo: form.assignedTo ? Number(form.assignedTo) : undefined,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : undefined,
      });
      setForm({ projectId: '', title: '', assignedTo: '', dueDate: '' });
      setOpen(false);
      reload();
    } catch (e) { setErr((e as Error).message); }
  }
  async function setStatus(id: number, status: string) {
    try { await api.patch(`/tasks/${id}/status`, { status }); reload(); } catch (e) { alert((e as Error).message); }
  }

  function openSubmit(t: Task) {
    setReviewId(null);
    setSubmitId(t.id);
    setNote(t.submissionNote ?? '');
    setSubmitErr('');
  }
  async function doSubmit(id: number) {
    setSubmitBusy(true);
    setSubmitErr('');
    try {
      await api.patch(`/tasks/${id}/submit`, { note: note.trim() || undefined });
      setSubmitId(null);
      setNote('');
      reload();
    } catch (e) {
      setSubmitErr((e as Error).message);
    } finally {
      setSubmitBusy(false);
    }
  }

  function openReview(t: Task) {
    setSubmitId(null);
    setReviewId(t.id);
    setFeedback(t.reviewFeedback ?? '');
    setReviewErr('');
  }
  // Save feedback; optionally approve (DONE) or send back (IN_PROGRESS).
  async function doReview(id: number, status?: string) {
    setReviewBusy(true);
    setReviewErr('');
    try {
      await api.patch(`/tasks/${id}/review`, { feedback: feedback.trim() || undefined, status });
      setReviewId(null);
      setFeedback('');
      reload();
    } catch (e) {
      setReviewErr((e as Error).message);
    } finally {
      setReviewBusy(false);
    }
  }

  function dueLabel(t: Task) {
    if (!t.dueDate) return <span className="text-slate-400">—</span>;
    const due = new Date(t.dueDate);
    const overdue = t.status !== 'DONE' && due.getTime() < Date.now();
    return <span className={overdue ? 'font-semibold text-rose-600' : 'text-slate-600'}>{fmt(t.dueDate)}{overdue ? ' · overdue' : ''}</span>;
  }

  // Submission state per row: ✓ submitted · Submit button · or closed/pending,
  // plus a Review button for reviewers and the feedback (readable by everyone).
  function submissionCell(t: Task) {
    const mine = !!user && t.assignee?.id === user.id;
    const pastDue = !!t.dueDate && new Date(t.dueDate).getTime() < Date.now();

    let statusEl: ReactNode;
    if (t.submittedAt)
      statusEl = <span className="text-emerald-600" title={t.submissionNote ?? ''}>✓ Submitted · {fmt(t.submittedAt)}</span>;
    else if (mine && !pastDue && t.status !== 'DONE')
      statusEl = <Button variant="outline" className="py-1 text-xs" onClick={() => openSubmit(t)}>Submit</Button>;
    else if (pastDue)
      statusEl = <span className="font-medium text-rose-600">Closed · deadline passed</span>;
    else
      statusEl = <span className="text-slate-400">Not submitted</span>;

    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {statusEl}
          {canReview && (
            <Button
              variant={t.submittedAt && !t.reviewFeedback ? 'primary' : 'outline'}
              className="py-1 text-xs"
              onClick={() => openReview(t)}
            >
              {t.reviewFeedback ? '✎ Edit feedback' : '📝 Review / Feedback'}
            </Button>
          )}
        </div>
        {t.submittedAt && !t.reviewFeedback && canReview && (
          <p className="text-xs font-medium text-amber-600">Awaiting your review</p>
        )}
        {t.reviewFeedback && (
          <p className="text-xs text-slate-500 dark:text-slate-400">💬 {t.reviewFeedback}</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Tasks" action={canCreate && <Button onClick={toggle}>+ Assign Task</Button>} />
      {open && canCreate && (
        <Card className="mb-5">
          <CardTitle>Assign Task</CardTitle>
          <form onSubmit={create} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><Label>Project</Label>
              <Select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} required>
                <option value="">Select…</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </Select>
            </div>
            <div><Label>Task name</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="e.g. Build login API" /></div>
            <div><Label>Assign to</Label>
              <Select value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>
                <option value="">Unassigned…</option>
                {assignees.map((u) => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName} — {u.role.name}</option>
                ))}
              </Select>
            </div>
            <div><Label>Deadline (date &amp; time)</Label><Input type="datetime-local" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></div>
            {assignees.length === 0 && <p className="text-xs text-slate-400 sm:col-span-2 lg:col-span-4">No Developers or Head of Developers found yet — create them under Users first.</p>}
            {err && <p className="text-sm text-rose-600 sm:col-span-2 lg:col-span-4">{err}</p>}
            <div className="sm:col-span-2 lg:col-span-4"><Button type="submit">Assign</Button></div>
          </form>
        </Card>
      )}
      {loading ? <p className="text-sm text-slate-400">Loading…</p> : (
        <Table head={['ID', 'Title', 'Project', 'Assignee', 'Deadline', 'Priority', 'Status', 'Submission']}>
          {data.map((t) => (
            <Fragment key={t.id}>
              <tr>
                <Td>{t.id}</Td><Td>{t.title}</Td><Td>{t.project?.title || '—'}</Td>
                <Td>{t.assignee ? `${t.assignee.firstName} ${t.assignee.lastName}` : '—'}</Td>
                <Td>{dueLabel(t)}</Td>
                <Td><StatusBadge status={t.priority} /></Td>
                <Td>
                  {canSetStatus ? (
                    <Select value={t.status} onChange={(e) => setStatus(t.id, e.target.value)} className="w-36 py-1 text-xs">
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </Select>
                  ) : (
                    <StatusBadge status={t.status} />
                  )}
                </Td>
                <Td>{submissionCell(t)}</Td>
              </tr>
              {submitId === t.id && (
                <tr>
                  <td colSpan={8} className="bg-slate-50 px-4 py-3 dark:bg-slate-800/50">
                    <div className="space-y-2">
                      <Label>Submission note (optional)</Label>
                      <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Link to PR, summary of what you did, etc." />
                      {submitErr && <p className="text-sm text-rose-600">{submitErr}</p>}
                      <div className="flex gap-2">
                        <Button onClick={() => doSubmit(t.id)} disabled={submitBusy}>{submitBusy ? 'Submitting…' : 'Confirm submit'}</Button>
                        <Button variant="outline" onClick={() => { setSubmitId(null); setSubmitErr(''); }} disabled={submitBusy}>Cancel</Button>
                      </div>
                      <p className="text-xs text-slate-400">Once the deadline passes, this task can no longer be submitted on the portal.</p>
                    </div>
                  </td>
                </tr>
              )}
              {reviewId === t.id && (
                <tr>
                  <td colSpan={8} className="bg-indigo-50/60 px-4 py-3 dark:bg-slate-800/50">
                    <div className="space-y-2">
                      <div className="text-sm">
                        <span className="font-medium">Submission: </span>
                        {t.submittedAt ? (
                          <span>submitted {fmt(t.submittedAt)}{t.submissionNote ? ` — “${t.submissionNote}”` : ' (no note)'}</span>
                        ) : (
                          <span className="text-slate-400">not submitted yet</span>
                        )}
                      </div>
                      <Label>Feedback for the assignee</Label>
                      <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} placeholder="What's good, what needs changing…" />
                      {reviewErr && <p className="text-sm text-rose-600">{reviewErr}</p>}
                      <div className="flex flex-wrap gap-2">
                        <Button onClick={() => doReview(t.id)} disabled={reviewBusy}>{reviewBusy ? 'Saving…' : 'Save feedback'}</Button>
                        <Button variant="success" onClick={() => doReview(t.id, 'DONE')} disabled={reviewBusy}>Approve (Done)</Button>
                        <Button variant="outline" onClick={() => doReview(t.id, 'IN_PROGRESS')} disabled={reviewBusy}>Request changes</Button>
                        <Button variant="ghost" onClick={() => { setReviewId(null); setReviewErr(''); }} disabled={reviewBusy}>Cancel</Button>
                      </div>
                      <p className="text-xs text-slate-400">The assignee is notified and can read your feedback on this task.</p>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
          {data.length === 0 && <tr><Td className="text-slate-400">No tasks.</Td></tr>}
        </Table>
      )}
    </div>
  );
}
