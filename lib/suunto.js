// Suunto App API client (https://cloudapi.suunto.com)
// Server-side only — uses SUUNTO_CLIENT_ID / SECRET / SUBSCRIPTION_KEY from env.
//
// Note: Suunto requires BOTH an OAuth bearer token AND a subscription key
// (Ocp-Apim-Subscription-Key) on every API request.

const SUUNTO_AUTHORIZE = "https://cloudapi-oauth.suunto.com/oauth/authorize";
const SUUNTO_TOKEN     = "https://cloudapi-oauth.suunto.com/oauth/token";
const SUUNTO_API       = "https://cloudapi.suunto.com/v3";

// Activity IDs Suunto uses for cycling-type workouts.
// Reference list (subset): 4 Cycling, 7 Mountain biking, 8 Indoor cycling,
// 23 Roller skating (skip), 60 Cyclocross, 67 Gravel cycling, 68 Mountain biking enduro, ...
const CYCLING_ACTIVITY_IDS = new Set([4, 7, 8, 60, 67, 68, 81, 82, 83]);

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

// Convert Suunto workout → rides table row. Skip non-cycling.
export function workoutToRide(workout, userId) {
  if (!CYCLING_ACTIVITY_IDS.has(workout.activityId)) return null;
  return {
    user_id: userId,
    suunto_workout_key: workout.workoutKey || String(workout.id),
    source: "suunto",
    date: new Date(workout.startTime).toISOString().slice(0, 10),
    km: workout.totalDistance != null ? +((workout.totalDistance || 0) / 1000).toFixed(2) : null,
    elev_m: workout.totalAscent != null ? Math.round(workout.totalAscent) : null,
    minutes: workout.totalTime != null ? Math.round((workout.totalTime || 0) / 60) : null,
    feel: null,
    notes: workout.description || null,
  };
}

export function getRedirectUri(request) {
  const url = new URL(request.url);
  return `${url.origin}/api/suunto/callback`;
}
