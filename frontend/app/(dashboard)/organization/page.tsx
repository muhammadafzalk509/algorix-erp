'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { Card, PageHeader } from '@/components/ui';
import { Crown, Cpu, Users as UsersIcon } from 'lucide-react';

interface OrgUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  role: { name: string; permissionTier: string };
}

interface RoleDef { name: string; cap?: number; lead?: boolean }
interface LayerDef {
  key: string;
  label: string;
  blurb: string;
  accent: string;
  icon: typeof Crown;
  roles: RoleDef[];
}

// The org chart, top → bottom, exactly as the three layers are defined.
const LAYERS: LayerDef[] = [
  {
    key: 'management',
    label: 'Management',
    blurb: 'Executive & strategic leadership',
    accent: '#1f4e79',
    icon: Crown,
    roles: [
      { name: 'CEO', cap: 1, lead: true },
      { name: 'CTO', cap: 1, lead: true },
      { name: 'VP Engineering', cap: 1, lead: true },
    ],
  },
  {
    key: 'development',
    label: 'Development',
    blurb: 'Engineering, QA, IoT & documentation teams',
    accent: '#7c3aed',
    icon: Cpu,
    roles: [
      { name: 'Head of Developer', cap: 2, lead: true },
      { name: 'Tester Head', cap: 1, lead: true },
      { name: 'IoT Head', cap: 1, lead: true },
      { name: 'Head of Documentation', cap: 1, lead: true },
      { name: 'Developer', cap: 5 },
      { name: 'QA' },
      { name: 'IoT Engineer', cap: 5 },
      { name: 'Documentation Specialist', cap: 5 },
    ],
  },
  {
    key: 'hr',
    label: 'HR',
    blurb: 'People, payroll & operations',
    accent: '#0891b2',
    icon: UsersIcon,
    roles: [{ name: 'HR / Payroll Officer', cap: 1, lead: true }],
  },
];

export default function OrganizationPage() {
  const { user } = useAuth();
  const allowed = can(user?.permissionTier, ['TIER_0', 'TIER_1', 'TIER_2']);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!allowed) { setLoading(false); return; }
    api.get<OrgUser[]>('/users')
      .then(setUsers)
      .catch((e) => setErr((e as Error).message))
      .finally(() => setLoading(false));
  }, [allowed]);

  const byRole = useMemo(() => {
    const m = new Map<string, OrgUser[]>();
    for (const u of users) {
      const list = m.get(u.role.name) ?? [];
      list.push(u);
      m.set(u.role.name, list);
    }
    return m;
  }, [users]);

  if (!allowed)
    return (
      <div>
        <PageHeader title="Organization" />
        <p className="text-sm text-rose-600">The organization view is available to Management (VP Engineering, CTO, CEO).</p>
      </div>
    );

  return (
    <div>
      <PageHeader title="Organization" />
      <p className="-mt-2 mb-5 text-sm text-slate-500">
        Company structure across three layers — Management, Development and HR. {users.length} people total.
      </p>
      {err && <p className="mb-4 text-sm text-rose-600">{err}</p>}

      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {LAYERS.map((layer) => {
            const Icon = layer.icon;
            const headcount = layer.roles.reduce((n, r) => n + (byRole.get(r.name)?.length ?? 0), 0);
            return (
              <Card key={layer.key} className="flex flex-col">
                <div className="mb-3 flex items-start justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="grid h-9 w-9 place-items-center rounded-lg text-white" style={{ backgroundColor: layer.accent }}>
                      <Icon size={18} />
                    </span>
                    <div>
                      <h3 className="font-bold text-slate-800">{layer.label}</h3>
                      <p className="text-[11px] text-slate-400">{layer.blurb}</p>
                    </div>
                  </div>
                  <span className="rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: layer.accent }}>{headcount}</span>
                </div>

                <div className="space-y-3">
                  {layer.roles.map((role) => {
                    const people = byRole.get(role.name) ?? [];
                    return (
                      <div key={role.name}>
                        <div className="flex items-center justify-between">
                          <p className={`text-xs font-semibold ${role.lead ? 'text-slate-700' : 'text-slate-500'}`}>
                            {role.lead && <span style={{ color: layer.accent }}>● </span>}
                            {role.name}
                          </p>
                          <span className="text-[10px] text-slate-400">
                            {people.length}{role.cap ? `/${role.cap}` : ''}
                          </span>
                        </div>
                        {people.length > 0 ? (
                          <ul className="mt-1 space-y-0.5">
                            {people.map((p) => (
                              <li key={p.id} className="flex items-center justify-between rounded-md bg-slate-50 px-2 py-1 text-xs dark:bg-slate-700/40">
                                <span className="text-slate-700 dark:text-slate-200">{p.firstName} {p.lastName}</span>
                                <span className={`text-[10px] font-medium ${p.status === 'ACTIVE' ? 'text-emerald-600' : p.status === 'PENDING_APPROVAL' ? 'text-amber-600' : 'text-slate-400'}`}>
                                  {p.status === 'PENDING_APPROVAL' ? 'PENDING' : p.status}
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-0.5 text-[10px] italic text-slate-300">vacant</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
