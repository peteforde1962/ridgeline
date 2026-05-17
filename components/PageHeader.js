// Small shared header. On mobile shows the brand mark linking to dashboard.
// On desktop the sidebar handles primary nav, so the header is just a compact crumb.

export default function PageHeader({ back = "/dashboard" }) {
  return (
    <header className="flex items-center justify-between mb-6 md:hidden">
      <a href={back} className="text-sm text-[var(--muted)] hover:text-[var(--text)]">← Back</a>
      <a href="/dashboard" className="flex items-center gap-2 hover:opacity-80">
        <div className="logo-mark">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 19l5-9 3 5 4-7 6 11z" />
          </svg>
        </div>
        <span className="font-extrabold text-sm">RidgeLine</span>
      </a>
    </header>
  );
}
