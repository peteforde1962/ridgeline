// GET /api/suunto/callback — exchanges auth code for tokens, saves on profile.

import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, getRedirectUri } from "@/lib/suunto";

export async function GET(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.redirect(new URL("/login", request.url), 302);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) return Response.redirect(new URL("/profile?suunto=denied", request.url), 302);
  if (!code) return Response.redirect(new URL("/profile?suunto=missing-code", request.url), 302);

  try {
    const tokens = await exchangeCodeForTokens(code, getRedirectUri(request));
    const { error: updErr } = await supabase.from("profiles").update({
      suunto_user_id:           tokens.user || null,
      suunto_access_token:      tokens.access_token,
      suunto_refresh_token:     tokens.refresh_token,
      suunto_token_expires_at:  new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
    }).eq("id", user.id);
    if (updErr) return Response.redirect(new URL("/profile?suunto=db-error", request.url), 302);
    return Response.redirect(new URL("/profile?suunto=connected", request.url), 302);
  } catch (e) {
    console.error("Suunto callback error:", e);
    return Response.redirect(new URL("/profile?suunto=exchange-failed", request.url), 302);
  }
}
