// GET  /api/trail-conditions?trail=Half%20Nelson — list recent reports for a trail name
// POST /api/trail-conditions — submit a report

import { createClient } from "@/lib/supabase/server";

const VALID_STATUS = new Set(["dry", "tacky", "wet", "muddy", "snow", "closed"]);

export async function GET(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const url = new URL(request.url);
  const name = url.searchParams.get("trail");

  let q = supabase.from("trail_conditions")
    .select("id, trail_name, region, status, notes, reporter_name, reported_at")
    .order("reported_at", { ascending: false })
    .limit(50);
  if (name) q = q.ilike("trail_name", name);

  const { data, error } = await q;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ reports: data || [] });
}

export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json();
  const { trail_name, region, status, notes } = body || {};
  if (!trail_name || !status) return Response.json({ error: "trail_name and status required" }, { status: 400 });
  if (!VALID_STATUS.has(status)) return Response.json({ error: "invalid status" }, { status: 400 });

  const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();

  const { data, error } = await supabase.from("trail_conditions").insert({
    trail_name: trail_name.trim(),
    region: region || null,
    status,
    notes: (notes || "").trim() || null,
    user_id: user.id,
    reporter_name: profile?.name || null,
  }).select("id").single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, id: data.id });
}
