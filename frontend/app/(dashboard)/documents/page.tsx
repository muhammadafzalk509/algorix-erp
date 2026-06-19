'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import {
  Button,
  Card,
  CardTitle,
  Input,
  Label,
  PageHeader,
  Select,
  Table,
  Td,
  Textarea,
} from '@/components/ui';

interface Doc {
  id: number;
  fileName: string;
  fileType: string;
  fileSize: number;
  version: number;
  fileUrl: string;
  title?: string | null;
  description?: string | null;
  projectId?: number | null;
  project?: { id: number; title: string } | null;
}
interface Project {
  id: number;
  title: string;
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const canManage = can(user?.permissionTier, ['TIER_0', 'TIER_1', 'TIER_4']);

  const [docs, setDocs] = useState<Doc[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProject, setFilterProject] = useState<string>('');

  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ projectId: '', title: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  // Inline editor state.
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '' });
  const [editBusy, setEditBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const qs = filterProject ? `?projectId=${filterProject}` : '';
      const d = await api.get<Doc[]>(`/documents${qs}`);
      setDocs(d);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    api
      .get<Project[]>('/projects')
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterProject]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMsg('Select a file first.');
      return;
    }
    const fd = new FormData();
    fd.append('file', file);
    if (form.projectId) fd.append('projectId', form.projectId);
    if (form.title) fd.append('title', form.title);
    if (form.description) fd.append('description', form.description);
    setBusy(true);
    try {
      await api.upload('/documents/upload', fd);
      setMsg('Uploaded & saved ✓');
      if (fileRef.current) fileRef.current.value = '';
      setForm({ projectId: '', title: '', description: '' });
      load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function startEdit(d: Doc) {
    setEditId(d.id);
    setEditForm({ title: d.title ?? '', description: d.description ?? '' });
  }

  async function saveEdit(id: number) {
    setEditBusy(true);
    try {
      await api.patch(`/documents/${id}`, editForm);
      setEditId(null);
      load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setEditBusy(false);
    }
  }

  async function remove(id: number) {
    if (!confirm('Delete this document? This cannot be undone.')) return;
    try {
      await api.del(`/documents/${id}`);
      load();
    } catch (e) {
      setMsg((e as Error).message);
    }
  }

  const head = canManage
    ? ['ID', 'Title / File', 'Project', 'Type', 'Size', 'Version', 'Link', 'Actions']
    : ['ID', 'Title / File', 'Project', 'Type', 'Size', 'Version', 'Link'];

  return (
    <div>
      <PageHeader title="Project Documentation" />

      <Card className="mb-5">
        <CardTitle>
          {canManage ? 'Upload Project Document' : 'Upload Document'}
        </CardTitle>
        <form onSubmit={upload} className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Project</Label>
            <Select
              value={form.projectId}
              onChange={(e) => setForm({ ...form, projectId: e.target.value })}
            >
              <option value="">— Unassigned —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Title</Label>
            <Input
              placeholder="Spec, SOW, design doc…"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Description</Label>
            <Textarea
              rows={2}
              placeholder="What this document is for, who requested it, etc."
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>
          <div className="sm:col-span-2">
            <Label>File</Label>
            <input
              ref={fileRef}
              type="file"
              className="text-sm"
              accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.zip"
            />
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={busy}>
              {busy ? 'Uploading…' : 'Upload & Save'}
            </Button>
            {msg && <span className="text-sm text-slate-600">{msg}</span>}
          </div>
        </form>
        <p className="mt-2 text-xs text-slate-400">
          Allowed: PDF, DOCX, XLSX, PNG, JPG, ZIP · Max 25MB · Stored on
          Cloudflare R2.
        </p>
      </Card>

      <Card className="mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <Label>Filter by project</Label>
          <Select
            className="max-w-xs"
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
          >
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <Table head={head}>
          {docs.map((d) => (
            <tr key={d.id}>
              <Td>{d.id}</Td>
              <Td>
                {editId === d.id ? (
                  <div className="space-y-2">
                    <Input
                      placeholder="Title"
                      value={editForm.title}
                      onChange={(e) =>
                        setEditForm({ ...editForm, title: e.target.value })
                      }
                    />
                    <Textarea
                      rows={2}
                      placeholder="Description"
                      value={editForm.description}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          description: e.target.value,
                        })
                      }
                    />
                  </div>
                ) : (
                  <div>
                    <div className="font-medium text-slate-800">
                      {d.title || d.fileName}
                    </div>
                    {d.title && (
                      <div className="text-xs text-slate-400">{d.fileName}</div>
                    )}
                    {d.description && (
                      <div className="mt-1 text-xs text-slate-500">
                        {d.description}
                      </div>
                    )}
                  </div>
                )}
              </Td>
              <Td>{d.project?.title || '—'}</Td>
              <Td>{d.fileType}</Td>
              <Td>{(d.fileSize / 1024).toFixed(0)} KB</Td>
              <Td>v{d.version}</Td>
              <Td>
                <a
                  href={d.fileUrl}
                  target="_blank"
                  className="text-brand hover:underline"
                >
                  open
                </a>
              </Td>
              {canManage && (
                <Td>
                  {editId === d.id ? (
                    <div className="flex gap-2">
                      <Button
                        variant="success"
                        className="px-3 py-1 text-xs"
                        onClick={() => saveEdit(d.id)}
                        disabled={editBusy}
                      >
                        {editBusy ? 'Saving…' : 'Save'}
                      </Button>
                      <Button
                        variant="outline"
                        className="px-3 py-1 text-xs"
                        onClick={() => setEditId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="px-3 py-1 text-xs"
                        onClick={() => startEdit(d)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        className="px-3 py-1 text-xs"
                        onClick={() => remove(d.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </Td>
              )}
            </tr>
          ))}
          {docs.length === 0 && (
            <tr>
              <Td className="text-slate-400">No documents.</Td>
            </tr>
          )}
        </Table>
      )}
    </div>
  );
}
