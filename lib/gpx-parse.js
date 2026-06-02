// Minimal GPX track parser — extracts <trkpt> elements with lat/lon/ele.
// Works with Trailforks, Strava, Garmin Connect exports, etc.
// We don't need full XML parsing; trkpt regex is robust enough for the
// well-formed GPX every exporter produces.

const TRKPT_RE = /<trkpt[^>]*\blat\s*=\s*"([-0-9.]+)"[^>]*\blon\s*=\s*"([-0-9.]+)"[^>]*>([\s\S]*?)<\/trkpt>/gi;
const ELE_RE = /<ele[^>]*>\s*([-0-9.]+)\s*<\/ele>/i;
const NAME_RE = /<name[^>]*>\s*([^<]+?)\s*<\/name>/i;

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

const NOISE_THRESHOLD_M = 1.0;

function climbDescent(elevs) {
  let climb = 0, descent = 0;
  let last = null;
  for (const e of elevs) {
    if (e == null || isNaN(e)) continue;
    if (last == null) { last = e; continue; }
    const d = e - last;
    if (Math.abs(d) < NOISE_THRESHOLD_M) continue;
    if (d > 0) climb += d;
    else descent += -d;
    last = e;
  }
  return { climb: Math.round(climb), descent: Math.round(descent) };
}

// Public: parse a GPX file string and return geometry + elevation profile.
// Returns null if the file has no usable track points.
export function parseGpxTrack(text) {
  const points = [];
  let m;
  TRKPT_RE.lastIndex = 0;
  while ((m = TRKPT_RE.exec(text)) !== null) {
    const lat = parseFloat(m[1]);
    const lon = parseFloat(m[2]);
    const eleMatch = m[3].match(ELE_RE);
    const ele = eleMatch ? parseFloat(eleMatch[1]) : null;
    if (!isNaN(lat) && !isNaN(lon)) {
      points.push({ lat, lon, ele: isNaN(ele) ? null : ele });
    }
  }
  if (points.length < 2) return null;

  // Track name (first <name> in the file — usually the track name).
  const nameMatch = text.match(NAME_RE);
  const trackName = nameMatch ? nameMatch[1] : null;

  // Cumulative distance.
  const cum = [0];
  for (let i = 1; i < points.length; i++) {
    cum.push(cum[i - 1] + distKm(points[i - 1], points[i]));
  }
  const lengthKm = cum[cum.length - 1];

  // Elevation series + climb/descent.
  const elevs = points.map((p) => p.ele);
  const hasElevation = elevs.some((e) => e != null);
  const { climb, descent } = hasElevation ? climbDescent(elevs) : { climb: 0, descent: 0 };

  // Build sample list for the chart: [{km, elev}, ...]
  const samples = [];
  for (let i = 0; i < points.length; i++) {
    if (elevs[i] != null) {
      samples.push({ km: +cum[i].toFixed(3), elev: Math.round(elevs[i]) });
    }
  }

  // Elev high / low for trail-level stats.
  const validElevs = elevs.filter((e) => e != null);
  const elevHigh = validElevs.length ? Math.round(Math.max(...validElevs)) : null;
  const elevLow  = validElevs.length ? Math.round(Math.min(...validElevs)) : null;

  return {
    trackName,
    geometry: points.map((p) => ({ lat: +p.lat.toFixed(6), lon: +p.lon.toFixed(6) })),
    length_km: +lengthKm.toFixed(2),
    total_climb: climb,
    total_descent: descent,
    elev_high: elevHigh,
    elev_low:  elevLow,
    samples,
    point_count: points.length,
  };
}
