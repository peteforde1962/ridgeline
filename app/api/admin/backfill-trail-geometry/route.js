// POST /api/admin/backfill-trail-geometry
// For each trail without stored geometry, query OSM Overpass for a way that
// matches the trail name within ~15km of any ride that referenced this trail.
// Save the polyline back onto the trail row.
//
// Processes a batch per call (default 20) and returns a summary so the client
// can loop until "remaining" hits zero, sidestepping Vercel's 60s function cap.

import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { fetchOsmTrails } from "@/lib/osm-trails";

export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH_SIZE = 20;
const SEARCH_RADIUS_KM = 15;

export async function POST(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

    const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
    if (!me?.is_admin) return Response.json({ error: "Admins only" }, { status: 403 });

    const admin = adminClient();

    // Trails missing geometry, oldest first so we backfill the long tail.
    const { data: trails } = await admin.from("trails")
      .select("id, user_id, name, region")
      .is("geometry", null)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    // Total still missing (for the "remaining" count).
    const { count: stillMissing } = await admin.from("trails")
      .select("id", { count: "exact", head: true })
      .is("geometry", null);

    const results = { processed: 0, succeeded: 0, no_rides: 0, no_osm_match: 0, errors: [] };

    for (const trail of (trails || [])) {
      results.processed++;
      try {
        // Find a ride linked to this trail to anchor the OSM search.
        const { data: rideLink } = await admin
          .from("ride_trails")
          .select("rides!inner(start_lat, start_lon)")
          .eq("trail_id", trail.id)
          .not("rides.start_lat", "is", null)
          .limit(1)
          .maybeSingle();

        const lat = rideLink?.rides?.start_lat;
        const lon = rideLink?.rides?.start_lon;
        if (lat == null || lon == null) {
          results.no_rides++;
          continue;
        }

        // Query OSM near the ride's start point.
        const osmTrails = await fetchOsmTrails({ lat, lon, radiusKm: SEARCH_RADIUS_KM });
        const lower = trail.name.toLowerCase().trim();
        const match = osmTrails.find((o) =>
          o.name && o.name.toLowerCase().trim() === lower
        );
        if (!match || !match.geometry || match.geometry.length < 2) {
          results.no_osm_match++;
          continue;
        }

        await admin.from("trails")
          .update({ geometry: match.geometry })
          .eq("id", trail.id);
        results.succeeded++;
      } catch (e) {
        results.errors.push({ trail: trail.name, error: e.message });
      }
    }

    const remaining = Math.max(0, (stillMissing || 0) - results.succeeded);
    return Response.json({ ok: true, remaining, ...results });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
