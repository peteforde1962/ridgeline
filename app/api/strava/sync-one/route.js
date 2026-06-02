// POST /api/strava/sync-one — re-sync a single Strava activity.
// Body: { strava_activity_id: number }   OR   ?strava_activity_id=…
// Returns the same debug shape as the regular sync so we can inspect one ride
// in isolation.

import { createClient } from "@/lib/supabase/server";
import {
  ensureFreshToken, activityToRide, fetchActivityStreams, STRAVA_API_BASE,
} from "@/lib/strava";
import { detectTrailsForActivity } from "@/lib/trail-detection";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

    const url = new URL(request.url);
    let stravaId = url.searchParams.get("strava_activity_id");
    if (!stravaId) {
      const body = await request.json().catch(() => ({}));
      stravaId = body.strava_activity_id;
    }
    if (!stravaId) return Response.json({ error: "Missing strava_activity_id" }, { status: 400 });

    const { data: profile } = await supabase
      .from("profiles").select("*").eq("id", user.id).single();
    if (!profile?.strava_refresh_token) {
      return Response.json({ error: "Strava not connected" }, { status: 400 });
    }

    const accessToken = await ensureFreshToken(supabase, profile);

    // Pull the detailed activity + streams.
    const aRes = await fetch(`${STRAVA_API_BASE}/activities/${stravaId}?include_all_efforts=true`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!aRes.ok) {
      return Response.json({ error: "Strava fetch failed: " + await aRes.text() }, { status: 502 });
    }
    const activity = await aRes.json();

    try {
      const streams = await fetchActivityStreams(accessToken, stravaId);
      if (streams) activity._streams = streams;
    } catch {}

    const row = activityToRide(activity, user.id);
    if (!row) {
      return Response.json({ ok: true, ignored: "non-cycling", sport_type: activity.sport_type });
    }

    const { data: rideRow, error: upErr } = await supabase
      .from("rides")
      .upsert([row], { onConflict: "user_id,strava_activity_id", ignoreDuplicates: false })
      .select("id, minutes")
      .single();
    if (upErr) return Response.json({ ok: false, error: upErr.message }, { status: 500 });

    const { data: userTrails } = await supabase
      .from("trails").select("id, name, length_km, elev_m").eq("user_id", user.id);

    const detection = await detectTrailsForActivity({
      supabase, userId: user.id, activity, userTrails: [...(userTrails || [])],
      osmCache: { byKey: new Map(), timedOut: false },
    });

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

    const { error: delError } = await supabase.from("ride_trails").delete().eq("ride_id", rideRow.id);

    let inserted = 0, insertError = null;
    if (links.length > 0) {
      const { data: insertedLinks, error: insErr } = await supabase
        .from("ride_trails").insert(links).select("trail_id");
      if (insErr) insertError = insErr.message;
      else inserted = insertedLinks?.length || 0;
    }

    return Response.json({
      ok: true,
      strava_activity_id: stravaId,
      ride_id: rideRow.id,
      sport_type: activity.sport_type,
      trails_matched: detection.matches.length,
      ride_trails_inserted: inserted,
      ride_trails_delete_error: delError?.message,
      ride_trails_insert_error: insertError,
      source: detection.source,
      details: detection.details,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
