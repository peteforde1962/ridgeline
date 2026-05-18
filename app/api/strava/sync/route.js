// POST /api/strava/sync — import activities, GPS-detect trails, write per-trail times.

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

    let inserted = 0, nonCycling = 0, totalLinks = 0;

    for (const activity of activities) {
      const row = activityToRide(activity, user.id);
      if (!row) {
        nonCycling++;
        debug.push({ act: activity.id, name: activity.name, skipped: "non-cycling", sport_type: activity.sport_type });
        continue;
      }

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
        supabase, userId: user.id, activity, userTrails: trailsCache,
      });

      // Compute per-trail seconds from point counts × total moving time.
      const totalPoints = detection.matches.reduce((a, m) => a + (m.points || 0), 0);
      const totalSeconds = (row.minutes || 0) * 60;

      const links = detection.matches.map((m) => ({
        ride_id: rideRow.id,
        trail_id: m.trailId,
        points_on_trail: m.points || null,
        seconds_on_trail: totalPoints > 0 && m.points
          ? Math.round((m.points / totalPoints) * totalSeconds)
          : null,
      }));

      debug.push({
        act: activity.id, name: activity.name,
        date: activity.start_date_local?.slice(0, 10),
        trails: detection.matches.length, source: detection.source,
        ...(detection.details || {}),
      });

      if (links.length > 0) {
        await supabase.from("ride_trails")
          .upsert(links, { onConflict: "ride_id,trail_id", ignoreDuplicates: false });
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
    }

    await supabase.from("profiles").update({
      strava_last_sync_at: new Date().toISOString(),
    }).eq("id", user.id);

    return Response.json({
      ok: true,
      fetched: activities.length,
      inserted, nonCycling,
      matched: totalLinks,
      debug,
    });
  } catch (err) {
    return Response.json({ error: err.message, debug }, { status: 500 });
  }
}
