"use client";

// Mobile-only bottom tab bar. Hidden on screens > 768px (CSS handles that).
// Hidden entirely on auth pages.

import { usePathname } from "next/navigation";

const TABS = [
  { href: "/today",    label: "Today",    ico: "🎯" },
  { href: "/plan",     label: "Plan",     ico: "📅" },
  { href: "/checkin",  label: "Check-in", ico: "💚" },
  { href: "/coach",    label: "Coach",    ico: "🤖" },
  { href: "/dashboard",label: "More",     ico: "☰" },
];

const HIDDEN_ON = ["/", "/login", "/signup"];

export default function MobileTabBar() {
  const pathname = usePathname();
  if (HIDDEN_ON.includes(pathname)) return null;

  return (
    <nav className="tabbar" aria-label="Primary">
      {TABS.map((t) => {
        // "More" is active for anything not covered by the other 4 tabs.
        const isMore = t.href === "/dashboard";
        const active = isMore
          ? !TABS.slice(0, 4).some((x) => pathname?.startsWith(x.href))
          : pathname === t.href || pathname?.startsWith(t.href + "/");
        return (
          <a key={t.href} href={t.href} className={active ? "active" : ""} aria-current={active ? "page" : undefined}>
            <span className="ico">{t.ico}</span>
            <span>{t.label}</span>
          </a>
        );
      })}
    </nav>
  );
}
