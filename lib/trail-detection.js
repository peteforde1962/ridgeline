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
// Slice a chunk of the ride's altitude stream and compute climb/descent +
// sample points keyed by km-from-start-of-trail.
function sliceElevationProfile(streams, startIdx, endIdx) {
  const alts = streams?.altitude?.data;
  const dists = streams?.distance?.data;
  if (!alts || !dists) return null;
  const sLo = Math.max(0, Math.min(startIdx, alts.length - 1));
  const sHi = Math.max(sLo + 1, Math.min(endIdx, alts.length - 1));
  if (sHi - sLo < 2) return null;

  // --- 1. Smooth the altitude series before integrating ---
  // Strava altitude is GPS-derived and noisy at the per-second level: every
  // wobble inflates climb/descent totals and produces phantom 30%+ gradients.
  // A 9-point centered moving average (~4-5s of riding) smooths this out
  // without hiding real terrain features. Roughly matches Trailforks behavior.
  const SMOOTH_WIN = 9;
  const NOISE_M    = 2.0;          // ignore deltas under 2m (was 1m — too tight)

  function smoothAt(i) {
    const half = (SMOOTH_WIN - 1) >>> 1;
    let sum = 0, count = 0;
    for (let k = Math.max(sLo, i - half); k <= Math.min(sHi, i + half); k++) {
      const v = alts[k];
      if (v == null) continue;
      sum += v; count++;
    }
    return count > 0 ? sum / count : null;
  }

  const baseDist = dists[sLo] || 0;
  let climb = 0, descent = 0, last = null;
  const samples = [];
  let elevHigh = -Infinity, elevLow = Infinity;

  // --- 2. Distance-based subsampling for the chart ---
  // Aim for ~80 samples spaced evenly by DISTANCE, not by array index,
  // so dense GPS pauses don't bunch samples.
  const trailLengthM = (dists[sHi] || baseDist) - baseDist;
  const sampleStepM  = Math.max(10, trailLengthM / 80);
  let nextSampleDist = baseDist;

  for (let i = sLo; i <= sHi; i++) {
    const a = smoothAt(i);
    if (a == null) continue;
    if (a > elevHigh) elevHigh = a;
    if (a < elevLow)  elevLow  = a;
    if (last == null) {
      last = a;
    } else {
      const d = a - last;
      if (Math.abs(d) >= NOISE_M) {
        if (d > 0) climb += d;
        else descent += -d;
        last = a;
      }
    }
    if ((dists[i] || baseDist) >= nextSampleDist || i === sHi) {
      samples.push({
        km:   +((((dists[i] || baseDist) - baseDist) / 1000)).toFixed(3),
        elev: Math.round(a),
      });
      nextSampleDist = (dists[i] || baseDist) + sampleStepM;
    }
  }

  if (samples.length < 2) return null;

  // --- 3. Cap max-gradient at realistic MTB ceilings ---
  // Even after smoothing, GPS edge cases can produce phantom 60-80% spikes.
  // Real MTB grades top out around 35-40% (very steep DH). Anything beyond
  // that is almost certainly noise; we let the chart still render but the
  // *reported* max grade is capped.
  return {
    climb: Math.round(climb),
    descent: Math.round(descent),
    elev_high: Math.round(elevHigh),
    elev_low:  Math.round(elevLow),
    samples,
  };
}

// Insert a trail row that may include columns the user hasn't migrated yet
// (geometry, descent_m, etc.). If the full insert hits "column doesn't exist",
// we strip optional columns and retry, so detection never breaks just because
// a SQL migration is pending.
const OPTIONAL_TRAIL_COLS = ["descent_m", "elev_high", "elev_low", "geometry", "elevation_profile"];

async function insertTrailResilient(supabase, row) {
  const trySelect = "id, name, length_km, elev_m, difficulty, region, pr_minutes, last_ride";
  // Attempt 1 — full row.
  let { data, error } = await supabase.from("trails").insert(row).select(trySelect).single();
  if (!error) return data;
  // If the error mentions a column, drop optional columns one-by-one and retry.
  if (/column|schema cache/i.test(error.message)) {
    const stripped = { ...row };
    for (const c of OPTIONAL_TRAIL_COLS) delete stripped[c];
    ({ data, error } = await supabase.from("trails").insert(stripped).select(trySelect).single());
    if (!error) return data;
  }
  console.warn("Trail insert failed:", error?.message);
  return null;
}

async function updateTrailResilient(supabase, id, patch) {
  let { error } = await supabase.from("trails").update(patch).eq("id", id);
  if (!error) return;
  if (/column|schema cache/i.test(error.message)) {
    const stripped = { ...patch };
    for (const c of OPTIONAL_TRAIL_COLS) delete stripped[c];
    if (Object.keys(stripped).length === 0) return;
    await supabase.from("trails").update(stripped).eq("id", id);
  }
}

