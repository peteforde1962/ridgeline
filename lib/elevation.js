// Sample a trail's stored polyline and fetch real-world elevations from the
// Open Topo Data public DEM. Free, no API key, but rate-limited so we
// aggressively cache the result on the trails row.
//
// Source: https://www.opentopodata.org/ — uses NASA SRTM 30m global DEM.

const TOPO_URL = "https://api.opentopodata.org/v1/srtm30m";
const MAX_PER_REQUEST = 100;     // their per-request cap
const TARGET_SAMPLES  = 80;       // points along the trail we want to plot

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

// Cumulative-distance based subsampling of the polyline → exactly N evenly-spaced points.
function evenSamples(geometry, n) {
  if (!Array.isArray(geometry) || geometry.length < 2) return [];
  // Cumulative distance.
  const cum = [0];
  for (let i = 1; i < geometry.length; i++) {
    cum.push(cum[i - 1] + distKm(geometry[i - 1], geometry[i]));
  }
  const total = cum[cum.length - 1];
  if (total === 0) return [];

  const samples = [];
  for (let i = 0; i < n; i++) {
    const targetD = (i / (n - 1)) * total;
    // Binary search for the segment containing targetD.
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

// Fetch elevations for a list of {lat, lon} points. Batches into ≤100 each.
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

// Public entrypoint: takes a trail row, returns the cached profile or
// fetches + computes one and caches it.
//
// Returns: { samples: [{km, elev}], total_climb, total_descent, source, fetched_at }
// Or null if there's no geometry to work from.
export async function getTrailElevationProfile(supabase, trail) {
  if (!trail) return null;
  // Cache hit?
  if (trail.elevation_profile?.samples?.length > 0) return trail.elevation_profile;
  // Need geometry to fetch real elevation.
  if (!Array.isArray(trail.geometry) || trail.geometry.length < 2) return null;

  const sampled = evenSamples(trail.geometry, TARGET_SAMPLES);
  if (sampled.length === 0) return null;

  const elevs = await fetchElevations(sampled.map((s) => ({ lat: s.lat, lon: s.lon })));
  const profile = {
    samples: sampled.map((s, i) => ({
      km:   +s.km.toFixed(3),
      elev: elevs[i] == null ? null : Math.round(elevs[i]),
    })).filter((p) => p.elev != null),
    source: "opentopodata-srtm30m",
    fetched_at: new Date().toISOString(),
  };
  if (profile.samples.length < 2) return null;

  // Compute climb / descent + min/max.
  let climb = 0, descent = 0;
  for (let i = 1; i < profile.samples.length; i++) {
    const d = profile.samples[i].elev - profile.samples[i - 1].elev;
    if (d > 0) climb += d;
    else descent += -d;
  }
  profile.total_climb   = Math.round(climb);
  profile.total_descent = Math.round(descent);

  // Cache it on the trail row.
  await supabase.from("trails").update({ elevation_profile: profile }).eq("id", trail.id);

  return profile;
}
