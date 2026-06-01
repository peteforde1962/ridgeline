// GET /api/trails/[id]/elevation — return the cached elevation profile for a
// trail; compute it from the stored OSM polyline on first request.

import { createClient } from "@/lib/supabase/server";
import { getTrailElevationProfile } from "@/lib/elevation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

    const { data: trail } = await supabase
      .from("trails").select("id, name, length_km, elev_m, geometry, elevation_profile")
      .eq("id", params.id).eq("user_id", user.id)
      .maybeSingle();
    if (!trail) return Response.json({ error: "Not found" }, { status: 404 });

    // ?refresh=1 forces a recompute (skips cache). Use after switching DEM
    // dataset or sampling logic so old cached profiles get refreshed.
    const force = new URL(_request.url).searchParams.get("refresh") === "1";
    const profile = await getTrailElevationProfile(supabase, trail, { force });
    if (!profile) return Response.json({ profile: null, reason: "no-geometry" });
    return Response.json({ profile });
  } catch (e) {
    return Response.json({ error: e.message, profile: null }, { status: 200 });
  }
}
