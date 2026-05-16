// Small shared header used across content pages.

export default function PageHeader({ back = "/dashboard" }) {
  return (
    <header className="flex items-center justify-between mb-6">
      <a href={back} className="text-sm text-[var(--muted)] hover:text-[var(--text)]">← Dashboard</a>
      <div className="flex items-center gap-2">
        <div className="logo-mark">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 19l5-9 3 5 4-7 6 11z" />
          </svg>
        </div>
        <div className="font-extrabold text-sm">RidgeLine</div>
      </div>
    </header>
  );
}
