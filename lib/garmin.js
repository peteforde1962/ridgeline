// Garmin Connect API client.
// Requires registration at https://developerportal.garmin.com/ to obtain:
//   GARMIN_CLIENT_ID, GARMIN_CLIENT_SECRET
// Garmin's modern Activity API uses OAuth 2.0; legacy Health API uses OAuth 1.0a.
// This file implements the OAuth 2.0 flow — adjust scopes/URLs to match the
// program you enroll in (Garmin Activity API, Wellness API, etc.).

const GARMIN_AUTHORIZE = "https://connect.garmin.com/oauth2Confirm";
const GARMIN_TOKEN     = "https://connectapi.garmin.com/oauth-service/oauth/token";
const GARMIN_API       = "https://apis.garmin.com";

// Garmin activity type strings (from the Activity API summary endpoint) →
// our app's sport_type + activity_kind + label. Aligned with lib/activity.js
// so icons/badges work the same as Strava + Suunto.
const GARMIN_ACTIVITY_MAP = {
  "running":                  { sport_type: "Run",               kind: "run",      label: "Run" },
  "trail_running":            { sport_type: "TrailRun",          kind: "run",      label: "Trail run" },
  "treadmill_running":        { sport_type: "VirtualRun",        kind: "run",      label: "Treadmill" },
  "track_running":            { sport_type: "Run",               kind: "run",      label: "Track" },
  "cycling":                  { sport_type: "Ride",              kind: "cycle",    label: "Cycle" },
  "mountain_biking":          { sport_type: "MountainBikeRide",  kind: "cycle",    label: "MTB" },
  "gravel_cycling":           { sport_type: "GravelRide",        kind: "cycle",    label: "Gravel" },
  "road_biking":              { sport_type: "Ride",              kind: "cycle",    label: "Road" },
  "ebike_mountain":           { sport_type: "EMountainBikeRide", kind: "cycle",    label: "E-MTB" },
  "ebike":                    { sport_type: "EBikeRide",         kind: "cycle",    label: "E-bike" },
  "indoor_cycling":           { sport_type: "VirtualRide",       kind: "cycle",    label: "Indoor cycle" },
  "virtual_ride":             { sport_type: "VirtualRide",       kind: "cycle",    label: "Virtual ride" },
  "hiking":                   { sport_type: "Hike",              kind: "hike",     label: "Hike" },
  "walking":                  { sport_type: "Walk",              kind: "hike",     label: "Walk" },
  "snowshoeing":              { sport_type: "Snowshoe",          kind: "hike",     label: "Snowshoe" },
  "lap_swimming":             { sport_type: "Swim",              kind: "swim",     label: "Swim" },
  "open_water_swimming":      { sport_type: "Swim",              kind: "swim",     label: "Open water" },
  "resort_skiing":            { sport_type: "AlpineSki",         kind: "ski",      label: "Alpine ski" },
  "backcountry_skiing":       { sport_type: "BackcountrySki",    kind: "ski",      label: "BC ski" },
  "cross_country_skiing":     { sport_type: "NordicSki",         kind: "ski",      label: "Nordic ski" },
  "snowboarding":             { sport_type: "Snowboard",         kind: "ski",      label: "Snowboard" },
  "kayaking_v2":              { sport_type: "Kayaking",          kind: "paddle",   label: "Kayak" },
  "canoeing_v2":              { sport_type: "Canoeing",          kind: "paddle",   label: "Canoe" },
  "rowing_v2":                { sport_type: "Rowing",            kind: "paddle",   label: "Row" },
  "stand_up_paddleboarding":  { sport_type: "StandUpPaddling",   kind: "paddle",   label: "SUP" },
  "surfing":                  { sport_type: "Surfing",           kind: "paddle",   label: "Surf" },
  "yoga":                     { sport_type: "Yoga",              kind: "yoga",     label: "Yoga" },
  "pilates":                  { sport_type: "Pilates",           kind: "yoga",     label: "Pilates" },
  "strength_training":        { sport_type: "WeightTraining",    kind: "strength", label: "Strength" },
  "indoor_strength":          { sport_type: "WeightTraining",    kind: "strength", label: "Strength" },
  "crossfit":                 { sport_type: "Crossfit",          kind: "strength", label: "Crossfit" },
  "cardio":                   { sport_type: "Workout",           kind: "strength", label: "Cardio" },
  "elliptical":               { sport_type: "Elliptical",        kind: "strength", label: "Elliptical" },
  "stair_climbing":           { sport_type: "StairStepper",      kind: "strength", label: "Stairs" },
  "rock_climbing":            { sport_type: "RockClimbing",      kind: "climb",    label: "Climbing" },
  "indoor_climbing":          { sport_type: "RockClimbing",      kind: "climb",    label: "Indoor climb" },
};

