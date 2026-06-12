// POST /api/plan/reset — wipe the current user's plan state.
// Deletes every plan_sessions row + plan_day_notes row for the user, and
// sets profiles.started_at = null so /plan shows the "no active plan" CTA.
//
// Does NOT touch profile, rides, trails, videos, coach link, or anything else.

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

    // Delete plan_sessions, surface the count.
    const { count: sessionCount, error: sErr } = await supabase
      .from("plan_sessions")
      .delete({ count: "exact" })
      .eq("user_id", user.id);
    if (sErr) return Response.json({ error: sErr.message }, { status: 500 });

    // Delete plan_day_notes (idempotent — table may not exist on very old installs).
    let noteCount = 0;
    try {
      const { count } = await supabase
        .from("plan_day_notes")
        .delete({ count: "exact" })
        .eq("user_id", user.id);
      noteCount = count || 0;
    } catch {}

    // Clear started_at so /plan reverts to its no-plan state.
    await supabase.from("profiles").update({ started_at: null }).eq("id", user.id);

    return Response.json({
      ok: true,
      sessions_deleted: sessionCount || 0,
      notes_deleted: noteCount,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
