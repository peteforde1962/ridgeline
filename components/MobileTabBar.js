"use client";

// Mobile-only bottom tab bar. Hidden on screens > 768px (CSS).
// "More" opens a bottom sheet with secondary nav items instead of jumping to /dashboard.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/lib/icons";

const TABS = [
  { href: "/today",    label: "Today",    icon: "target" },
  { href: "/plan",     label: "Plan",     icon: "calendar" },
  { href: "/checkin",  label: "Check-in", icon: "heart" },
  { href: "/coach",    label: "Coach",    icon: "bolt" },
  // "More" is handled specially — it opens the sheet, not a link.
];

// Items shown in the "More" sheet.
const SHEET = [
  { href: "/dashboard",     label: "Dashboard",    icon: "home" },
  { href: "/trails",        label: "Trails & Rides", icon: "bike" },
  { href: "/training-load", label: "Training load", icon: "chart" },
  { href: "/skills",        label: "Skills",       icon: "bars" },
  { href: "/strength",      label: "Strength",     icon: "dumb" },
  { href: "/yoga",          label: "Yoga",         icon: "yoga" },
  { href: "/run",           label: "Run",          icon: "run" },
  { href: "/rope",          label: "Flow rope",    icon: "rope" },
  { href: "/videos",        label: "Videos",       icon: "movie" },
  { href: "/coaching",      label: "Coaching",     icon: "whistle", coachOnly: true },
  { href: "/profile",       label: "Profile",      icon: "cog" },
  { href: "/admin",         label: "Admin",        icon: "bars", adminOnly: true },
];

const HIDDEN_ON = ["/", "/login", "/signup"];

export default function MobileTabBar() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCoach, setIsCoach] = useState(false);

  // Close sheet on route change.
  useEffect(() => { setSheetOpen(false); }, [pathname]);

  // Detect admin / coach status so the sheet filters correctly.
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

  const isActiveLink = (href) => pathname === href || pathname?.startsWith(href + "/");
  // Sheet is "active" when the current route isn't covered by the 4 main tabs.
  const tabsCover = TABS.some((t) => isActiveLink(t.href));
  const sheetActive = !tabsCover;

  const filteredSheet = SHEET
    .filter((it) => !it.adminOnly || isAdmin)
    .filter((it) => !it.coachOnly || isCoach);

  return (
    <>
      <nav className="tabbar" aria-label="Primary">
        {TABS.map((t) => {
          const active = isActiveLink(t.href);
          return (
            <a key={t.href} href={t.href}
               className={active ? "active" : ""}
               aria-current={active ? "page" : undefined}>
              <Icon name={t.icon} size={22} />
              <span>{t.label}</span>
            </a>
          );
        })}
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className={sheetActive ? "active tabbar-more" : "tabbar-more"}
          aria-expanded={sheetOpen}
          aria-label="More menu"
        >
          <Icon name="more" size={22} />
          <span>More</span>
        </button>
      </nav>

      {sheetOpen && (
        <>
          {/* Tap-anywhere backdrop closes the sheet. */}
          <div className="tabbar-backdrop" onClick={() => setSheetOpen(false)} aria-hidden />
          <div className="tabbar-sheet" role="dialog" aria-label="More navigation">
            <div className="tabbar-sheet-handle" />
            <div className="tabbar-sheet-grid">
              {filteredSheet.map((item) => {
                const active = isActiveLink(item.href);
                return (
                  <a key={item.href} href={item.href}
                     className={active ? "tabbar-sheet-tile active" : "tabbar-sheet-tile"}>
                    <Icon name={item.icon} size={22} />
                    <span>{item.label}</span>
                  </a>
                );
              })}
            </div>
          </div>
        </>
      )}
    </>
  );
}
