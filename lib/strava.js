// Strava OAuth + API helpers. Server-side only — relies on STRAVA_CLIENT_ID / SECRET.

const STRAVA_TOKEN_URL    = "https://www.strava.com/oauth/token";
const STRAVA_AUTHORIZE    = "https://www.strava.com/oauth/authorize";
const STRAVA_API_BASE     = "https://www.strava.com/api/v3";

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
// Only imports cycling-type activities.
export function activityToRide(activity, userId) {
  // Sport types Strava uses for cycling. Strava renamed several of these in 2021 —
  // the current canonical names are:
  const cyclingTypes = new Set([
    "Ride",
    "MountainBikeRide",
    "EMountainBikeRide",   // electric MTB (current name)
    "EBikeRide",           // electric road bike
    "GravelRide",
    "VirtualRide",         // Zwift, indoor trainer
    "Velomobile",
  ]);
  if (!cyclingTypes.has(activity.sport_type)) return null;

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
    km: +(activity.distance / 1000).toFixed(2),
    elev_m: Math.round(activity.total_elevation_gain),
    minutes: Math.round(activity.moving_time / 60),
    feel: null,
    notes: composedNotes,
  };
}

// Required redirect URI based on current host. Used in both connect + callback routes.
export function getRedirectUri(request) {
  const url = new URL(request.url);
  return `${url.origin}/api/strava/callback`;
}
