// MTB Project API client (https://www.mtbproject.com/data).
// Server-side only — uses MTB_PROJECT_KEY from env.
//
// Note: MTB Project's API is free for non-commercial use; sign up at
// https://www.mtbproject.com/data to get a key.

const BASE = "https://www.mtbproject.com/data";

// Popular MTB destinations with rough centroid coordinates.
// Add more here over time; this is just the seed list shown in the picker.
export const REGIONS = [
  { id: "squamish",    label: "Squamish, BC",          lat: 49.7016, lon: -123.1558 },
  { id: "whistler",    label: "Whistler, BC",          lat: 50.1163, lon: -122.9574 },
  { id: "pemberton",   label: "Pemberton, BC",         lat: 50.3196, lon: -122.8035 },
  { id: "northvan",    label: "North Vancouver, BC",   lat: 49.3200, lon: -123.0735 },
  { id: "moab",        label: "Moab, UT",              lat: 38.5733, lon: -109.5498 },
  { id: "sedona",      label: "Sedona, AZ",            lat: 34.8697, lon: -111.7610 },
  { id: "fruita",      label: "Fruita, CO",            lat: 39.1589, lon: -108.7287 },
  { id: "downieville", label: "Downieville, CA",       lat: 39.5594, lon: -120.8264 },
  { id: "bentonville", label: "Bentonville, AR",       lat: 36.3729, lon: -94.2088 },
  { id: "asheville",   label: "Asheville, NC",         lat: 35.5951, lon: -82.5515 },
  { id: "park-city",   label: "Park City, UT",         lat: 40.6461, lon: -111.4980 },
  { id: "crested-butte", label: "Crested Butte, CO",   lat: 38.8697, lon: -106.9878 },
  { id: "rotorua",     label: "Rotorua, NZ",           lat: -38.1368, lon: 176.2497 },
  { id: "queenstown",  label: "Queenstown, NZ",        lat: -45.0312, lon: 168.6626 },
  { id: "finale",      label: "Finale Ligure, IT",     lat: 44.1700, lon: 8.3300 },
  { id: "morzine",     label: "Morzine, FR",           lat: 46.1797, lon: 6.7099 },
  { id: "innsbruck",   label: "Innsbruck, AT",         lat: 47.2692, lon: 11.4041 },
  { id: "derby",       label: "Derby, TAS",            lat: -41.1361, lon: 147.8014 },
  { id: "tokyo",       label: "Tokyo area, JP",        lat: 35.6762, lon: 139.6503 },
  { id: "moose-jaw",   label: "Hardwood Hills, ON",    lat: 44.5300, lon: -79.6500 },
];

export function getRegion(id) {
  return REGIONS.find(r => r.id === id);
}

// Fetch up to `maxResults` trails within `maxDistance` km of (lat, lon).
// MTB Project's maxDistance is in MILES, so we convert.
export async function fetchNearbyTrails({ lat, lon, maxDistanceKm = 50, maxResults = 100 }) {
  const key = process.env.MTB_PROJECT_KEY;
  if (!key) throw new Error("MTB_PROJECT_KEY env var is not set");

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    maxDistance: String((maxDistanceKm * 0.621371).toFixed(0)),
    maxResults: String(maxResults),
    key,
  });

  const res = await fetch(`${BASE}/get-trails?${params}`, { cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error("MTB Project API error: " + text);
  }
  const data = await res.json();
  return Array.isArray(data?.trails) ? data.trails : [];
}

// Convert a MTB Project trail object into a row for our `trails` table.
export function toTrailRow(trail, userId) {
  // Map their difficulty colors to ours.
  const diffMap = {
    "greenBlue":    "Green",
    "green":        "Green",
    "blueBlack":    "Blue",
    "blue":         "Blue",
    "black":        "Black",
    "dblack":       "Double Black",
    "blackDblack":  "Double Black",
  };
  return {
    user_id: userId,
    name: trail.name,
    length_km: trail.length != null ? +(trail.length * 1.60934).toFixed(2) : null,  // miles → km
    elev_m: trail.ascent != null ? Math.round(trail.ascent * 0.3048) : null,        // ft → m
    difficulty: diffMap[trail.difficulty] || "Blue",
    region: trail.location || "Travel",
  };
}
