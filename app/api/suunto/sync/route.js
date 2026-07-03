// POST /api/suunto/sync — pull recent Suunto workouts and import as rides.

import { createClient } from "@/lib/supabase/server";
import { ensureFreshToken, fetchWorkouts, workoutToRide } from "@/lib/suunto";
import { buildPlan, rideToPlanIndex } from "@/lib/plan";

export const maxDuration = 60;

export async function POST(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (!profile?.suunto_refresh_token) {
      return Response.json({ error: "Suunto not connected" }, { status: 400 });
    }

    const accessToken = await ensureFreshToken(supabase, profile);

    // Look back at least 30 days, or to last sync if more recent.
    const thirtyDaysMs = 30 * 86400_000;
    const sinceLast = profile.suunto_last_sync_at ? new Date(profile.suunto_last_sync_at).getTime() : Date.now() - thirtyDaysMs;
    const since = Math.min(sinceLast, Date.now() - thirtyDaysMs);

    const workouts = await fetchWorkouts(accessToken, { since });
    const plan = buildPlan(profile);

    let inserted = 0, skipped = 0, ticked = 0;
    const debug = [];

    for (const w of workouts) {
      const row = workoutToRide(w, user.id);
      if (!row) {
        skipped++;
        debug.push({ workout: w.workoutKey || w.id, skipped: "non-cycling", activityId: w.activityId });
        continue;
      }

      const { data: rideRow, error: upErr } = await supabase
        .from("rides")
        .upsert([row], { onConflict: "user_id,suunto_workout_key", ignoreDuplicates: false })
        .select("id")
        .single();
      if (upErr) { debug.push({ workout: row.suunto_workout_key, error: upErr.message }); continue; }
      inserted++;

      // Auto-tick plan ride session for this date (same logic as Strava).
      const planIdx = rideToPlanIndex(profile.started_at, row.date, plan.length);
      if (planIdx) {
        const day = plan[planIdx.weekIndex].days[planIdx.dayIndex];
        const { data: existingDay } = await supabase
          .from("plan_sessions")
          .select("session_idx, is_extra, swapped_to, ride_id, tweak")
          .eq("user_id", user.id)
          .eq("week_index", planIdx.weekIndex)
          .eq("day_index", planIdx.dayIndex);

        // Skip rows the user previously removed — the UI hides those.
        const isRideRow = (s) => {
          if (s.tweak === "removed") return false;
          return s.swapped_to === "ride" ||
            (s.is_extra ? s.swapped_to === "ride" : day.details[s.session_idx]?.type === "ride");
        };

        const existing = (existingDay || []).find(isRideRow);
        const templateRideIdx = day.details.findIndex((s) => s.type === "ride");

        if (existing) {
          await supabase.from("plan_sessions")
            .update({ completed: true, ride_id: rideRow.id, tweak: "standard" })
            .eq("user_id", user.id).eq("week_index", planIdx.weekIndex)
            .eq("day_index", planIdx.dayIndex).eq("session_idx", existing.session_idx);
          ticked++;
        } else if (templateRideIdx >= 0) {
          await supabase.from("plan_sessions").upsert({
            user_id: user.id,
            week_index: planIdx.weekIndex, day_index: planIdx.dayIndex,
            session_idx: templateRideIdx,
            completed: true, tweak: "standard", ride_id: rideRow.id,
          }, { onConflict: "user_id,week_index,day_index,session_idx" });
          ticked++;
        } else {
          await supabase.from("plan_sessions").upsert({
            user_id: user.id,
            week_index: planIdx.weekIndex, day_index: planIdx.dayIndex,
            session_idx: 100,
            is_extra: true, swapped_to: "ride",
            custom_name: "Recorded ride", completed: true, tweak: "standard",
            ride_id: rideRow.id,
          }, { onConflict: "user_id,week_index,day_index,session_idx" });
          ticked++;
        }
      }
    }

    await supabase.from("profiles").update({ suunto_last_sync_at: new Date().toISOString() }).eq("id", user.id);

    return Response.json({ ok: true, fetched: workouts.length, inserted, skipped, ticked, debug });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
