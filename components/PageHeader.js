// Small shared header. On mobile shows the brand mark linking to dashboard.
// On desktop the sidebar handles primary nav, so the header is just a compact crumb.

import LogoMark from "./LogoMark";

export default function PageHeader({ back = "/dashboard" }) {
  return (
    <header className="flex items-center justify-between mb-6 md:hidden">
      <a href={back} className="text-sm text-[var(--muted)] hover:text-[var(--text)]">← Back</a>
      <a href="/dashboard" className="flex items-center gap-2 hover:opacity-80">
        <LogoMark size={28} />
        <span className="font-extrabold text-sm">RidgeLine</span>
      </a>
    </header>
  );
}
