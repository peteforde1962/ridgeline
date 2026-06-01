// POST /api/admin/backfill-trail-geometry
// For each trail without stored geometry, query OSM Overpass for a way that
// matches the trail name. Anchor priority:
//   1. Trail's region label maps to a known region centroid
//   2. A linked ride's start_lat/start_lon
//   3. A linked ride's polyline (first decoded point)
// Save the polyline back onto the trail row.
//
// Body: { skipIds?: [trail_id...] }  — IDs to exclude from this batch so the
// client can keep paging through trails that have been tried-and-failed
// without re-trying them every cycle.

import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { fetchOsmTrails, REGIONS } from "@/lib/osm-trails";
import { decodePolyline } from "@/lib/polyline-decode";

export const runtime = "nodejs";
export const maxDuration = 60;

const BATCH_SIZE = 20;
const SEARCH_RADIUS_KM = 15;

// Look up centroid for a stored region label like "Squamish, BC".
function regionCentroid(regionLabel) {
  if (!regionLabel) return null;
  const lc = regionLabel.toLowerCase();
  const hit = REGIONS.find((r) =>
    r.label.toLowerCase() === lc || r.id === lc || lc.includes(r.id)
  );
  return hit ? { lat: hit.lat, lon: hit.lon } : null;
}

// Decode the first valid point off a stored ride polyline.
function firstPolylinePoint(polylineStr) {
  if (!polylineStr) return null;
  try {
    const pts = decodePolyline(polylineStr);
    return pts?.[0] ? { lat: pts[0].lat, lon: pts[0].lon } : null;
  } catch {
    return null;
  }
}

export async function POST(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

    const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
    if (!me?.is_admin) return Response.json({ error: "Admins only" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const skipIds = Array.isArray(body.skipIds) ? body.skipIds : [];

    const admin = adminClient();

    // Trails missing geometry, oldest first, EXCLUDING the ones the client says
    // they've already tried in this session.
    let query = admin.from("trails")
      .select("id, user_id, name, region")
      .is("geometry", null)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);
    if (skipIds.length > 0) query = query.not("id", "in", `(${skipIds.join(",")})`);
    const { data: trails } = await query;

    // Total still missing (so the client can show "N remaining" honestly).
    const { count: stillMissing } = await admin.from("trails")
      .select("id", { count: "exact", head: true })
      .is("geometry", null);

    const results = {
      processed: 0, succeeded: 0,
      no_anchor: 0, no_osm_match: 0,
      filled_ids: [], failed_ids: [],
      errors: [],
    };

    for (const trail of (trails || [])) {
      results.processed++;
      try {
        // --- pick an anchor ---
        let anchor = regionCentroid(trail.region);

        if (!anchor) {
          // Try a linked ride with start coords.
          const { data: rideLink } = await admin
            .from("ride_trails")
            .select("rides!inner(start_lat, start_lon, polyline)")
            .eq("trail_id", trail.id)
            .limit(1)
            .maybeSingle();
          const r = rideLink?.rides;
          if (r?.start_lat != null && r?.start_lon != null) {
            anchor = { lat: r.start_lat, lon: r.start_lon };
          } else if (r?.polyline) {
            anchor = firstPolylinePoint(r.polyline);
          }
        }

        if (!anchor) {
          results.no_anchor++;
          results.failed_ids.push(trail.id);
          continue;
        }

        // --- OSM query ---
        const osmTrails = await fetchOsmTrails({
          lat: anchor.lat, lon: anchor.lon, radiusKm: SEARCH_RADIUS_KM,
        });
        const lower = trail.name.toLowerCase().trim();
        const match = osmTrails.find((o) =>
          o.name && o.name.toLowerCase().trim() === lower
        );
        if (!match || !match.geometry || match.geometry.length < 2) {
          results.no_osm_match++;
          results.failed_ids.push(trail.id);
          continue;
        }

        await admin.from("trails")
          .update({ geometry: match.geometry })
          .eq("id", trail.id);
        results.succeeded++;
        results.filled_ids.push(trail.id);
      } catch (e) {
        results.errors.push({ trail: trail.name, error: e.message });
        results.failed_ids.push(trail.id);
      }
    }

    const remaining = Math.max(0, (stillMissing || 0) - results.succeeded);
    return Response.json({ ok: true, remaining, ...results });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
