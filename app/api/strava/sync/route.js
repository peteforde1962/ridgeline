// POST /api/strava/sync — pull recent activities from Strava, import as rides + link trails.

import { createClient } from "@/lib/supabase/server";
import { ensureFreshToken, fetchAthleteActivities, activityToRide } from "@/lib/strava";
import { matchTrails } from "@/lib/trail-match";

export async function POST(request) {
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
    // Always look back at LEAST 14 days. Upserts are idempotent on
    // strava_activity_id, so re-scanning won't duplicate anything.
    const fourteenDaysAgo = Math.floor((Date.now() - 14 * 86400_000) / 1000);
    const ninetyDaysAgo   = Math.floor((Date.now() - 90 * 86400_000) / 1000);
    const sinceLast = profile.strava_last_sync_at
      ? Math.floor(new Date(profile.strava_last_sync_at).getTime() / 1000)
      : ninetyDaysAgo;
    const lastSync = Math.min(sinceLast, fourteenDaysAgo);

    const activities = await fetchAthleteActivities(accessToken, { after: lastSync, perPage: 100 });
    const { data: trails } = await supabase
      .from("trails").select("id, name").eq("user_id", user.id);

    // Build rows + a parallel array of trail-id arrays per activity.
    const prepared = activities
      .map((a) => {
        const row = activityToRide(a, user.id);
        if (!row) return null;
        const matchedIds = matchTrails(a.name, trails || []);
        row.trail_id = matchedIds[0] || null; // primary, back-compat
        return { row, matchedIds };
      })
      .filter(Boolean);

    let inserted = 0, skipped = 0, totalLinks = 0;

    if (prepared.length > 0) {
      const rows = prepared.map(p => p.row);
      const { data: ins, error } = await supabase
        .from("rides")
        .upsert(rows, { onConflict: "user_id,strava_activity_id", ignoreDuplicates: false })
        .select("id, strava_activity_id");
      if (error) return Response.json({ error: error.message }, { status: 500 });

      // Map strava_activity_id → returned ride id to insert join rows.
      const rideIdByStrava = {};
      (ins || []).forEach(r => { rideIdByStrava[r.strava_activity_id] = r.id; });

      const allLinks = [];
      for (const p of prepared) {
        const rideId = rideIdByStrava[p.row.strava_activity_id];
        if (!rideId) continue;
        p.matchedIds.forEach((tid) => allLinks.push({ ride_id: rideId, trail_id: tid }));
      }
      if (allLinks.length > 0) {
        const { data: linkIns } = await supabase
          .from("ride_trails")
          .upsert(allLinks, { onConflict: "ride_id,trail_id", ignoreDuplicates: true })
          .select("ride_id");
        totalLinks = (linkIns || []).length;
      }

      inserted = (ins || []).length;
      skipped = rows.length - inserted;
    }

    await supabase.from("profiles").update({
      strava_last_sync_at: new Date().toISOString(),
    }).eq("id", user.id);

    return Response.json({
      ok: true,
      fetched: activities.length,
      cyclingFiltered: prepared.length,
      inserted, skipped,
      matched: totalLinks,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
