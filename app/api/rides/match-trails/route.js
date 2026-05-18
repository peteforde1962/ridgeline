// POST /api/rides/match-trails
// Backfill: scan all rides that have no trail links yet, try to find matches,
// and write them into both the legacy rides.trail_id (primary) and ride_trails (multi).

import { createClient } from "@/lib/supabase/server";
import { matchTrails } from "@/lib/trail-match";

export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const [{ data: trails }, { data: rides }] = await Promise.all([
    supabase.from("trails").select("id, name").eq("user_id", user.id),
    supabase
      .from("rides")
      .select("id, notes, ride_trails(trail_id)")
      .eq("user_id", user.id),
  ]);

  if (!trails || trails.length === 0) {
    return Response.json({ ok: true, scanned: rides?.length || 0, matched: 0, note: "No trails saved yet." });
  }

  // Only consider rides with no links yet.
  const unmatched = (rides || []).filter(r => (r.ride_trails || []).length === 0);
  if (unmatched.length === 0) {
    return Response.json({ ok: true, scanned: 0, matched: 0 });
  }

  let matched = 0;
  for (const r of unmatched) {
    const ids = matchTrails(r.notes || "", trails);
    if (ids.length === 0) continue;
    matched++;
    // Update primary trail (back-compat)
    await supabase.from("rides").update({ trail_id: ids[0] }).eq("id", r.id);
    // Insert all join rows
    const rows = ids.map(tid => ({ ride_id: r.id, trail_id: tid }));
    await supabase.from("ride_trails")
      .upsert(rows, { onConflict: "ride_id,trail_id", ignoreDuplicates: true });
  }

  return Response.json({ ok: true, scanned: unmatched.length, matched });
}
