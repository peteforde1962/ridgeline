// GET /api/strava/callback — Strava redirects here after the user authorizes.
// Exchanges the one-time code for tokens, saves on the profile, redirects back to /profile.

import { exchangeCodeForTokens } from "@/lib/strava";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.redirect(new URL("/login", request.url), 302);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    return Response.redirect(new URL("/profile?strava=denied", request.url), 302);
  }
  if (!code) {
    return Response.redirect(new URL("/profile?strava=missing-code", request.url), 302);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    const { error: updateError } = await supabase.from("profiles").update({
      strava_athlete_id:        tokens.athlete?.id || null,
      strava_access_token:      tokens.access_token,
      strava_refresh_token:     tokens.refresh_token,
      strava_token_expires_at:  new Date(tokens.expires_at * 1000).toISOString(),
    }).eq("id", user.id);

    if (updateError) {
      return Response.redirect(new URL("/profile?strava=db-error", request.url), 302);
    }
    return Response.redirect(new URL("/profile?strava=connected", request.url), 302);
  } catch (e) {
    console.error("Strava callback error:", e);
    return Response.redirect(new URL("/profile?strava=exchange-failed", request.url), 302);
  }
}
