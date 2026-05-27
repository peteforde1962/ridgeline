// GET /api/suunto/connect — kicks off Suunto OAuth.

import { redirect } from "next/navigation";
import { buildAuthorizeUrl, getRedirectUri } from "@/lib/suunto";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!process.env.SUUNTO_CLIENT_ID) {
    return new Response("Suunto not configured. SUUNTO_CLIENT_ID missing.", { status: 500 });
  }
  const url = buildAuthorizeUrl({ redirectUri: getRedirectUri(request), state: user.id });
  return Response.redirect(url, 302);
}
