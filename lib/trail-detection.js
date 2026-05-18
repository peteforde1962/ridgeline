// Auto-detect trails for a ride.
//
// Three tiers, in order:
//   1. Name match against the user's existing trails.
//   2. GPS match — decode Strava polyline, find OSM trails the ride physically passed.
//   3. Name match against nearby OSM trails (fallback for activities with descriptive names).
//
// For OSM matches not already in the user's trails, we auto-import them so they
// show up under "Trails you've ridden".

import { matchTrails } from "@/lib/trail-match";
import { fetchOsmTrails, osmToTrailRow } from "@/lib/osm-trails";
import { decodePolyline } from "@/lib/polyline-decode";

// --- spatial helpers ---
function haversineM(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function bbox(points) {
  let n = -90, s = 90, e = -180, w = 180;
  for (const p of points) {
    if (p.lat > n) n = p.lat;
    if (p.lat < s) s = p.lat;
    if (p.lon > e) e = p.lon;
    if (p.lon < w) w = p.lon;
  }
  return { n, s, e, w };
}

function bboxOverlap(a, b, pad = 0.001) {
  return !(a.e + pad < b.w || a.w - pad > b.e || a.n + pad < b.s || a.s - pad > b.n);
}

// Did the ride physically pass over this trail? Returns true if at least
// `minHits` sampled ride points are within `thresholdM` meters of trail geometry.
function rideOverlapsTrail(ridePoints, trail, thresholdM = 40, minHits = 3) {
  if (!trail.geometry || trail.geometry.length === 0) return false;

  const rBox = bbox(ridePoints);
  const tBox = bbox(trail.geometry);
  if (!bboxOverlap(rBox, tBox)) return false;

  // Sample ride polyline to speed up checking (~every 5th point).
  const sampled = ridePoints.filter((_, i) => i % 5 === 0);

  let hits = 0;
  for (const rp of sampled) {
    for (const tp of trail.geometry) {
      if (haversineM(rp, tp) < thresholdM) {
        hits++;
        if (hits >= minHits) return true;
        break; // move on to next ride point
      }
    }
  }
  return false;
}

// --- main entry ---
export async function detectTrailsForActivity({ supabase, userId, activity, userTrails }) {
  const name = activity?.name || "";
  const details = {};

  // Tier 1: existing user trails by name.
  const localMatches = matchTrails(name, userTrails);
  if (localMatches.length > 0) {
    return { trailIds: localMatches, source: "user-trails", details: { count: localMatches.length } };
  }

  // Need start coords for OSM query.
  const startLatLng = activity?.start_latlng;
  if (!Array.isArray(startLatLng) || startLatLng.length < 2) {
    return { trailIds: [], source: "no-coords", details };
  }
  const [lat, lon] = startLatLng;
  if (typeof lat !== "number" || typeof lon !== "number") {
    return { trailIds: [], source: "bad-coords", details };
  }

  // Fetch OSM trails near the start. 15 km is usually plenty for an MTB ride.
  let osmTrails;
  try {
    osmTrails = await fetchOsmTrails({ lat, lon, radiusKm: 15 });
  } catch (e) {
    return { trailIds: [], source: "osm-error", details: { error: e.message } };
  }
  details.osmCount = osmTrails?.length || 0;
  if (!osmTrails || osmTrails.length === 0) {
    return { trailIds: [], source: "no-osm", details };
  }

  // Tier 2: GPS match using Strava polyline.
  const polylineStr = activity?.map?.summary_polyline || activity?.map?.polyline;
  let gpsMatched = [];
  if (polylineStr) {
    const ridePoints = decodePolyline(polylineStr);
    details.polylinePoints = ridePoints.length;
    if (ridePoints.length > 0) {
      gpsMatched = osmTrails.filter((t) => rideOverlapsTrail(ridePoints, t));
    }
  } else {
    details.polylinePoints = 0;
  }
  details.gpsMatched = gpsMatched.length;

  // Tier 3: name match against OSM.
  const nameMatched = osmTrails.filter((t) => matchTrails(name, [t]).length > 0);
  details.nameMatched = nameMatched.length;

  // Union of GPS + name hits.
  const combinedById = new Map();
  for (const t of [...gpsMatched, ...nameMatched]) combinedById.set(t.id, t);
  const matched = Array.from(combinedById.values());

  if (matched.length === 0) {
    return { trailIds: [], source: "no-match", details };
  }

  // Auto-import any matches not already in user's trails.
  const finalIds = [];
  for (const osm of matched) {
    const existing = userTrails.find((t) => t.name === osm.name);
    if (existing) {
      finalIds.push(existing.id);
      continue;
    }
    const row = osmToTrailRow(osm, userId, "Auto-imported");
    const { data, error } = await supabase
      .from("trails")
      .insert(row)
      .select("id, name, length_km, elev_m, difficulty, region, pr_minutes, last_ride")
      .single();
    if (error) continue;
    finalIds.push(data.id);
    userTrails.push(data); // cache for subsequent activities in this run
  }

  return {
    trailIds: finalIds,
    source: gpsMatched.length > 0 ? (nameMatched.length > 0 ? "gps+name" : "gps") : "name",
    details,
  };
}
