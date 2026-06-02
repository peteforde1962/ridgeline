// GET /api/garmin/connect — kicks off Garmin OAuth.

import { redirect } from "next/navigation";
import { buildAuthorizeUrl, getRedirectUri } from "@/lib/garmin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!process.env.GARMIN_CLIENT_ID) {
    return new Response("Garmin not configured. GARMIN_CLIENT_ID missing.", { status: 500 });
  }
  const url = buildAuthorizeUrl({ redirectUri: getRedirectUri(request), state: user.id });
  return Response.redirect(url, 302);
}
