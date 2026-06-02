// Suunto App API client (https://cloudapi.suunto.com)
// Server-side only — uses SUUNTO_CLIENT_ID / SECRET / SUBSCRIPTION_KEY from env.
//
// Note: Suunto requires BOTH an OAuth bearer token AND a subscription key
// (Ocp-Apim-Subscription-Key) on every API request.

const SUUNTO_AUTHORIZE = "https://cloudapi-oauth.suunto.com/oauth/authorize";
const SUUNTO_TOKEN     = "https://cloudapi-oauth.suunto.com/oauth/token";
const SUUNTO_API       = "https://cloudapi.suunto.com/v3";

// Suunto activity-ID → { sport_type, kind, label }. Sport type strings line
// up with the Strava sport_type vocabulary so the rest of the app can share
// lib/activity.js for icon + label lookups.
// Full reference: https://media.suunto.com/api-doc/suuntoapp/activityCodes.html
const SUUNTO_ACTIVITY_MAP = {
  0:  { sport_type: "Walk",              kind: "hike",     label: "Walk" },
  1:  { sport_type: "Run",               kind: "run",      label: "Run" },
  2:  { sport_type: "Ride",              kind: "cycle",    label: "Cycle" },
  3:  { sport_type: "NordicSki",         kind: "ski",      label: "Nordic ski" },
  5:  { sport_type: "Workout",           kind: "strength", label: "Workout" },
  6:  { sport_type: "MountainBikeRide",  kind: "cycle",    label: "MTB" },
  7:  { sport_type: "Hike",              kind: "hike",     label: "Hike" },
  8:  { sport_type: "AlpineSki",         kind: "ski",      label: "Alpine ski" },
  9:  { sport_type: "Snowboard",         kind: "ski",      label: "Snowboard" },
  10: { sport_type: "Skateboard",        kind: "other",    label: "Skating" },
  11: { sport_type: "Rowing",            kind: "paddle",   label: "Rowing" },
  12: { sport_type: "Swim",              kind: "swim",     label: "Swim" },
  13: { sport_type: "Kayaking",          kind: "paddle",   label: "Kayak" },
  14: { sport_type: "RockClimbing",      kind: "climb",    label: "Climbing" },
  15: { sport_type: "Pilates",           kind: "yoga",     label: "Pilates" },
  16: { sport_type: "Yoga",              kind: "yoga",     label: "Yoga" },
  17: { sport_type: "Crossfit",          kind: "strength", label: "Crossfit" },
  19: { sport_type: "WeightTraining",    kind: "strength", label: "Strength" },
  21: { sport_type: "VirtualRide",       kind: "cycle",    label: "Indoor cycle" },
  22: { sport_type: "VirtualRun",        kind: "run",      label: "Treadmill" },
  23: { sport_type: "Workout",           kind: "strength", label: "Indoor workout" },
  29: { sport_type: "TrailRun",          kind: "run",      label: "Trail run" },
  60: { sport_type: "GravelRide",        kind: "cycle",    label: "Gravel" },
  67: { sport_type: "GravelRide",        kind: "cycle",    label: "Gravel" },
  68: { sport_type: "MountainBikeRide",  kind: "cycle",    label: "MTB enduro" },
  73: { sport_type: "Snowshoe",          kind: "hike",     label: "Snowshoe" },
  81: { sport_type: "EMountainBikeRide", kind: "cycle",    label: "E-MTB" },
  82: { sport_type: "EBikeRide",         kind: "cycle",    label: "E-bike" },
  83: { sport_type: "MountainBikeRide",  kind: "cycle",    label: "Bike park" },
};

export function buildAuthorizeUrl({ redirectUri, state }) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.SUUNTO_CLIENT_ID,
    redirect_uri: redirectUri,
    scope: "workout",
    state: state || "",
  });
  return `${SUUNTO_AUTHORIZE}?${params}`;
}

export async function exchangeCodeForTokens(code, redirectUri) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
  const basicAuth = Buffer.from(`${process.env.SUUNTO_CLIENT_ID}:${process.env.SUUNTO_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(SUUNTO_TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${basicAuth}`,
    },
    body: params,
  });
  if (!res.ok) throw new Error("Suunto token exchange failed: " + await res.text());
  return res.json();
}

export async function refreshAccessToken(refreshToken) {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const basicAuth = Buffer.from(`${process.env.SUUNTO_CLIENT_ID}:${process.env.SUUNTO_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(SUUNTO_TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": `Basic ${basicAuth}`,
    },
    body: params,
  });
  if (!res.ok) throw new Error("Suunto refresh failed: " + await res.text());
  return res.json();
}

export async function ensureFreshToken(supabase, profile) {
  const expires = profile.suunto_token_expires_at ? new Date(profile.suunto_token_expires_at) : null;
  if (expires && expires.getTime() - Date.now() > 5 * 60 * 1000) {
    return profile.suunto_access_token;
  }
  if (!profile.suunto_refresh_token) throw new Error("No Suunto refresh token");
  const tokens = await refreshAccessToken(profile.suunto_refresh_token);
  await supabase.from("profiles").update({
    suunto_access_token: tokens.access_token,
    suunto_refresh_token: tokens.refresh_token,
    suunto_token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
  }).eq("id", profile.id);
  return tokens.access_token;
}

function apiHeaders(accessToken) {
  return {
    "Authorization": `Bearer ${accessToken}`,
    "Ocp-Apim-Subscription-Key": process.env.SUUNTO_SUBSCRIPTION_KEY,
  };
}

// Fetch recent workouts. `since` is a unix-ms timestamp.
export async function fetchWorkouts(accessToken, { since = null } = {}) {
  const params = new URLSearchParams();
  if (since) params.set("since", String(since));
  params.set("limit", "100");
  const res = await fetch(`${SUUNTO_API}/workouts?${params}`, { headers: apiHeaders(accessToken) });
  if (!res.ok) throw new Error("Suunto workouts fetch failed: " + await res.text());
  const data = await res.json();
  return Array.isArray(data?.payload) ? data.payload : [];
}

// Convert Suunto workout → rides table row. Accepts all activity types.
export function workoutToRide(workout, userId) {
  if (!workout?.totalTime || workout.totalTime < 60) return null;   // skip zero-duration
  const map = SUUNTO_ACTIVITY_MAP[workout.activityId] || {
    sport_type: null, kind: "other", label: `Activity ${workout.activityId ?? "?"}`,
  };
  return {
    user_id: userId,
    suunto_workout_key: workout.workoutKey || String(workout.id),
    source: "suunto",
    date: new Date(workout.startTime).toISOString().slice(0, 10),
    km: workout.totalDistance != null ? +((workout.totalDistance || 0) / 1000).toFixed(2) : null,
    elev_m: workout.totalAscent != null ? Math.round(workout.totalAscent) : null,
    minutes: workout.totalTime != null ? Math.round((workout.totalTime || 0) / 60) : null,
    feel: null,
    notes: [map.label, workout.description].filter(Boolean).join(" · ") || null,
    sport_type:    map.sport_type,
    activity_kind: map.kind,
    // Intensity signals — same shape as Strava import. Suunto exposes these
    // when the device captured them.
    avg_hr:    workout.hrdata?.avg ? Math.round(workout.hrdata.avg) : null,
    max_hr:    workout.hrdata?.max ? Math.round(workout.hrdata.max) : null,
    avg_watts: workout.powerdata?.avg ? Math.round(workout.powerdata.avg) : null,
  };
}

export function getRedirectUri(request) {
  const url = new URL(request.url);
  return `${url.origin}/api/suunto/callback`;
}
