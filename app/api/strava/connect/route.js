// GET /api/strava/connect — kicks off Strava OAuth.
// Redirects the user to Strava's authorize URL.

import { redirect } from "next/navigation";
import { buildAuthorizeUrl, getRedirectUri } from "@/lib/strava";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!process.env.STRAVA_CLIENT_ID) {
    return new Response("Strava is not configured. STRAVA_CLIENT_ID env var missing.", { status: 500 });
  }

  const authorizeUrl = buildAuthorizeUrl({
    redirectUri: getRedirectUri(request),
    state: user.id,
  });
  return Response.redirect(authorizeUrl, 302);
}
