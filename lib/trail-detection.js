// Auto-detect trails for a ride.
// 1. Try matching the activity name against the user's already-saved trails.
// 2. If no matches, fetch OSM trails near the ride's start coords and match against those.
// 3. For OSM matches that aren't yet in the user's trails table, auto-import them.
// 4. Return the final array of user-trail ids that should be linked to this ride.

import { matchTrails } from "@/lib/trail-match";
import { fetchOsmTrails, osmToTrailRow } from "@/lib/osm-trails";

export async function detectTrailsForActivity({ supabase, userId, activity, userTrails }) {
  const name = activity?.name || "";

  // Tier 1: existing user trails.
  const localMatches = matchTrails(name, userTrails);
  if (localMatches.length > 0) {
    return { trailIds: localMatches, source: "user-trails" };
  }

  // Need start coordinates to query OSM.
  const startLatLng = activity?.start_latlng || activity?.start_latitude && [activity.start_latitude, activity.start_longitude];
  if (!Array.isArray(startLatLng) || startLatLng.length < 2) {
    return { trailIds: [], source: "no-coords" };
  }
  const [lat, lon] = startLatLng;
  if (typeof lat !== "number" || typeof lon !== "number") {
    return { trailIds: [], source: "bad-coords" };
  }

  // Tier 2: ask OSM for nearby MTB trails, match by name.
  let osmTrails;
  try {
    osmTrails = await fetchOsmTrails({ lat, lon, radiusKm: 15 });
  } catch (e) {
    return { trailIds: [], source: "osm-error", error: e.message };
  }
  if (!osmTrails || osmTrails.length === 0) {
    return { trailIds: [], source: "no-osm" };
  }

  const osmMatches = matchTrails(name, osmTrails);
  if (osmMatches.length === 0) {
    return { trailIds: [], source: "no-name-match", osmCount: osmTrails.length };
  }

  // Auto-import OSM matches that aren't already in the user's trails.
  const matchedOsm = osmTrails.filter((t) => osmMatches.includes(t.id));
  const finalIds = [];
  const regionLabel = "Travel";
  for (const osm of matchedOsm) {
    // Check if user already has a trail with this name.
    const existing = userTrails.find((t) => t.name === osm.name);
    if (existing) {
      finalIds.push(existing.id);
      continue;
    }
    // Import it.
    const row = osmToTrailRow(osm, userId, regionLabel);
    const { data, error } = await supabase
      .from("trails")
      .insert(row)
      .select("id, name, length_km, elev_m, difficulty, region, pr_minutes, last_ride")
      .single();
    if (error) continue;
    finalIds.push(data.id);
    userTrails.push(data); // cache for subsequent activities in the same sync
  }

  return { trailIds: finalIds, source: "osm-import" };
}