// ---- OAuth ----

export function buildAuthorizeUrl({ redirectUri, state }) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.GARMIN_CLIENT_ID,
    redirect_uri: redirectUri,
    state: state || "",
  });
  return `${GARMIN_AUTHORIZE}?${params}`;
}

export async function exchangeCodeForTokens(code, redirectUri) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.GARMIN_CLIENT_ID,
    client_secret: process.env.GARMIN_CLIENT_SECRET,
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch(GARMIN_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!res.ok) throw new Error("Garmin token exchange failed: " + await res.text());
  return res.json();
}

export async function refreshAccessToken(refreshToken) {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.GARMIN_CLIENT_ID,
    client_secret: process.env.GARMIN_CLIENT_SECRET,
    refresh_token: refreshToken,
  });
  const res = await fetch(GARMIN_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  if (!res.ok) throw new Error("Garmin refresh failed: " + await res.text());
  return res.json();
}

export async function ensureFreshToken(supabase, profile) {
  const expires = profile.garmin_token_expires_at ? new Date(profile.garmin_token_expires_at) : null;
  if (expires && expires.getTime() - Date.now() > 5 * 60 * 1000) {
    return profile.garmin_access_token;
  }
  if (!profile.garmin_refresh_token) throw new Error("No Garmin refresh token");
  const tokens = await refreshAccessToken(profile.garmin_refresh_token);
  await supabase.from("profiles").update({
    garmin_access_token: tokens.access_token,
    garmin_refresh_token: tokens.refresh_token,
    garmin_token_expires_at: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
  }).eq("id", profile.id);
  return tokens.access_token;
}

// ---- Activity fetch ----

// Pull activity summaries via the Garmin Activity API.
// `uploadStartTimeInSeconds` filters to activities uploaded after that unix-sec.
export async function fetchActivities(accessToken, { since = null } = {}) {
  const params = new URLSearchParams();
  if (since) params.set("uploadStartTimeInSeconds", String(since));
  params.set("uploadEndTimeInSeconds", String(Math.floor(Date.now() / 1000)));
  const res = await fetch(`${GARMIN_API}/wellness-api/rest/activities?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Garmin activities fetch failed: " + await res.text());
  return res.json();
}

// Convert a Garmin activity summary → rides row. All activity types accepted.
export function activityToRide(activity, userId) {
  if (!activity?.durationInSeconds || activity.durationInSeconds < 60) return null;
  const type = (activity.activityType || "").toLowerCase();
  const map = GARMIN_ACTIVITY_MAP[type] || {
    sport_type: null, kind: "other", label: activity.activityType || "Activity",
  };
  return {
    user_id: userId,
    garmin_activity_id: String(activity.summaryId || activity.activityId),
    source: "garmin",
    date: new Date(activity.startTimeInSeconds * 1000).toISOString().slice(0, 10),
    km: activity.distanceInMeters != null ? +(activity.distanceInMeters / 1000).toFixed(2) : null,
    elev_m: activity.totalElevationGainInMeters != null ? Math.round(activity.totalElevationGainInMeters) : null,
    minutes: Math.round(activity.durationInSeconds / 60),
    feel: null,
    notes: [map.label, activity.activityName].filter(Boolean).join(" · ") || null,
    sport_type:    map.sport_type,
    activity_kind: map.kind,
    avg_hr: activity.averageHeartRateInBeatsPerMinute ? Math.round(activity.averageHeartRateInBeatsPerMinute) : null,
    max_hr: activity.maxHeartRateInBeatsPerMinute     ? Math.round(activity.maxHeartRateInBeatsPerMinute)     : null,
    avg_watts:          activity.averagePowerInWatts            ? Math.round(activity.averagePowerInWatts)            : null,
    weighted_avg_watts: activity.normalizedPowerInWatts         ? Math.round(activity.normalizedPowerInWatts)         : null,
    kilojoules:         activity.activeKilocalories             ? Math.round(activity.activeKilocalories * 4.184)     : null,
  };
}

export function getRedirectUri(request) {
  const url = new URL(request.url);
  return `${url.origin}/api/garmin/callback`;
}
