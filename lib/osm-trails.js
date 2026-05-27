// OpenStreetMap trail discovery via the Overpass API.
// Free, no auth. Searches for ways tagged for mountain biking near a coordinate.
//
// We look at three signals:
//   1. mtb:scale=*      — explicit MTB difficulty grade (S0-S5)
//   2. route=mtb        — relations or ways tagged as official MTB routes
//   3. highway=path/track + bicycle=yes/designated  — multi-use paths riders use
//
// Returns deduplicated trail-like records with name, difficulty, length (estimated), and center coords.

import polylineLength from "./polyline-length";

// Several public mirrors. We try them in order; first success wins.
// Update the User-Agent if you fork this — Overpass admins ask for an identifying string.
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",        // primary, MIT-Heidelberg
  "https://overpass.kumi.systems/api/interpreter",  // community mirror
  "https://overpass.private.coffee/api/interpreter", // newer, less-loaded
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter", // mail.ru fallback
];

const USER_AGENT = "RidgeLine-MTB/1.0 (https://ridgeline-mtb.ca; contact: pete.forde@gmail.com)";

// Popular MTB destinations with rough centroid coordinates.
export const REGIONS = [
  { id: "squamish",      label: "Squamish, BC",         lat: 49.7016,  lon: -123.1558 },
  { id: "whistler",      label: "Whistler, BC",         lat: 50.1163,  lon: -122.9574 },
  { id: "pemberton",     label: "Pemberton, BC",        lat: 50.3196,  lon: -122.8035 },
  { id: "northvan",      label: "North Vancouver, BC",  lat: 49.3200,  lon: -123.0735 },
  { id: "sea-to-sky",    label: "Sea-to-Sky corridor",  lat: 49.7800,  lon: -123.1500 },
  { id: "moab",          label: "Moab, UT",             lat: 38.5733,  lon: -109.5498 },
  { id: "sedona",        label: "Sedona, AZ",           lat: 34.8697,  lon: -111.7610 },
  { id: "fruita",        label: "Fruita, CO",           lat: 39.1589,  lon: -108.7287 },
  { id: "downieville",   label: "Downieville, CA",      lat: 39.5594,  lon: -120.8264 },
  { id: "bentonville",   label: "Bentonville, AR",      lat: 36.3729,  lon:  -94.2088 },
  { id: "asheville",     label: "Asheville, NC",        lat: 35.5951,  lon:  -82.5515 },
  { id: "park-city",     label: "Park City, UT",        lat: 40.6461,  lon: -111.4980 },
  { id: "crested-butte", label: "Crested Butte, CO",    lat: 38.8697,  lon: -106.9878 },
  { id: "rotorua",       label: "Rotorua, NZ",          lat: -38.1368, lon:  176.2497 },
  { id: "queenstown",    label: "Queenstown, NZ",       lat: -45.0312, lon:  168.6626 },
  { id: "finale",        label: "Finale Ligure, IT",    lat:  44.1700, lon:    8.3300 },
  { id: "morzine",       label: "Morzine, FR",          lat:  46.1797, lon:    6.7099 },
  { id: "innsbruck",     label: "Innsbruck, AT",        lat:  47.2692, lon:   11.4041 },
  { id: "derby",         label: "Derby, TAS",           lat: -41.1361, lon:  147.8014 },
];

export function getRegion(id) {
  return REGIONS.find((r) => r.id === id);
}

// Map OSM mtb:scale to our difficulty.
// Scale: S0 easy, S1 easy-mod, S2 moderate, S3 difficult, S4 very difficult, S5 expert.
function osmDifficulty(tags) {
  const s = tags["mtb:scale"];
  if (s != null) {
    const n = parseInt(s);
    if (n <= 0) return "Green";
    if (n === 1) return "Blue";
    if (n === 2) return "Blue";
    if (n === 3) return "Black";
    return "Double Black";
  }
  const sac = tags["sac_scale"];
  if (sac === "hiking") return "Green";
  if (sac === "mountain_hiking") return "Blue";
  if (sac === "demanding_mountain_hiking") return "Black";
  return "Blue"; // sensible default
}

// Build the Overpass QL query for MTB-relevant ways within `radiusKm` of (lat, lon).
// Broader query: includes paths/tracks tagged for bicycle as well as MTB-specific tags.
function buildQuery(lat, lon, radiusKm) {
  const radius = Math.round(radiusKm * 1000);
  return `[out:json][timeout:25];(way["mtb:scale"](around:${radius},${lat},${lon});way["route"="mtb"](around:${radius},${lat},${lon});way["highway"~"path|track|cycleway"]["name"]["bicycle"~"yes|designated|permissive"](around:${radius},${lat},${lon}););out tags geom 300;`;
}

export async function fetchOsmTrails({ lat, lon, radiusKm = 25 }) {
  const body = buildQuery(lat, lon, radiusKm);
  const errors = [];

  for (const endpoint of OVERPASS_ENDPOINTS) {
    // First try POST (best for big queries). If that fails with 403/405, try GET.
    for (const method of ["POST", "GET"]) {
      try {
        const res = await fetchOverpass(endpoint, body, method);
        if (!res.ok) {
          errors.push(`${endpoint} [${method}]: HTTP ${res.status}`);
          continue;
        }
        const data = await res.json();
        return normalizeTrails(data.elements || []);
      } catch (e) {
        errors.push(`${endpoint} [${method}]: ${e.message}`);
      }
    }
  }
  throw new Error("All Overpass mirrors failed. " + errors.join(" · "));
}

async function fetchOverpass(endpoint, query, method) {
  const headers = {
    "User-Agent": USER_AGENT,
    "Accept": "application/json",
  };
  if (method === "POST") {
    return fetch(endpoint, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
      body: "data=" + encodeURIComponent(query),
      cache: "no-store",
    });
  }
  // GET form — some mirrors only allow this
  const u = new URL(endpoint);
  u.searchParams.set("data", query);
  return fetch(u.toString(), { method: "GET", headers, cache: "no-store" });
}

function normalizeTrails(elements) {
  // Group by name so multiple OSM ways with the same trail name get merged.
  const byName = new Map();
  for (const el of elements) {
    if (!el.tags) continue;
    const name = el.tags.name || el.tags["mtb:name"];
    if (!name) continue; // skip nameless ways

    const entry = byName.get(name) || {
      id: el.id, name,
      length_m_sum: 0,
      tags: el.tags,
      lat: el.geometry?.[0]?.lat,
      lon: el.geometry?.[0]?.lon,
      geometryPoints: [],
    };
    if (el.geometry) {
      entry.length_m_sum += polylineLength(el.geometry);
      // Accumulate all points across all matching ways for spatial matching.
      entry.geometryPoints = entry.geometryPoints.concat(el.geometry);
    }
    byName.set(name, entry);
  }

  return Array.from(byName.values()).map((e) => ({
    id: e.id,
    name: e.name,
    difficulty: osmDifficulty(e.tags),
    length_km: e.length_m_sum > 0 ? +(e.length_m_sum / 1000).toFixed(2) : null,
    elev_m: null,
    description: e.tags.description || null,
    surface: e.tags.surface || null,
    lat: e.lat, lon: e.lon,
    geometry: e.geometryPoints,    // full coordinate list for GPS matching
  })).sort((a, b) => (b.length_km || 0) - (a.length_km || 0));
}

export function osmToTrailRow(osm, userId, regionLabel) {
  return {
    user_id: userId,
    name: osm.name,
    length_km: osm.length_km,
    elev_m:    osm.elev_m,
    difficulty: osm.difficulty,
    region: regionLabel || "Travel",
  };
}
