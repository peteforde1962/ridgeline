// Auto-detect trails for a ride.
// Tiers:
//   1. Name match against user's existing trails.
//   2. GPS match — Strava polyline against OSM trail geometries.
//   3. Name match against nearby OSM trails (fallback).
//
// Returns trail ids AND per-trail point counts so the caller can compute
// estimated time spent on each trail.

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

// Count the sampled ride points that fall within thresholdM of any point in
// the trail geometry. Returns the hit count (0 means "not ridden").
function countRideHits(ridePoints, trail, thresholdM = 60) {
  if (!trail.geometry || trail.geometry.length === 0) return 0;
  const tBox = bbox(trail.geometry);
  const rBox = bbox(ridePoints);
  if (!bboxOverlap(rBox, tBox)) return 0;

  // Sample every 5th ride point — keeps it fast on long rides.
  const sampled = ridePoints.filter((_, i) => i % 5 === 0);
  let hits = 0;
  for (const rp of sampled) {
    for (const tp of trail.geometry) {
      if (haversineM(rp, tp) < thresholdM) {
        hits++;
        break; // count this ride point once, move on
      }
    }
  }
  return hits;
}

// --- main entry ---
// Returns { matches: [{trailId, points}], source, details }
export async function detectTrailsForActivity({ supabase, userId, activity, userTrails }) {
  const name = activity?.name || "";
  const details = {};

  // Tier 1: name match against user's saved trails.
  const localIds = matchTrails(name, userTrails);
  if (localIds.length > 0) {
    return {
      matches: localIds.map((id) => ({ trailId: id, points: 0 })),
      source: "user-trails",
      details: { count: localIds.length },
    };
  }

  // Need start coords for OSM query.
  const startLatLng = activity?.start_latlng;
  if (!Array.isArray(startLatLng) || startLatLng.length < 2) {
    return { matches: [], source: "no-coords", details };
  }
  const [lat, lon] = startLatLng;
  if (typeof lat !== "number" || typeof lon !== "number") {
    return { matches: [], source: "bad-coords", details };
  }

  let osmTrails;
  try {
    osmTrails = await fetchOsmTrails({ lat, lon, radiusKm: 15 });
  } catch (e) {
    return { matches: [], source: "osm-error", details: { error: e.message } };
  }
  details.osmCount = osmTrails?.length || 0;
  if (!osmTrails || osmTrails.length === 0) {
    return { matches: [], source: "no-osm", details };
  }

  // Decode ride polyline (needed for GPS matching + per-trail time).
  const polylineStr = activity?.map?.summary_polyline || activity?.map?.polyline;
  let ridePoints = [];
  if (polylineStr) ridePoints = decodePolyline(polylineStr);
  details.polylinePoints = ridePoints.length;

  // Tier 2: GPS match. Hit-count >= 2 within 60m = "ridden" (looser threshold
  // since OSM data has small alignment errors and we don't want to miss trails).
  const gpsHits = [];
  if (ridePoints.length > 0) {
    for (const t of osmTrails) {
      const h = countRideHits(ridePoints, t);
      if (h >= 2) gpsHits.push({ trail: t, points: h });
    }
  }
  details.gpsMatched = gpsHits.length;

  // Tier 3: name match against OSM.
  const nameMatched = osmTrails.filter((t) => matchTrails(name, [t]).length > 0);
  details.nameMatched = nameMatched.length;

  // Union — prefer GPS counts if both tiers found the same trail.
  const merged = new Map();
  for (const { trail, points } of gpsHits) merged.set(trail.id, { trail, points });
  for (const t of nameMatched) if (!merged.has(t.id)) merged.set(t.id, { trail: t, points: 0 });

  if (merged.size === 0) {
    return { matches: [], source: "no-match", details };
  }

  // Auto-import any matches not already in user's trails.
  const matches = [];
  for (const { trail: osm, points } of merged.values()) {
    const existing = userTrails.find((t) => t.name === osm.name);
    if (existing) {
      matches.push({ trailId: existing.id, points });
      continue;
    }
    const row = osmToTrailRow(osm, userId, "Auto-imported");
    const { data, error } = await supabase
      .from("trails").insert(row)
      .select("id, name, length_km, elev_m, difficulty, region, pr_minutes, last_ride")
      .single();
    if (error) continue;
    matches.push({ trailId: data.id, points });
    userTrails.push(data);
  }

  return {
    matches,
    source: gpsHits.length > 0 ? (nameMatched.length > 0 ? "gps+name" : "gps") : "name",
    details,
  };
}
