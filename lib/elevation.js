// Sample a trail's stored polyline and fetch real-world elevations from the
// Open Topo Data public DEM. Free, no API key, but rate-limited so we
// aggressively cache the result on the trails row.
//
// Improvements vs. v1:
//   - Switched to "mapzen" dataset (combines SRTM + NED + others — better
//     than SRTM-only for mountainous MTB terrain).
//   - Uses the trail's full OSM polyline density up to 500 points, batched in
//     groups of 100, instead of resampling to a tiny 80.
//   - Applies 3-point moving-average smoothing + 1m noise threshold to remove
//     SRTM jitter that inflates spurious climb/descent totals.

const TOPO_URL = "https://api.opentopodata.org/v1/mapzen";
const MAX_PER_REQUEST = 100;     // Open Topo Data's per-request cap
const MAX_SAMPLES     = 500;      // hard cap — bigger requests, slower fetches
const NOISE_THRESHOLD_M = 1.0;    // dy below this is treated as flat

// Haversine distance in km between two {lat, lon} points.
function distKm(a, b) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Build cumulative-km array for the polyline.
function cumulativeKm(geometry) {
  const out = [0];
  for (let i = 1; i < geometry.length; i++) {
    out.push(out[i - 1] + distKm(geometry[i - 1], geometry[i]));
  }
  return out;
}

// Sample N evenly-spaced points along the polyline by cumulative distance.
// We use this when the polyline is denser than MAX_SAMPLES so we keep the
// request size bounded.
function evenSamples(geometry, n) {
  if (!Array.isArray(geometry) || geometry.length < 2) return [];
  const cum = cumulativeKm(geometry);
  const total = cum[cum.length - 1];
  if (total === 0) return [];

  const samples = [];
  for (let i = 0; i < n; i++) {
    const targetD = (i / (n - 1)) * total;
    let lo = 0, hi = cum.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (cum[mid] < targetD) lo = mid + 1;
      else hi = mid;
    }
    const idx = Math.max(1, lo);
    const a = geometry[idx - 1], b = geometry[idx];
    const segLen = cum[idx] - cum[idx - 1] || 1;
    const f = (targetD - cum[idx - 1]) / segLen;
    samples.push({
      km:  targetD,
      lat: a.lat + (b.lat - a.lat) * f,
      lon: a.lon + (b.lon - a.lon) * f,
    });
  }
  return samples;
}

// Use the original polyline points up to MAX_SAMPLES. If there are fewer
// natural points than 100 (sparse OSM line), interpolate up to 100 evenly.
function pickSamples(geometry) {
  if (!Array.isArray(geometry) || geometry.length < 2) return [];
  if (geometry.length > MAX_SAMPLES) return evenSamples(geometry, MAX_SAMPLES);
  if (geometry.length < 100)         return evenSamples(geometry, 100);
  const cum = cumulativeKm(geometry);
  return geometry.map((p, i) => ({ km: cum[i], lat: p.lat, lon: p.lon }));
}

async function fetchElevations(coords) {
  const out = new Array(coords.length);
  for (let i = 0; i < coords.length; i += MAX_PER_REQUEST) {
    const batch = coords.slice(i, i + MAX_PER_REQUEST);
    const locations = batch.map((p) => `${p.lat.toFixed(5)},${p.lon.toFixed(5)}`).join("|");
    const res = await fetch(`${TOPO_URL}?locations=${encodeURIComponent(locations)}`, {
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Open Topo Data HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    if (!Array.isArray(data?.results)) throw new Error("Bad response shape from Open Topo Data");
    for (let j = 0; j < batch.length; j++) {
      out[i + j] = data.results[j]?.elevation ?? null;
    }
  }
  return out;
}

// 3-point moving-average smoothing. Removes ±1m DEM jitter without affecting
// real climbs/descents.
function smooth(values) {
  if (values.length < 3) return values.slice();
  const out = new Array(values.length);
  out[0] = values[0];
  out[values.length - 1] = values[values.length - 1];
  for (let i = 1; i < values.length - 1; i++) {
    const a = values[i - 1], b = values[i], c = values[i + 1];
    if (a == null || b == null || c == null) { out[i] = b; continue; }
    out[i] = (a + b + c) / 3;
  }
  return out;
}

// Sum the upward / downward deltas, ignoring micro-noise below NOISE_THRESHOLD_M.
function climbDescent(elevs) {
  let climb = 0, descent = 0;
  let lastSignificant = null;
  for (const e of elevs) {
    if (e == null) continue;
    if (lastSignificant == null) { lastSignificant = e; continue; }
    const d = e - lastSignificant;
    if (Math.abs(d) < NOISE_THRESHOLD_M) continue;     // treat as flat
    if (d > 0) climb += d;
    else descent += -d;
    lastSignificant = e;
  }
  return { climb: Math.round(climb), descent: Math.round(descent) };
}

// Public entrypoint: takes a trail row, returns the cached profile or
// fetches + computes one and caches it.
//
// Returns: { samples: [{km, elev}], total_climb, total_descent, source, fetched_at }
// Or null if there's no geometry to work from.
//
// `force` skips the cache so we can recompute with improved logic.
// Profile sources we trust (in rough order of accuracy). Strava ride streams
// are the rider's actual GPS altitude — better than DEM for trails they've
// ridden. User-uploaded GPX is authoritative.
const TRUSTED_SOURCES = new Set([
  "gpx-upload",
  "strava-ride-streams",
  "opentopodata-mapzen-v2",
  "opentopodata-srtm30m",   // legacy v1 — keep returning cached data so the page works
]);

export async function getTrailElevationProfile(supabase, trail, { force = false } = {}) {
  if (!trail) return null;
  // Use any cached profile that has real samples and came from a known-good
  // source. We previously locked this to the current DEM dataset, which
  // accidentally rejected Strava-stream and GPX-upload profiles.
  if (!force && trail.elevation_profile?.samples?.length > 1
      && TRUSTED_SOURCES.has(trail.elevation_profile?.source)) {
    return trail.elevation_profile;
  }
  if (!Array.isArray(trail.geometry) || trail.geometry.length < 2) return null;

  const sampled = pickSamples(trail.geometry);
  if (sampled.length === 0) return null;

  const elevs = await fetchElevations(sampled.map((s) => ({ lat: s.lat, lon: s.lon })));
  const smoothed = smooth(elevs);

  // Filter to only non-null pairs for the final sample list.
  const cleanSamples = [];
  for (let i = 0; i < sampled.length; i++) {
    if (smoothed[i] != null) {
      cleanSamples.push({ km: +sampled[i].km.toFixed(3), elev: Math.round(smoothed[i]) });
    }
  }
  if (cleanSamples.length < 2) return null;

  const { climb, descent } = climbDescent(smoothed);

  const profile = {
    samples: cleanSamples,
    total_climb:   climb,
    total_descent: descent,
    source: "opentopodata-mapzen-v2",
    fetched_at: new Date().toISOString(),
  };

  await supabase.from("trails").update({ elevation_profile: profile }).eq("id", trail.id);
  return profile;
}
