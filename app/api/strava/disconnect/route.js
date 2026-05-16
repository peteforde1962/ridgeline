// POST /api/strava/disconnect — clear Strava tokens from this user's profile.
// (Doesn't revoke at Strava's side — user can also revoke at strava.com/settings/apps)

import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const { error } = await supabase.from("profiles").update({
    strava_athlete_id:        null,
    strava_access_token:      null,
    strava_refresh_token:     null,
    strava_token_expires_at:  null,
    strava_last_sync_at:      null,
  }).eq("id", user.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