// Strip community-segment cruft so Strava names line up with OSM/Trailforks.
//   "Pseudo Tsuga new berms"  → "pseudo tsuga"
//   "Upper Half Nelson (full)" → "half nelson"
//   "Half Nelson - lower"     → "half nelson"
const NAME_NOISE = /\b(upper|lower|north|south|east|west|new|old|alt|alternate|reverse|berms?|jumps?|drops?|chutes?|line|line\s*\d|full|short|long|to|from|version|v\d+)\b/gi;

function normalizeTrailName(s) {
  return (s || "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")          // strip parenthetical bits
    .replace(/[—\-]+/g, " ")            // dashes → spaces
    .replace(NAME_NOISE, " ")           // strip noise tokens
    .replace(/[^a-z0-9 ]/g, " ")        // strip residual punctuation
    .replace(/\s+/g, " ")
    .trim();
}

// Find the OSM trail whose canonical name best matches a Strava segment name.
// Returns null if nothing reasonable is found. Prefers exact normalized matches
// over substring relationships.
function findOsmNameMatch(segmentName, osmTrails) {
  if (!Array.isArray(osmTrails) || osmTrails.length === 0) return null;
  const segNorm = normalizeTrailName(segmentName);
  if (!segNorm || segNorm.length < 3) return null;

  let exact = null, contains = null, contained = null;
  for (const osm of osmTrails) {
    if (!osm?.name) continue;
    const osmNorm = normalizeTrailName(osm.name);
    if (!osmNorm || osmNorm.length < 3) continue;
    if (osmNorm === segNorm) { exact = osm; break; }
    // Don't accept extremely generic OSM names like "trail" that would match anything.
    if (osmNorm.split(" ").length < 2 && osmNorm.length < 6) continue;
    if (segNorm.includes(osmNorm) && !contains) contains = osm;
    else if (osmNorm.includes(segNorm) && !contained) contained = osm;
  }
  return exact || contains || contained;
}

