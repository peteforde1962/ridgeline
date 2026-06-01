// Strava OAuth + API helpers. Server-side only — relies on STRAVA_CLIENT_ID / SECRET.
//
// Heads-up: Strava is moving the API base URL from
//   https://www.strava.com/api/v3   →   https://www.api-v3.strava.com
// Required by June 1, 2027. The old URL still works today.
// Set STRAVA_API_BASE in Vercel env vars to flip to the new host when Strava
// confirms it's live — no code change or redeploy required.

const STRAVA_TOKEN_URL    = "https://www.strava.com/oauth/token";
const STRAVA_AUTHORIZE    = "https://www.strava.com/oauth/authorize";
export const STRAVA_API_BASE = process.env.STRAVA_API_BASE || "https://www.strava.com/api/v3";

// Build the URL the user is redirected to so they can authorize the app.
export function buildAuthorizeUrl({ redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: process.env.STRAVA_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "read,activity:read_all",
    approval_prompt: "auto",
    state: state || "",
  });
  return `${STRAVA_AUTHORIZE}?${params.toString()}`;
}

// Exchange a one-time auth code for access + refresh tokens.
export async function exchangeCodeForTokens(code) {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error("Strava token exchange failed: " + await res.text());
  return res.json();
}

// Refresh an expired access token.
export async function refreshAccessToken(refreshToken) {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) throw new Error("Strava refresh failed: " + await res.text());
  return res.json();
}

// Ensure we have a non-expired access token; refresh if needed; update DB.
export async function ensureFreshToken(supabase, profile) {
  const expires = profile.strava_token_expires_at ? new Date(profile.strava_token_expires_at) : null;
  const now = new Date();
  // Refresh if expiring within 5 minutes.
  if (expires && expires.getTime() - now.getTime() > 5 * 60 * 1000) {
    return profile.strava_access_token;
  }
  if (!profile.strava_refresh_token) throw new Error("No Strava refresh token");
  const tokens = await refreshAccessToken(profile.strava_refresh_token);
  // Update DB
  await supabase.from("profiles").update({
    strava_access_token: tokens.access_token,
    strava_refresh_token: tokens.refresh_token,
    strava_token_expires_at: new Date(tokens.expires_at * 1000).toISOString(),
  }).eq("id", profile.id);
  return tokens.access_token;
}

// Fetch recent activities. Returns Strava's raw activity objects.
// `after` is a unix timestamp (seconds); only activities after that time are returned.
export async function fetchAthleteActivities(accessToken, { after = null, perPage = 30, page = 1 } = {}) {
  const params = new URLSearchParams({ per_page: String(perPage), page: String(page) });
  if (after) params.set("after", String(after));
  const res = await fetch(`${STRAVA_API_BASE}/athlete/activities?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Strava activities fetch failed: " + await res.text());
  return res.json();
}

// Convert a Strava activity into a row for the `rides` table.
// Imports any activity type. Trail detection still only runs on cycling
// (kind === "cycle") — see sportInfo() in lib/activity.js.
import { sportInfo } from "./activity";

export function activityToRide(activity, userId) {
  // Skip only zero-duration uploads (occasional bad imports).
  if (!activity?.moving_time || activity.moving_time < 60) return null;

  const info = sportInfo(activity.sport_type);

  // Compose a richer notes field so trail matching has more to work with.
  // Format: "<Activity name> · <City>, <State>" — both pieces optional.
  const locParts = [activity.location_city, activity.location_state].filter(Boolean);
  const locationText = locParts.length > 0 ? locParts.join(", ") : null;
  const composedNotes = [activity.name, locationText].filter(Boolean).join(" · ") || null;

  return {
    user_id: userId,
    strava_activity_id: activity.id,
    source: "strava",
    date: activity.start_date_local.slice(0, 10),
    km: +(((activity.distance || 0) / 1000).toFixed(2)),
    elev_m: Math.round(activity.total_elevation_gain || 0),
    minutes: Math.round(activity.moving_time / 60),
    feel: null,
    notes: composedNotes,
    sport_type:    activity.sport_type || null,
    activity_kind: info.kind,
    // Intensity signals for TSS calculation. All optional — only present
    // when the rider's recording device captured them.
    avg_hr:             activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
    max_hr:             activity.max_heartrate     ? Math.round(activity.max_heartrate)     : null,
    avg_watts:          activity.average_watts     ? Math.round(activity.average_watts)     : null,
    weighted_avg_watts: activity.weighted_average_watts ? Math.round(activity.weighted_average_watts) : null,
    suffer_score:       activity.suffer_score != null ? Math.round(activity.suffer_score)   : null,
    kilojoules:         activity.kilojoules        ? Math.round(activity.kilojoules)        : null,
  };
}

// Required redirect URI based on current host. Used in both connect + callback routes.
export function getRedirectUri(request) {
  const url = new URL(request.url);
  return `${url.origin}/api/strava/callback`;
}
