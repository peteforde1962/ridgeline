// POST /api/garmin/disconnect — clear Garmin tokens from profile.

import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const { error } = await supabase.from("profiles").update({
    garmin_user_id: null,
    garmin_access_token: null,
    garmin_refresh_token: null,
    garmin_token_expires_at: null,
    garmin_last_sync_at: null,
  }).eq("id", user.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