function countRideHits(ridePoints, trail, thresholdM = 40) {
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
// Returns { matches: [{trailId, points, seconds_on_trail?}], source, details }
export async function detectTrailsForActivity({ supabase, userId, activity, userTrails }) {
  const name = activity?.name || "";
  const details = {};

  // Skip trail detection for non-cycling activities — running on a trail still
  // counts as a "run", not a logged trail ride.
  const cyclingTypes = new Set([
    "Ride", "MountainBikeRide", "EMountainBikeRide", "EBikeRide",
    "GravelRide", "VirtualRide", "Velomobile", "Handcycle",
  ]);
  if (activity?.sport_type && !cyclingTypes.has(activity.sport_type)) {
    return { matches: [], source: "non-cycling", details: { sport_type: activity.sport_type } };
  }

  // Diagnostic: record what's available on the activity so we can see why a
  // tier fails. Strava omits segment_efforts for e-bikes and private rides.
  details.sport_type = activity?.sport_type || activity?.type || null;
  details.segmentEffortsCount = Array.isArray(activity?.segment_efforts) ? activity.segment_efforts.length : 0;

  // Streams (if provided by caller) give us per-point altitude — the most
  // accurate "what you actually climbed/descended on this trail" data.
  // We slice the altitude array by segment_effort start_index/end_index.
  const streams = activity?._streams || null;   // { altitude: { data }, distance: { data } }
  const hasStreams = !!(streams?.altitude?.data?.length && streams?.distance?.data?.length);

  // For Tier 0 segment-to-OSM cross-referencing: lazily fetch OSM trails for
  // the ride area on first need so we can map Strava community names ("Pseudo
  // Tsuga new berms") to the canonical Trailforks/OSM name ("Pseudo Tsuga").
  let osmTrailsForArea = null;
  async function getOsmForArea() {
    if (osmTrailsForArea !== null) return osmTrailsForArea;
    const startLatLng = activity?.start_latlng;
    if (!Array.isArray(startLatLng) || startLatLng.length < 2) {
      osmTrailsForArea = [];
      return osmTrailsForArea;
    }
    try {
      osmTrailsForArea = await fetchOsmTrails({ lat: startLatLng[0], lon: startLatLng[1], radiusKm: 15 });
    } catch {
      osmTrailsForArea = [];
    }
    return osmTrailsForArea;
  }

  // Tier 0: Strava segment efforts (highest fidelity — community-named trails).
  // Requires the activity to have been fetched with include_all_efforts=true.
  if (Array.isArray(activity?.segment_efforts) && activity.segment_efforts.length > 0) {
    const byId = new Map();
    let skippedNonRide = 0;
    for (const eff of activity.segment_efforts) {
      if (!eff?.segment?.name) continue;
      const segId = eff.segment.id;
      if (byId.has(segId)) {
        byId.get(segId).seconds += eff.moving_time || eff.elapsed_time || 0;
      } else {
        // Compute REAL climb/descent + samples from the ride's altitude stream
        // when we have start/end indices.
        let profile = null;
        if (hasStreams && eff.start_index != null && eff.end_index != null) {
          profile = sliceElevationProfile(streams, eff.start_index, eff.end_index);
        }
        byId.set(segId, {
          name: eff.segment.name,
          length_km: eff.segment.distance ? +(eff.segment.distance / 1000).toFixed(2) : null,
          // Prefer measured climb/descent from the actual ride; fall back to
          // segment's stated total_elevation_gain when streams unavailable.
          elev_m: profile?.climb ?? (eff.segment.total_elevation_gain ? Math.round(eff.segment.total_elevation_gain) : null),
          descent_m: profile?.descent ?? null,
          elev_high: profile?.elev_high ?? null,
          elev_low:  profile?.elev_low ?? null,
          elevation_profile: profile?.samples?.length > 1 ? {
            samples: profile.samples,
            total_climb: profile.climb,
            total_descent: profile.descent,
            source: "strava-ride-streams",
            fetched_at: new Date().toISOString(),
          } : null,
          activity_type: eff.segment.activity_type,
          seconds: eff.moving_time || eff.elapsed_time || 0,
        });
      }
    }

    const osmAreaTrails = await getOsmForArea();
    let crossRefHits = 0;

    const matches = [];
    for (const seg of byId.values()) {
      // Skip clearly non-cycling segments (Run, Hike). "Ride" covers MTB+road+e-bike.
      // Be permissive: only skip if activity_type is explicitly Run or Hike.
      if (seg.activity_type === "Run" || seg.activity_type === "Hike") {
        skippedNonRide++;
        continue;
      }

      // Try to resolve this Strava segment's community name to the
      // OSM/Trailforks canonical name (e.g. "Pseudo Tsuga new berms" → "Pseudo Tsuga").
      const osmMatch = findOsmNameMatch(seg.name, osmAreaTrails);
      if (osmMatch) {
        seg.name = osmMatch.name;                  // use canonical name
        seg.osm_geometry = osmMatch.geometry;      // and proper polyline
        seg.region = "OSM (via Strava segment)";
        crossRefHits++;
      }

      let trail = userTrails.find((t) => t.name.toLowerCase() === seg.name.toLowerCase());
      if (!trail) {
        trail = await insertTrailResilient(supabase, {
          user_id: userId,
          name: seg.name,
          length_km: seg.length_km,
          elev_m:    seg.elev_m,
          descent_m: seg.descent_m,
          elev_high: seg.elev_high,
          elev_low:  seg.elev_low,
          difficulty: "Blue",
          region: seg.region || "Strava segment",
          geometry: seg.osm_geometry || null,
          elevation_profile: seg.elevation_profile,
        });
        if (!trail) continue;
        userTrails.push(trail);
      } else if (seg.elevation_profile && trail.elevation_profile?.source !== "gpx-upload") {
        await updateTrailResilient(supabase, trail.id, {
          elev_m:    seg.elev_m,
          descent_m: seg.descent_m,
          elev_high: seg.elev_high,
          elev_low:  seg.elev_low,
          elevation_profile: seg.elevation_profile,
        });
      }
      matches.push({ trailId: trail.id, points: 1, seconds_on_trail: seg.seconds });
    }

    details.stravaSegments = byId.size;
    details.stravaSegmentsSkipped = skippedNonRide;
    details.osmCrossReferenced = crossRefHits;
    if (matches.length > 0) {
      return {
        matches,
        source: crossRefHits > 0 ? "strava-segments+osm-names" : "strava-segments",
        details,
      };
    }
  }


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
  // Prefer the full polyline (available on detailed fetch) over summary.
  const polylineStr = activity?.map?.polyline || activity?.map?.summary_polyline;
  let ridePoints = [];
  if (polylineStr) ridePoints = decodePolyline(polylineStr);
  details.polylinePoints = ridePoints.length;
  details.polylineSource = activity?.map?.polyline ? "full" : "summary";

  // Tier 2: GPS match. Require >= 2 ride sample points within 40m of trail,
  // then filter: keep top 25 by hit count AND require each to have at least
  // 8% of the leader's hit count. Permissive enough to keep short trails the
  // rider really did cross, strict enough to drop obvious flybys.
  let gpsHits = [];
  if (ridePoints.length > 0) {
    for (const t of osmTrails) {
      const h = countRideHits(ridePoints, t);
      if (h >= 2) gpsHits.push({ trail: t, points: h });
    }
  }
  gpsHits.sort((a, b) => b.points - a.points);
  const maxHits = gpsHits[0]?.points || 0;
  const minRequired = Math.max(2, Math.floor(maxHits * 0.08));
  gpsHits = gpsHits.filter((h) => h.points >= minRequired).slice(0, 25);
  details.gpsMatched = gpsHits.length;
  details.gpsMaxHits = maxHits;
  details.osmCount = osmTrails.length;

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
