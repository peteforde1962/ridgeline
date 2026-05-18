// /api/strava/webhook — auto-import + GPS detection + per-trail time.

import { adminClient } from "@/lib/supabase/admin";
import { ensureFreshToken, activityToRide } from "@/lib/strava";
import { detectTrailsForActivity } from "@/lib/trail-detection";

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

    if (links.length > 0) {
      await admin.from("ride_trails")
        .upsert(links, { onConflict: "ride_id,trail_id", ignoreDuplicates: false });
      const primary = detection.matches
        .slice().sort((a, b) => (b.points || 0) - (a.points || 0))[0];
      if (primary) {
        await admin.from("rides").update({ trail_id: primary.trailId }).eq("id", rideIns.id);
      }
      await admin.from("trails")
        .update({ last_ride: row.date })
        .in("id", detection.matches.map(m => m.trailId));
    }

    return Response.json({ ok: true, inserted: true, linkedTrails: links.length, source: detection.source });
  } catch (e) {
    return Response.json({ ok: false, error: e.message }, { status: 500 });
  }
}
