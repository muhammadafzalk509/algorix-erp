'use client';

import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '@/lib/api';
import { Card, CardTitle, PageHeader } from '@/components/ui';

interface NV { name: string; value: number }
const COLORS = ['#1f4e79', '#3b8be6', '#2ecc71', '#f1c40f', '#e74c3c', '#9b59b6'];

export default function AnalyticsPage() {
  const [revenue, setRevenue] = useState<{ breakdown: NV[]; totalInvoiced: number } | null>(null);
  const [tasks, setTasks] = useState<{ byStatus: NV[]; byPriority: NV[] } | null>(null);
  const [projects, setProjects] = useState<{ breakdown: NV[]; totalBudget: number } | null>(null);
  const [prod, setProd] = useState<{ byDeveloper: { name: string; hours: number }[]; totalHours: number } | null>(null);

  useEffect(() => {
    const safe = async <T,>(p: string, set: (v: T) => void) => {
      try { set(await api.get<T>(p)); } catch { /* tier not allowed */ }
    };
    safe('/analytics/revenue', setRevenue);
    safe('/analytics/tasks', setTasks);
    safe('/analytics/projects', setProjects);
    safe('/analytics/productivity', setProd);
  }, []);

  return (
    <div>
      <PageHeader title="Analytics" />
      <div className="grid gap-5 lg:grid-cols-2">
        {revenue && (
          <Card>
            <CardTitle>Revenue (Total invoiced: {revenue.totalInvoiced})</CardTitle>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={revenue.breakdown} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} label>
                  {revenue.breakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        )}
        {tasks && (
          <Card>
            <CardTitle>Tasks by Status</CardTitle>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={tasks.byStatus}>
                <XAxis dataKey="name" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Bar dataKey="value" fill="#1f4e79" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
        {projects && (
          <Card>
            <CardTitle>Projects by Status (Budget: {projects.totalBudget})</CardTitle>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={projects.breakdown}>
                <XAxis dataKey="name" fontSize={11} /><YAxis allowDecimals={false} fontSize={11} />
                <Tooltip />
                <Bar dataKey="value" fill="#3b8be6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
        {prod && (
          <Card>
            <CardTitle>Developer Productivity (Total: {prod.totalHours}h)</CardTitle>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={prod.byDeveloper}>
                <XAxis dataKey="name" fontSize={11} /><YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="hours" fill="#2ecc71" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
        {!revenue && !tasks && !projects && !prod && (
          <Card><p className="text-sm text-slate-400">No analytics available for your role.</p></Card>
        )}
      </div>
    </div>
  );
}
