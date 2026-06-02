// POST /api/trails/[id]/upload-gpx
// Accepts a GPX file (Trailforks / Strava / Garmin / etc) and uses its
// authoritative track + elevation data to overwrite the trail's geometry,
// length, climb, descent, and elevation profile.

import { createClient } from "@/lib/supabase/server";
import { parseGpxTrack } from "@/lib/gpx-parse";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_GPX_BYTES = 10 * 1024 * 1024; // 10 MB sanity cap

export async function POST(request, { params }) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

    // Trail must belong to the requester (RLS would also block, but we want
    // a clean 404 instead of a confusing empty update).
    const { data: trail } = await supabase
      .from("trails").select("id, name")
      .eq("id", params.id).eq("user_id", user.id)
      .maybeSingle();
    if (!trail) return Response.json({ error: "Trail not found" }, { status: 404 });

    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return Response.json({ error: "No file uploaded" }, { status: 400 });
    }
    if (file.size > MAX_GPX_BYTES) {
      return Response.json({ error: "File too large (max 10 MB)" }, { status: 400 });
    }

    const text = await file.text();
    const parsed = parseGpxTrack(text);
    if (!parsed) {
      return Response.json({ error: "No track points found in this GPX file" }, { status: 400 });
    }

    const profile = {
      samples: parsed.samples,
      total_climb:   parsed.total_climb,
      total_descent: parsed.total_descent,
      source: "gpx-upload",
      fetched_at: new Date().toISOString(),
      point_count: parsed.point_count,
    };

    const patch = {
      geometry: parsed.geometry,
      length_km: parsed.length_km,
      elev_m: parsed.total_climb,
      descent_m: parsed.total_descent,
      elev_high: parsed.elev_high,
      elev_low:  parsed.elev_low,
      elevation_profile: profile,
    };

    const { error } = await supabase.from("trails").update(patch).eq("id", params.id);
    if (error) return Response.json({ error: error.message }, { status: 500 });

    return Response.json({
      ok: true,
      trail: trail.name,
      length_km: parsed.length_km,
      climb: parsed.total_climb,
      descent: parsed.total_descent,
      points: parsed.point_count,
      has_elevation: parsed.samples.length > 0,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
