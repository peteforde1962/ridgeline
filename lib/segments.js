// Trail discovery — powered by Strava Segments (free, uses the user's own Strava OAuth).
// Endpoint: GET https://www.strava.com/api/v3/segments/explore?bounds=...&activity_type=riding

import { ensureFreshToken } from "@/lib/strava";

// Popular MTB destinations with rough centroid coordinates.
// Same list as before — coordinates work with any geo lookup.
export const REGIONS = [
  { id: "squamish",      label: "Squamish, BC",         lat: 49.7016,  lon: -123.1558 },
  { id: "whistler",      label: "Whistler, BC",         lat: 50.1163,  lon: -122.9574 },
  { id: "pemberton",     label: "Pemberton, BC",        lat: 50.3196,  lon: -122.8035 },
  { id: "northvan",      label: "North Vancouver, BC",  lat: 49.3200,  lon: -123.0735 },
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

// Fetch top cycling segments near a lat/lon using Strava's /segments/explore endpoint.
// Returns up to 10 segments — that's Strava's limit. To get broader coverage,
// we could split the area into multiple boxes; for v1, top 10 is fine.
export async function fetchSegmentsNear({ lat, lon, accessToken, halfDeg = 0.25 }) {
  // bounding box: south, west, north, east (lat,lon,lat,lon)
  const bounds = `${(lat - halfDeg).toFixed(4)},${(lon - halfDeg).toFixed(4)},${(lat + halfDeg).toFixed(4)},${(lon + halfDeg).toFixed(4)}`;
  const params = new URLSearchParams({ bounds, activity_type: "riding" });

  const res = await fetch(`https://www.strava.com/api/v3/segments/explore?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Strava segments error: " + await res.text());
  const data = await res.json();
  return Array.isArray(data?.segments) ? data.segments : [];
}

// Convert a Strava segment into a row for our trails table.
export function segmentToTrailRow(seg, userId, regionLabel) {
  // climb_category_desc: '0' easy → '5' hors catégorie
  const cat = String(seg.climb_category_desc || seg.climb_category || "");
  const diff =
    cat === "0" ? "Green"
    : cat === "1" ? "Blue"
    : cat === "2" ? "Blue"
    : cat === "3" ? "Black"
    : "Black";
  return {
    user_id: userId,
    name: seg.name,
    length_km: seg.distance != null ? +(seg.distance / 1000).toFixed(2) : null,
    elev_m:   seg.elev_difference != null ? Math.round(seg.elev_difference) : null,
    difficulty: diff,
    region: regionLabel || "Travel",
  };
}

// Bridge — get a fresh Strava access token from the user's profile or throw.
export async function getStravaAccessToken(supabase, userId) {
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (!profile?.strava_refresh_token) {
    const err = new Error("strava-not-connected");
    err.code = "strava-not-connected";
    throw err;
  }
  return ensureFreshToken(supabase, profile);
}
