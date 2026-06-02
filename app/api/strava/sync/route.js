// POST /api/strava/sync — import activities, GPS-detect trails, write per-trail times.

import { createClient } from "@/lib/supabase/server";
import { ensureFreshToken, fetchAthleteActivities, fetchActivityStreams, activityToRide, STRAVA_API_BASE } from "@/lib/strava";
import { detectTrailsForActivity } from "@/lib/trail-detection";
import { buildPlan, rideToPlanIndex } from "@/lib/plan";

export const maxDuration = 60;

export async function POST(request) {
  const debug = [];
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles").select("*").eq("id", user.id).single();
    if (!profile?.strava_refresh_token) {
      return Response.json({ error: "Strava not connected" }, { status: 400 });
    }

    const accessToken = await ensureFreshToken(supabase, profile);

    const fourteenDaysAgo = Math.floor((Date.now() - 14 * 86400_000) / 1000);
    const ninetyDaysAgo   = Math.floor((Date.now() - 90 * 86400_000) / 1000);
    const sinceLast = profile.strava_last_sync_at
      ? Math.floor(new Date(profile.strava_last_sync_at).getTime() / 1000)
      : ninetyDaysAgo;
    const lastSync = Math.min(sinceLast, fourteenDaysAgo);

    const activities = await fetchAthleteActivities(accessToken, { after: lastSync, perPage: 100 });
    debug.push({ step: "fetched", activities: activities.length });

    const { data: userTrails } = await supabase
      .from("trails").select("id, name, length_km, elev_m").eq("user_id", user.id);
    const trailsCache = [...(userTrails || [])];

    // Pre-compute the user's plan so we can auto-tick ride sessions per date.
    const plan = buildPlan(profile);

    let inserted = 0, nonCycling = 0, totalLinks = 0, planTicked = 0;

    // Share the OSM area-trail lookup across all rides in this sync so we
    // don't hammer Overpass per ride.
    const osmCache = { byKey: new Map(), timedOut: false };

    for (const activity of activities) {
      const row = activityToRide(activity, user.id);
      if (!row) {
        nonCycling++;
        debug.push({ act: activity.id, name: activity.name, skipped: "non-cycling", sport_type: activity.sport_type });
        continue;
      }

      // Fetch the detailed activity so we get segment_efforts (Strava-tagged
      // trail segments). Falls back gracefully if the call fails.
      let detailedActivity = activity;
      try {
        const dRes = await fetch(`${STRAVA_API_BASE}/activities/${activity.id}?include_all_efforts=true`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (dRes.ok) detailedActivity = await dRes.json();
      } catch {}

      // Fetch altitude/distance streams so trail-detection can compute REAL
      // climb + descent per trail by slicing on segment_effort indices.
      try {
        const streams = await fetchActivityStreams(accessToken, activity.id);
        if (streams) detailedActivity._streams = streams;
      } catch {}

      const { data: rideRow, error: upErr } = await supabase
        .from("rides")
        .upsert([row], { onConflict: "user_id,strava_activity_id", ignoreDuplicates: false })
        .select("id, minutes")
        .single();
      if (upErr) {
        debug.push({ act: activity.id, error: upErr.message });
        continue;
      }
      inserted++;

      const detection = await detectTrailsForActivity({
        supabase, userId: user.id, activity: detailedActivity, userTrails: trailsCache, osmCache,
      });

      // Compute per-trail seconds from point counts × total moving time.
      const totalPoints = detection.matches.reduce((a, m) => a + (m.points || 0), 0);
      const totalSeconds = (row.minutes || 0) * 60;

      const links = detection.matches.map((m) => ({
        ride_id: rideRow.id,
        trail_id: m.trailId,
        points_on_trail: m.points || null,
        seconds_on_trail: m.seconds_on_trail != null
          ? m.seconds_on_trail
          : (totalPoints > 0 && m.points
              ? Math.round((m.points / totalPoints) * totalSeconds)
              : null),
      }));

      debug.push({
        act: activity.id, name: activity.name,
        date: activity.start_date_local?.slice(0, 10),
        trails: detection.matches.length, source: detection.source,
        ...(detection.details || {}),
      });

      // Re-detection: wipe existing links and write the fresh set. This avoids
      // any RLS UPDATE quirks and ensures seconds_on_trail gets refreshed.
      await supabase.from("ride_trails").delete().eq("ride_id", rideRow.id);

      if (links.length > 0) {
        await supabase.from("ride_trails").insert(links);
        totalLinks += links.length;

        // Back-compat: also set rides.trail_id to the trail with most points.
        const primary = detection.matches
          .slice().sort((a, b) => (b.points || 0) - (a.points || 0))[0];
        if (primary) {
          await supabase.from("rides").update({ trail_id: primary.trailId }).eq("id", rideRow.id);
        }

        // Update trails.last_ride for everything linked.
        await supabase.from("trails")
          .update({ last_ride: row.date })
          .in("id", detection.matches.map(m => m.trailId));
      }

      // Auto-tick: find an existing ride-type session on this day (template OR
      // swapped OR existing extra). If one exists, attach the ride to it and mark
      // complete. Only if NONE exist do we add a new "Recorded ride" extra.
      const planIdx = rideToPlanIndex(profile.started_at, row.date, plan.length);
      if (planIdx) {
        const day = plan[planIdx.weekIndex].days[planIdx.dayIndex];

        const { data: existingDay } = await supabase
          .from("plan_sessions")
          .select("session_idx, is_extra, swapped_to, ride_id")
          .eq("user_id", user.id)
          .eq("week_index", planIdx.weekIndex)
          .eq("day_index", planIdx.dayIndex);

        // Helper: is this session row currently a "ride"?
        const isRideRow = (s) => {
          if (s.swapped_to === "ride") return true;
          if (s.is_extra) return s.swapped_to === "ride";
          return day.details[s.session_idx]?.type === "ride";
        };

        const existingRideRow = (existingDay || []).find(isRideRow);
        const templateRideIdx = day.details.findIndex((s) => s.type === "ride");

        if (existingRideRow) {
          // Update the existing row in place: link the ride + mark complete.
          await supabase.from("plan_sessions")
            .update({ completed: true, ride_id: rideRow.id })
            .eq("user_id", user.id)
            .eq("week_index", planIdx.weekIndex)
            .eq("day_index", planIdx.dayIndex)
            .eq("session_idx", existingRideRow.session_idx);
          planTicked += 1;
        } else if (templateRideIdx >= 0) {
          // Template has a ride slot but no row yet — insert it.
          await supabase.from("plan_sessions").upsert({
            user_id: user.id,
            week_index: planIdx.weekIndex,
            day_index:  planIdx.dayIndex,
            session_idx: templateRideIdx,
            completed: true, tweak: "standard",
            ride_id: rideRow.id,
          }, { onConflict: "user_id,week_index,day_index,session_idx" });
          planTicked += 1;
        } else {
          // No ride anywhere on this day — add the marker extra.
          await supabase.from("plan_sessions").upsert({
            user_id: user.id,
            week_index: planIdx.weekIndex,
            day_index:  planIdx.dayIndex,
            session_idx: 100,
            is_extra: true, swapped_to: "ride",
            custom_name: "Recorded ride",
            completed: true, tweak: "standard",
            ride_id: rideRow.id,
          }, { onConflict: "user_id,week_index,day_index,session_idx" });
          planTicked += 1;
        }
      }
    }

    await supabase.from("profiles").update({
      strava_last_sync_at: new Date().toISOString(),
    }).eq("id", user.id);

    return Response.json({
      ok: true,
      fetched: activities.length,
      inserted, nonCycling,
      matched: totalLinks,
      planTicked,
      debug,
    });
  } catch (err) {
    return Response.json({ error: err.message, debug }, { status: 500 });
  }
}
