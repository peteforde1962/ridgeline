// /library — hub for all training-content libraries.
// Glass panels, one per library, with the brand SVG icon + a description +
// a count of items inside. Each panel is a single big click target.

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  STRENGTH_EXERCISES, YOGA_POSES, RUN_SESSIONS, FLOW_ROPE_DRILLS,
} from "@/lib/training-content";
import PageHeader from "@/components/PageHeader";
import Icon from "@/lib/icons";

// Counts for the equipment-filtered slices of the strength library.
const KB_COUNT = STRENGTH_EXERCISES.filter((e) => e.workout === "Kettlebell").length;
const BW_COUNT = STRENGTH_EXERCISES.filter((e) => e.workout === "Body Weight").length;

const PANELS = [
  {
    href: "/strength",
    icon: "dumb",
    title: "Strength",
    desc: "Cycling-specific lifts — squats, deadlifts, hinges, core. Search by muscle group or workout.",
    count: STRENGTH_EXERCISES.length,
    countLabel: "exercises",
  },
  {
    href: "/kettlebells",
    icon: "kettle",
    title: "Kettlebells",
    desc: "MTB-tuned kettlebell work. Swings, get-ups, carries — climb power and full-body control.",
    count: KB_COUNT,
    countLabel: "movements",
  },
  {
    href: "/bodyweight",
    icon: "flex",
    title: "Body Weight",
    desc: "No-equipment training — push, pull, squat, plank. Anywhere, anytime, no kit required.",
    count: BW_COUNT,
    countLabel: "movements",
  },
  {
    href: "/yoga",
    icon: "yoga",
    title: "Yoga & Mobility",
    desc: "Pre-ride dynamic flows + post-ride restorative poses. Filterable by body part.",
    count: YOGA_POSES.length,
    countLabel: "poses",
  },
  {
    href: "/run",
    icon: "run",
    title: "Running",
    desc: "Cross-training run sessions by phase — easy aerobic to threshold intervals.",
    count: RUN_SESSIONS.length,
    countLabel: "sessions",
  },
  {
    href: "/rope",
    icon: "rope",
    title: "Flow Rope",
    desc: "Coordination + shoulder mobility drills. Beginner-to-advanced flow patterns.",
    count: FLOW_ROPE_DRILLS.length,
    countLabel: "drills",
  },
];

export default async function LibraryHubPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <PageHeader />
      <h1 className="text-3xl font-extrabold mb-1">Library</h1>
      <p className="text-[var(--muted)] mb-6">
        Every workout reference, all in one place. Pick a library to drill in.
      </p>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PANELS.map((p) => (
          <a key={p.href} href={p.href} className="library-panel card-glass">
            <div className="library-panel-icon">
              <Icon name={p.icon} size={28} stroke="var(--accent)" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2 mb-1">
                <h2 className="text-lg font-extrabold text-[var(--text)]">{p.title}</h2>
                {p.count != null && (
                  <span className="text-xs text-[var(--muted)]">
                    <strong className="text-[var(--accent2,#fccabb)]">{p.count}</strong> {p.countLabel}
                  </span>
                )}
                {p.count == null && (
                  <span className="text-xs text-[var(--muted)]">{p.countLabel}</span>
                )}
              </div>
              <p className="text-sm text-[var(--muted)] leading-relaxed">{p.desc}</p>
              <div className="text-xs text-[var(--accent)] font-semibold mt-3 inline-flex items-center gap-1">
                Open library <span>→</span>
              </div>
            </div>
          </a>
        ))}
      </section>
    </main>
  );
}
