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
  const STRAVA_MARKER_IDX = 100;

  let ticked = 0, linkedExisting = 0;

  // Process each ride: find an existing ride session OR create one.
  for (const ride of rides) {
    const planIdx = rideToPlanIndex(profile.started_at, ride.date, plan.length);
    if (!planIdx) continue;
    const day = plan[planIdx.weekIndex].days[planIdx.dayIndex];

    const { data: existingDay } = await supabase
      .from("plan_sessions")
      .select("session_idx, is_extra, swapped_to, ride_id, completed")
      .eq("user_id", user.id)
      .eq("week_index", planIdx.weekIndex)
      .eq("day_index", planIdx.dayIndex);

    const isRideRow = (s) => {
      if (s.swapped_to === "ride") return true;
      if (s.is_extra) return s.swapped_to === "ride";
      return day.details[s.session_idx]?.type === "ride";
    };

    const existingRideRow = (existingDay || []).find(isRideRow);
    const templateRideIdx = day.details.findIndex((s) => s.type === "ride");

    if (existingRideRow) {
      // Attach ride_id + mark complete if not already done. Preserves swaps/extras.
      const updates = { ride_id: ride.id };
      if (!existingRideRow.completed) updates.completed = true;
      await supabase.from("plan_sessions").update(updates)
        .eq("user_id", user.id)
        .eq("week_index", planIdx.weekIndex)
        .eq("day_index", planIdx.dayIndex)
        .eq("session_idx", existingRideRow.session_idx);
      linkedExisting += 1;
    } else if (templateRideIdx >= 0) {
      await supabase.from("plan_sessions").upsert({
        user_id: user.id,
        week_index: planIdx.weekIndex,
        day_index:  planIdx.dayIndex,
        session_idx: templateRideIdx,
        completed: true, tweak: "standard",
        ride_id: ride.id,
      }, { onConflict: "user_id,week_index,day_index,session_idx" });
      ticked += 1;
    } else {
      await supabase.from("plan_sessions").upsert({
        user_id: user.id,
        week_index: planIdx.weekIndex,
        day_index:  planIdx.dayIndex,
        session_idx: STRAVA_MARKER_IDX,
        is_extra: true, swapped_to: "ride",
        custom_name: "Recorded ride",
        completed: true, tweak: "standard",
        ride_id: ride.id,
      }, { onConflict: "user_id,week_index,day_index,session_idx" });
      ticked += 1;
    }
  }

  return Response.json({ ok: true, ridesScanned: rides.length, planTicked: ticked, linkedExisting });
}
