export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative min-h-screen bg-gradient-to-br from-brand to-brand-dark bg-cover bg-center"
      // ALGORIX hero image (frontend/public/algorix.png), darkened so the form stays readable.
      // If the file is absent, the brand gradient above shows instead — nothing breaks.
      style={{
        backgroundImage:
          "linear-gradient(rgba(3,7,18,0.82), rgba(3,7,18,0.92)), url('/algorix.png')",
      }}
    >
      <div className="grid min-h-screen place-items-center p-4">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/algorix.png"
              alt="ALGORIX"
              className="mx-auto mb-3 h-28 w-28 rounded-2xl object-cover shadow-2xl ring-1 ring-cyan-400/30"
            />
            <p className="text-sm text-cyan-100/80">Project Management &amp; ERP Platform</p>
          </div>
          <div className="rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">{children}</div>
        </div>
      </div>
    </div>
  );
}
