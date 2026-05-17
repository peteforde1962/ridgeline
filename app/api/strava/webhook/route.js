// /api/strava/webhook
//   GET  — Strava's subscription verification handshake. Echoes back hub.challenge.
//   POST — Strava push events. We fetch the new activity and insert it as a ride.
//
// This route is public (no auth session) — it's called by Strava's servers.
// We use the service-role Supabase client to update across users.

import { adminClient } from "@/lib/supabase/admin";
import { ensureFreshToken, activityToRide } from "@/lib/strava";
import { matchTrail } from "@/lib/trail-match";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STRAVA_API = "https://www.strava.com/api/v3";

// ----- Subscription verification handshake -----
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

// ----- Activity events -----
export async function POST(request) {
  try {
    const event = await request.json();
    // Only care about activity creates for now.
    if (event.object_type !== "activity" || event.aspect_type !== "create") {
      return Response.json({ ok: true, ignored: true });
    }

    const admin = adminClient();

    // Find the RidgeLine user whose Strava athlete id matches.
    const { data: profile } = await admin.from("profiles")
      .select("*")
      .eq("strava_athlete_id", event.owner_id)
      .maybeSingle();

    if (!profile?.strava_refresh_token) {
      return Response.json({ ok: true, note: "no matching user" });
    }

    // Refresh token if needed
    const accessToken = await ensureFreshToken(admin, profile);

    // Fetch the activity
    const actRes = await fetch(`${STRAVA_API}/activities/${event.object_id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!actRes.ok) {
      return Response.json({ ok: false, error: "strava fetch failed", status: actRes.status }, { status: 502 });
    }
    const activity = await actRes.json();
    const row = activityToRide(activity, profile.id);
    if (!row) return Response.json({ ok: true, ignored: "non-cycling" });

    // Auto-match to a trail
    const { data: trails } = await admin
      .from("trails").select("id, name").eq("user_id", profile.id);
    const trailId = matchTrail(activity.name, trails || []);
    if (trailId) row.trail_id = trailId;

    // Upsert (ignore if already imported)
    const { error: upErr } = await admin
      .from("rides")
      .upsert([row], { onConflict: "user_id,strava_activity_id", ignoreDuplicates: true });
    if (upErr) return Response.json({ ok: false, error: upErr.message }, { status: 500 });

    return Response.json({ ok: true, inserted: true });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
