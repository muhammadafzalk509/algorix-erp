import { Card, CardTitle } from '@/components/ui';

export default function ClientPortalProjects() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">Your Projects</h1>
      <Card>
        <CardTitle>Client access</CardTitle>
        <p className="text-sm text-slate-500">
          This separate client-facing portal shows a client their own project progress,
          feedback and support tickets. Client authentication is a planned extension —
          the current backend models clients as records, not login accounts, so a
          dedicated client-auth flow (scoped tokens) would be added before going live.
        </p>
      </Card>
    </div>
  );
}
