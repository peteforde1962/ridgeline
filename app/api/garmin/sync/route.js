// POST /api/garmin/sync — pull Garmin activities into rides.

import { createClient } from "@/lib/supabase/server";
import { ensureFreshToken, fetchActivities, activityToRide } from "@/lib/garmin";

export const maxDuration = 60;

export async function POST(request) {
  const debug = [];
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles").select("*").eq("id", user.id).single();
    if (!profile?.garmin_refresh_token) {
      return Response.json({ error: "Garmin not connected" }, { status: 400 });
    }

    const accessToken = await ensureFreshToken(supabase, profile);

    const ninetyDaysAgo  = Math.floor((Date.now() - 90 * 86400_000) / 1000);
    const fourteenDaysAgo = Math.floor((Date.now() - 14 * 86400_000) / 1000);
    const sinceLast = profile.garmin_last_sync_at
      ? Math.floor(new Date(profile.garmin_last_sync_at).getTime() / 1000)
      : ninetyDaysAgo;
    const since = Math.min(sinceLast, fourteenDaysAgo);

    const activities = await fetchActivities(accessToken, { since });
    debug.push({ step: "fetched", activities: activities.length });

    let inserted = 0, skipped = 0;
    for (const activity of activities) {
      const row = activityToRide(activity, user.id);
      if (!row) { skipped++; continue; }
      const { error } = await supabase.from("rides")
        .upsert([row], { onConflict: "user_id,garmin_activity_id", ignoreDuplicates: false });
      if (error) {
        debug.push({ act: row.garmin_activity_id, error: error.message });
        continue;
      }
      inserted++;
      debug.push({
        act: row.garmin_activity_id,
        date: row.date,
        sport_type: row.sport_type,
        kind: row.activity_kind,
        km: row.km, minutes: row.minutes,
      });
    }

    await supabase.from("profiles").update({
      garmin_last_sync_at: new Date().toISOString(),
    }).eq("id", user.id);

    return Response.json({ ok: true, fetched: activities.length, inserted, skipped, debug });
  } catch (err) {
    return Response.json({ error: err.message, debug }, { status: 500 });
  }
}
