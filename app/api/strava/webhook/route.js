// /api/strava/webhook
//   GET  — Strava verification handshake.
//   POST — Strava push event. Fetch the activity, insert as a ride, link all matching trails.

import { adminClient } from "@/lib/supabase/admin";
import { ensureFreshToken, activityToRide } from "@/lib/strava";
import { matchTrails } from "@/lib/trail-match";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    if (!profile?.strava_refresh_token) {
      return Response.json({ ok: true, note: "no matching user" });
    }

    const accessToken = await ensureFreshToken(admin, profile);
    const actRes = await fetch(`${STRAVA_API}/activities/${event.object_id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!actRes.ok) {
      return Response.json({ ok: false, error: "strava fetch failed", status: actRes.status }, { status: 502 });
    }
    const activity = await actRes.json();
    const row = activityToRide(activity, profile.id);
    if (!row) return Response.json({ ok: true, ignored: "non-cycling" });

    const { data: trails } = await admin
      .from("trails").select("id, name").eq("user_id", profile.id);
    const matchedIds = matchTrails(activity.name, trails || []);
    row.trail_id = matchedIds[0] || null;

    // Upsert the ride (idempotent on strava_activity_id).
    const { data: rideIns, error: upErr } = await admin
      .from("rides")
      .upsert([row], { onConflict: "user_id,strava_activity_id", ignoreDuplicates: false })
      .select("id")
      .single();
    if (upErr) return Response.json({ ok: false, error: upErr.message }, { status: 500 });

    // Link all matched trails.
    if (rideIns?.id && matchedIds.length > 0) {
      const links = matchedIds.map(tid => ({ ride_id: rideIns.id, trail_id: tid }));
      await admin.from("ride_trails")
        .upsert(links, { onConflict: "ride_id,trail_id", ignoreDuplicates: true });
    }

    return Response.json({ ok: true, inserted: true, linkedTrails: matchedIds.length });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
