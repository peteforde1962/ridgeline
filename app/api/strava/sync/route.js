// POST /api/strava/sync — pull recent activities from Strava, import into rides.
// Idempotent: existing Strava activities won't be duplicated thanks to a unique index.

import { createClient } from "@/lib/supabase/server";
import { ensureFreshToken, fetchAthleteActivities, activityToRide } from "@/lib/strava";

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

    // Pull only activities newer than the last sync (or last 90 days for first sync).
    const lastSync = profile.strava_last_sync_at
      ? Math.floor(new Date(profile.strava_last_sync_at).getTime() / 1000)
      : Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000);

    const activities = await fetchAthleteActivities(accessToken, { after: lastSync, perPage: 100 });
    const rows = activities.map((a) => activityToRide(a, user.id)).filter(Boolean);

    let inserted = 0, skipped = 0;
    if (rows.length > 0) {
      const { data: ins, error } = await supabase
        .from("rides")
        .upsert(rows, { onConflict: "user_id,strava_activity_id", ignoreDuplicates: true })
        .select("id");
      if (error) return Response.json({ error: error.message }, { status: 500 });
      inserted = (ins || []).length;
      skipped = rows.length - inserted;
    }

    await supabase.from("profiles").update({
      strava_last_sync_at: new Date().toISOString(),
    }).eq("id", user.id);

    return Response.json({
      ok: true,
      fetched: activities.length,
      cyclingFiltered: rows.length,
      inserted,
      skipped,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
