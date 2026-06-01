// /api/strava/subscribe
// POST — admin-only. Creates the single push subscription with Strava.
//        Strava will then call our /api/strava/webhook GET to verify, and after that
//        POST every time any connected user uploads a new activity.

import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { STRAVA_API_BASE } from "@/lib/strava";

export const runtime = "nodejs";

export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!me?.is_admin) return Response.json({ error: "Admins only" }, { status: 403 });

  const verifyToken = process.env.STRAVA_VERIFY_TOKEN;
  if (!verifyToken) return Response.json({ error: "STRAVA_VERIFY_TOKEN not set" }, { status: 500 });

  // Build the callback URL from this request's origin.
  const url = new URL(request.url);
  const callbackUrl = `${url.origin}/api/strava/webhook`;

  // Ask Strava to subscribe.
  const res = await fetch(`${STRAVA_API_BASE}/push_subscriptions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id:     process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      callback_url:  callbackUrl,
      verify_token:  verifyToken,
    }),
  });
  const data = await res.json();
  if (!res.ok) return Response.json({ error: `Strava: ${JSON.stringify(data)}` }, { status: 502 });

  // Record it so the admin page knows the subscription exists.
  const admin = adminClient();
  await admin.from("strava_subscription").upsert(
    { id: data.id, callback_url: callbackUrl },
    { onConflict: "id" }
  );

  return Response.json({ ok: true, id: data.id, callback_url: callbackUrl });
}

// GET — list the active subscriptions (handy for debugging).
export async function GET(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!me?.is_admin) return Response.json({ error: "Admins only" }, { status: 403 });

  const params = new URLSearchParams({
    client_id:     process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
  });
  const res = await fetch(`${STRAVA_API_BASE}/push_subscriptions?${params}`);
  const data = await res.json();
  return Response.json({ subscriptions: data });
}

// DELETE — remove the active subscription.
export async function DELETE(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!me?.is_admin) return Response.json({ error: "Admins only" }, { status: 403 });

  const admin = adminClient();
  const { data: sub } = await admin.from("strava_subscription").select("*").maybeSingle();
  if (!sub) return Response.json({ ok: true, note: "no subscription to delete" });

  const params = new URLSearchParams({
    client_id:     process.env.STRAVA_CLIENT_ID,
    client_secret: process.env.STRAVA_CLIENT_SECRET,
  });
  const res = await fetch(`${STRAVA_API_BASE}/push_subscriptions/${sub.id}?${params}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const text = await res.text();
    return Response.json({ error: "Strava delete failed: " + text }, { status: 502 });
  }
  await admin.from("strava_subscription").delete().eq("id", sub.id);
  return Response.json({ ok: true });
}
