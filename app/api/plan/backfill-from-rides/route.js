// POST /api/plan/backfill-from-rides
// One-shot backfill: walk every ride the user has, map each to a plan day,
// auto-tick the ride session(s) on that day. Preserves any existing state
// (ignoreDuplicates) so manual ticks/skips aren't overwritten.

import { createClient } from "@/lib/supabase/server";
import { buildPlan, rideToPlanIndex } from "@/lib/plan";

export async function POST() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const { data: rides }   = await supabase.from("rides").select("id, date").eq("user_id", user.id)
    .order("date", { ascending: true });

  if (!profile || !rides) return Response.json({ ok: true, ridesScanned: 0, planTicked: 0 });

  const plan = buildPlan(profile);
  // Reserved session_idx for Strava-derived ride markers on days with no
  // planned ride. Stays out of the way of template (0..N) and manual extras
  // (which start at day.details.length).
  const STRAVA_MARKER_IDX = 100;

  const rows = [];
  for (const ride of rides) {
    const planIdx = rideToPlanIndex(profile.started_at, ride.date, plan.length);
    if (!planIdx) continue;
    const day = plan[planIdx.weekIndex].days[planIdx.dayIndex];

    const hasPlannedRide = day.details.some((s) => s.type === "ride");
    if (hasPlannedRide) {
      day.details.forEach((s, sIdx) => {
        if (s.type === "ride") {
          rows.push({
            user_id: user.id,
            week_index: planIdx.weekIndex,
            day_index:  planIdx.dayIndex,
            session_idx: sIdx,
            completed: true,
            tweak: "standard",
            ride_id: ride.id,
          });
        }
      });
    } else {
      rows.push({
        user_id: user.id,
        week_index: planIdx.weekIndex,
        day_index:  planIdx.dayIndex,
        session_idx: STRAVA_MARKER_IDX,
        is_extra: true,
        swapped_to: "ride",
        custom_name: "Recorded ride",
        completed: true,
        tweak: "standard",
        ride_id: ride.id,
      });
    }
  }

  let ticked = 0;
  if (rows.length > 0) {
    const { data } = await supabase
      .from("plan_sessions")
      .upsert(rows, { onConflict: "user_id,week_index,day_index,session_idx", ignoreDuplicates: true })
      .select("id");
    ticked = (data || []).length;
  }

  return Response.json({ ok: true, ridesScanned: rides.length, planTicked: ticked });
}
