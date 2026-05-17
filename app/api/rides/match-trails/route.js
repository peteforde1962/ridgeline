// POST /api/rides/match-trails
// Backfill: scan all rides that don't yet have a trail_id, try to match them.
// Useful for rides imported before trail auto-detection existed.

import { createClient } from "@/lib/supabase/server";
import { matchTrail } from "@/lib/trail-match";

export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const [{ data: trails }, { data: rides }] = await Promise.all([
    supabase.from("trails").select("id, name").eq("user_id", user.id),
    supabase.from("rides").select("id, notes").eq("user_id", user.id).is("trail_id", null),
  ]);

  if (!trails || trails.length === 0) {
    return Response.json({ ok: true, scanned: rides?.length || 0, matched: 0, note: "No trails saved yet." });
  }
  if (!rides || rides.length === 0) {
    return Response.json({ ok: true, scanned: 0, matched: 0 });
  }

  let matched = 0;
  for (const r of rides) {
    const trailId = matchTrail(r.notes || "", trails);
    if (trailId) {
      const { error } = await supabase.from("rides").update({ trail_id: trailId }).eq("id", r.id);
      if (!error) matched++;
    }
  }

  return Response.json({ ok: true, scanned: rides.length, matched });
}
