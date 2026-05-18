// POST /api/strava/sync — pull activities from Strava, import as rides, auto-detect trails.

import { createClient } from "@/lib/supabase/server";
import { ensureFreshToken, fetchAthleteActivities, activityToRide } from "@/lib/strava";
import { detectTrailsForActivity } from "@/lib/trail-detection";

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

    // Always look back at LEAST 14 days. Upserts are idempotent on strava_activity_id.
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

    let inserted = 0, skipped = 0, totalLinks = 0, nonCycling = 0;

    for (const activity of activities) {
      const row = activityToRide(activity, user.id);
      if (!row) {
        nonCycling++;
        debug.push({ act: activity.id, name: activity.name, skipped: "non-cycling", sport_type: activity.sport_type });
        continue;
      }

      // Upsert the ride.
      const { data: rideRow, error: upErr } = await supabase
        .from("rides")
        .upsert([row], { onConflict: "user_id,strava_activity_id", ignoreDuplicates: false })
        .select("id")
        .single();
      if (upErr) {
        debug.push({ act: activity.id, error: upErr.message });
        continue;
      }
      inserted++;

      // Detect trails (user's own first, then OSM).
      const detection = await detectTrailsForActivity({
        supabase, userId: user.id, activity, userTrails: trailsCache,
      });

      debug.push({
        act: activity.id, name: activity.name,
        date: activity.start_date_local?.slice(0, 10),
        trails: detection.trailIds.length, source: detection.source,
      });

      if (detection.trailIds.length > 0) {
        const links = detection.trailIds.map((tid) => ({ ride_id: rideRow.id, trail_id: tid }));
        await supabase.from("ride_trails")
          .upsert(links, { onConflict: "ride_id,trail_id", ignoreDuplicates: true });
        totalLinks += detection.trailIds.length;

        // Update primary trail_id back-compat
        await supabase.from("rides").update({ trail_id: detection.trailIds[0] }).eq("id", rideRow.id);

        // PR update only when ride is linked to a single trail (full ride = that trail).
        if (detection.trailIds.length === 1) {
          const tid = detection.trailIds[0];
          const t = trailsCache.find((x) => x.id === tid);
          if (t) {
            const newMin = row.minutes;
            const newPR = !t.pr_minutes || newMin < t.pr_minutes ? newMin : t.pr_minutes;
            await supabase.from("trails")
              .update({ pr_minutes: newPR, last_ride: row.date })
              .eq("id", tid);
          }
        } else {
          // Just update last_ride for each linked trail.
          await supabase.from("trails")
            .update({ last_ride: row.date })
            .in("id", detection.trailIds);
        }
      }
    }

    await supabase.from("profiles").update({
      strava_last_sync_at: new Date().toISOString(),
    }).eq("id", user.id);

    return Response.json({
      ok: true,
      fetched: activities.length,
      cyclingFiltered: inserted + nonCycling,
      inserted,
      nonCycling,
      matched: totalLinks,
      debug,
    });
  } catch (err) {
    return Response.json({ error: err.message, debug }, { status: 500 });
  }
}
