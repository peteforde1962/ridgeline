"use client";

// Mobile-only bottom tab bar. Hidden on screens > 768px (CSS).
// "More" opens a bottom sheet with secondary nav items instead of jumping to /dashboard.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/lib/icons";
import UnreadBadge from "./UnreadBadge";

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
  { href: "/calendar",      label: "Calendar",     icon: "calendar" },
  { href: "/trails",        label: "Activities",   icon: "bike" },
  { href: "/training-load", label: "Training load", icon: "chart" },
  { href: "/skills",        label: "Skills",       icon: "bars" },
  { href: "/library",       label: "Library",      icon: "bars" },
  { href: "/strength",      label: "Strength",     icon: "dumb" },
  { href: "/kettlebells",   label: "Kettlebells",  icon: "kettle" },
  { href: "/bodyweight",    label: "Body Weight",  icon: "flex" },
  { href: "/yoga",          label: "Yoga",         icon: "yoga" },
  { href: "/run",           label: "Run",          icon: "run" },
  { href: "/rope",          label: "Flow rope",    icon: "rope" },
  { href: "/videos",        label: "Videos",       icon: "movie" },
  { href: "/coach-chat",    label: "Coach chat",   icon: "whistle", studentWithCoachOnly: true },
  { href: "/coaching",      label: "Coaching",     icon: "whistle", coachOnly: true },
  { href: "/plan/setup",    label: "Plan setup",   icon: "cog" },
  { href: "/profile",       label: "Profile",      icon: "cog" },
  { href: "/admin",         label: "Admin",        icon: "bars", adminOnly: true },
];

const HIDDEN_ON = ["/", "/login", "/signup"];

export default function MobileTabBar() {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCoach, setIsCoach] = useState(false);
  const [hasCoach, setHasCoach] = useState(false);
  const [unreadChat, setUnreadChat] = useState(0);

  // Close sheet on route change.
  useEffect(() => { setSheetOpen(false); }, [pathname]);

  // Detect admin / coach / linked-to-coach status + unread chat so the sheet
  // filters correctly and shows badges where relevant.
  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase.from("profiles")
          .select("is_admin, role, coach_approved, coach_id").eq("id", user.id).single();
        setIsAdmin(!!data?.is_admin);
        setIsCoach(data?.role === "coach" && !!data?.coach_approved);
        setHasCoach(!!data?.coach_id);

        // Count chat messages TO me that I haven't opened yet.
        const { count } = await supabase
          .from("coach_messages")
          .select("id", { count: "exact", head: true })
          .neq("sender_id", user.id)
          .is("read_by_recipient_at", null);
        setUnreadChat(count || 0);
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
    .filter((it) => !it.coachOnly || isCoach)
    .filter((it) => !it.studentWithCoachOnly || hasCoach);

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
          style={{ position: "relative" }}
        >
          <Icon name="more" size={22} />
          <span>More</span>
          {/* Chat lives inside the sheet — surface unread count on the More
              button so the user knows to open it. */}
          {unreadChat > 0 && (
            <span style={{ position: "absolute", top: 4, right: "calc(50% - 22px)" }}>
              <UnreadBadge count={unreadChat} />
            </span>
          )}
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
                const badge = (item.href === "/coach-chat" || item.href === "/coaching")
                  ? unreadChat : 0;
                return (
                  <a key={item.href} href={item.href}
                     className={active ? "tabbar-sheet-tile active" : "tabbar-sheet-tile"}
                     style={{ position: "relative" }}>
                    <Icon name={item.icon} size={22} />
                    <span>{item.label}</span>
                    {badge > 0 && (
                      <span style={{ position: "absolute", top: 6, right: 6 }}>
                        <UnreadBadge count={badge} />
                      </span>
                    )}
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
