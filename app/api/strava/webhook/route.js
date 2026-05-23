// /api/strava/webhook — auto-import + GPS detection + per-trail time.

import { adminClient } from "@/lib/supabase/admin";
import { ensureFreshToken, activityToRide } from "@/lib/strava";
import { detectTrailsForActivity } from "@/lib/trail-detection";
import { buildPlan, rideToPlanIndex } from "@/lib/plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STRAVA_API = "https://www.strava.com/api/v3";

export async function GET(request) {
  const url = new URL(request.url);
  const mode      = url.searchParams.get("hub.mode");
  const verify    = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && verify === process.env.STRAVA_VERIFY_TOKEN) {
    return Response.json({ "hub.challenge": challenge });
  }
  return Response.json({ error: "verification failed" }, { status: 403 });
}

export async function POST(request) {
  try {
    const event = await request.json();
    if (event.object_type !== "activity" || event.aspect_type !== "create") {
      return Response.json({ ok: true, ignored: true });
    }

    const admin = adminClient();
    const { data: profile } = await admin.from("profiles")
      .select("*")
      .eq("strava_athlete_id", event.owner_id)
      .maybeSingle();
    if (!profile?.strava_refresh_token) return Response.json({ ok: true, note: "no matching user" });

    const accessToken = await ensureFreshToken(admin, profile);
    const actRes = await fetch(`${STRAVA_API}/activities/${event.object_id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!actRes.ok) return Response.json({ ok: false, error: "strava fetch failed" }, { status: 502 });

    const activity = await actRes.json();
    const row = activityToRide(activity, profile.id);
    if (!row) return Response.json({ ok: true, ignored: "non-cycling" });

    const { data: rideIns, error: upErr } = await admin
      .from("rides")
      .upsert([row], { onConflict: "user_id,strava_activity_id", ignoreDuplicates: false })
      .select("id, minutes")
      .single();
    if (upErr) return Response.json({ ok: false, error: upErr.message }, { status: 500 });

    const { data: userTrails } = await admin
      .from("trails").select("id, name, length_km, elev_m").eq("user_id", profile.id);
    const detection = await detectTrailsForActivity({
      supabase: admin, userId: profile.id, activity, userTrails: [...(userTrails || [])],
    });

    const totalPoints = detection.matches.reduce((a, m) => a + (m.points || 0), 0);
    const totalSeconds = (row.minutes || 0) * 60;

    const links = detection.matches.map((m) => ({
      ride_id: rideIns.id,
      trail_id: m.trailId,
      points_on_trail: m.points || null,
      seconds_on_trail: totalPoints > 0 && m.points
        ? Math.round((m.points / totalPoints) * totalSeconds)
        : null,
    }));

    // Re-detection: wipe and re-insert so seconds_on_trail always refreshes.
    await admin.from("ride_trails").delete().eq("ride_id", rideIns.id);

    if (links.length > 0) {
      await admin.from("ride_trails").insert(links);
      const primary = detection.matches
        .slice().sort((a, b) => (b.points || 0) - (a.points || 0))[0];
      if (primary) {
        await admin.from("rides").update({ trail_id: primary.trailId }).eq("id", rideIns.id);
      }
      await admin.from("trails")
        .update({ last_ride: row.date })
        .in("id", detection.matches.map(m => m.trailId));
    }

    // Auto-tick plan ride session for the ride's date.
    let planTicked = 0;
    try {
      const plan = buildPlan(profile);
      const planIdx = rideToPlanIndex(profile.started_at, row.date, plan.length);
      if (planIdx) {
        const day = plan[planIdx.weekIndex].days[planIdx.dayIndex];

        const { data: existingDay } = await admin
          .from("plan_sessions")
          .select("session_idx, is_extra, swapped_to, ride_id")
          .eq("user_id", profile.id)
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
          await admin.from("plan_sessions")
            .update({ completed: true, ride_id: rideIns.id })
            .eq("user_id", profile.id)
            .eq("week_index", planIdx.weekIndex)
            .eq("day_index", planIdx.dayIndex)
            .eq("session_idx", existingRideRow.session_idx);
          planTicked = 1;
        } else if (templateRideIdx >= 0) {
          await admin.from("plan_sessions").upsert({
            user_id: profile.id,
            week_index: planIdx.weekIndex,
            day_index:  planIdx.dayIndex,
            session_idx: templateRideIdx,
            completed: true, tweak: "standard",
            ride_id: rideIns.id,
          }, { onConflict: "user_id,week_index,day_index,session_idx" });
          planTicked = 1;
        } else {
          await admin.from("plan_sessions").upsert({
            user_id: profile.id,
            week_index: planIdx.weekIndex,
            day_index:  planIdx.dayIndex,
            session_idx: 100,
            is_extra: true, swapped_to: "ride",
            custom_name: "Recorded ride",
            completed: true, tweak: "standard",
            ride_id: rideIns.id,
          }, { onConflict: "user_id,week_index,day_index,session_idx" });
          planTicked = 1;
        }
      }
    } catch (e) {
      console.warn("Plan auto-tick failed:", e.message);
    }

    return Response.json({ ok: true, inserted: true, linkedTrails: links.length, source: detection.source, planTicked });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
