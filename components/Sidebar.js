"use client";

// Desktop left sidebar — modern flat design with SVG icons.
// Hidden on screens < 768px (mobile uses the bottom tab bar instead).

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LogoMark from "./LogoMark";

// Tiny SVG icon components. Stroke-only, flat, 1.75 stroke-width.
function Icon({ path, viewBox = "0 0 24 24" }) {
  return (
    <svg viewBox={viewBox} width="20" height="20" fill="none" stroke="currentColor"
         strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {path}
    </svg>
  );
}

const ICONS = {
  home:    <Icon path={<><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M9 21V14h6v7" /></>} />,
  target:  <Icon path={<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>} />,
  cal:     <Icon path={<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></>} />,
  heart:   <Icon path={<path d="M12 21s-7-4.35-9-9.7C1.7 7 4.4 4 7.7 4c2 0 3.4 1.1 4.3 2.6C12.9 5.1 14.3 4 16.3 4 19.6 4 22.3 7 21 11.3 19 16.65 12 21 12 21z" />} />,
  bike:    <Icon path={<><circle cx="6" cy="17" r="3" /><circle cx="18" cy="17" r="3" /><path d="M6 17l4-9h4l3 6" /><path d="M9 8h3" /></>} />,
  bolt:    <Icon path={<path d="M13 2L4 14h7l-2 8 9-12h-7l2-8z" />} />,
  bars:    <Icon path={<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>} />,
  dumb:    <Icon path={<><path d="M6 8v8M3 11v2M21 11v2M18 8v8M6 12h12" /></>} />,
  yoga:    <Icon path={<><circle cx="12" cy="5" r="2" /><path d="M12 8v4M8 12h8M9 22l3-10 3 10M4 12l-2 6M20 12l2 6" /></>} />,
  run:     <Icon path={<><circle cx="14" cy="4" r="2" /><path d="M9 20l3-7-3-3 4-3 3 3h3M10 11l-3 4-2-1" /></>} />,
  rope:    <Icon path={<><path d="M5 5c4 2 4 6 0 8s-4 6 0 8" /><path d="M19 5c-4 2-4 6 0 8s4 6 0 8" /></>} />,
  movie:   <Icon path={<><rect x="2" y="6" width="20" height="12" rx="2" /><path d="M2 10h20M7 6V4M17 6V4" /></>} />,
  cog:     <Icon path={<><circle cx="12" cy="12" r="3.5" /><path d="M12 2v3M12 19v3M4.2 4.2l2.2 2.2M17.6 17.6l2.2 2.2M2 12h3M19 12h3M4.2 19.8l2.2-2.2M17.6 6.4l2.2-2.2" /></>} />,
  whistle: <Icon path={<><circle cx="9" cy="13" r="6" /><path d="M15 13h6M18 10v6" /></>} />,
  chart:   <Icon path={<><path d="M3 3v18h18" /><path d="M7 14l4-5 4 3 5-7" /></>} />,
};

const TOP = [
  { href: "/dashboard",  label: "Dashboard",   ico: ICONS.home },
  { href: "/today",      label: "Today",       ico: ICONS.target },
  { href: "/plan",       label: "Plan",        ico: ICONS.cal },
  { href: "/checkin",    label: "Check-in",    ico: ICONS.heart },
  { href: "/trails",     label: "Activities",  ico: ICONS.bike },
  { href: "/training-load", label: "Training load", ico: ICONS.chart },
  { href: "/coach",      label: "Coach AI",    ico: ICONS.bolt },
  { href: "/skills",     label: "Skills",      ico: ICONS.bars },
];

const LIBRARIES = [
  { href: "/library",    label: "Library hub",     ico: ICONS.bars },
  { href: "/strength",   label: "Strength",        ico: ICONS.dumb },
  { href: "/yoga",       label: "Yoga & Mobility", ico: ICONS.yoga },
  { href: "/run",        label: "Running",         ico: ICONS.run },
  { href: "/rope",       label: "Flow Rope",       ico: ICONS.rope },
  { href: "/videos",     label: "Videos",          ico: ICONS.movie },
];

const BOTTOM = [
  { href: "/coaching",   label: "Coaching",    ico: ICONS.whistle, coachOnly: true },
  { href: "/profile",    label: "Profile",     ico: ICONS.cog },
  { href: "/admin",      label: "Admin",       ico: ICONS.bars, adminOnly: true },
];

const HIDDEN_ON = ["/", "/login", "/signup"];

export default function Sidebar() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCoach, setIsCoach] = useState(false);

  // Detect admin + coach status to conditionally show the relevant links.
  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from("profiles")
          .select("is_admin, role, coach_approved").eq("id", user.id).single();
        setIsAdmin(!!data?.is_admin);
        setIsCoach(data?.role === "coach" && !!data?.coach_approved);
      } catch {}
    })();
  }, [pathname]);

  if (HIDDEN_ON.includes(pathname)) return null;

  const isActive = (href) => pathname === href || pathname?.startsWith(href + "/");

  function Row({ item }) {
    const active = isActive(item.href);
    return (
      <a
        href={item.href}
        className="sb-row"
        style={{
          background: active ? "rgba(242,104,56,.12)" : "transparent",
          color: active ? "var(--text)" : "var(--muted)",
          borderLeft: active ? "3px solid var(--accent)" : "3px solid transparent",
        }}
        aria-current={active ? "page" : undefined}
      >
        <span className="opacity-80">{item.ico}</span>
        <span>{item.label}</span>
      </a>
    );
  }

  return (
    <aside className="sb">
      <a href="/dashboard" className="flex items-center gap-2 mb-6 px-3 hover:opacity-80">
        <LogoMark size={32} />
        <span className="font-extrabold text-lg tracking-wide">RidgeLine</span>
      </a>

      <div className="flex flex-col gap-0.5 mb-4">
        {TOP.map((item) => <Row key={item.href} item={item} />)}
      </div>

      <div className="sb-section">Libraries</div>
      <div className="flex flex-col gap-0.5 mb-4">
        {LIBRARIES.map((item) => <Row key={item.href} item={item} />)}
      </div>

      <div className="flex flex-col gap-0.5 mt-auto">
        {BOTTOM
          .filter((it) => !it.adminOnly || isAdmin)
          .filter((it) => !it.coachOnly || isCoach)
          .map((item) => <Row key={item.href} item={item} />)}
      </div>
    </aside>
  );
}
