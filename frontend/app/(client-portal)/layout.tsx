export default function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-sm font-extrabold text-white">CP</div>
          <span className="font-bold text-slate-800">Client Portal</span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}
