// POST /api/coaching/edit-workout — update an existing prescribed plan_session.
// Body: { planSessionId, name, body, type }

import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

    const { planSessionId, name, body, type } = await request.json();
    if (!planSessionId) return Response.json({ error: "Missing planSessionId" }, { status: 400 });

    const admin = adminClient();
    const { data: row } = await admin.from("plan_sessions").select("*").eq("id", planSessionId).single();
    if (!row) return Response.json({ error: "Not found" }, { status: 404 });
    if (row.prescribed_by_coach_id !== user.id) {
      return Response.json({ error: "Not your prescribed session" }, { status: 403 });
    }

    const patch = {};
    if (name) patch.custom_name = name;
    if (body) patch.ai_workout = body;
    if (type) patch.swapped_to = type;

    const { error } = await admin.from("plan_sessions").update(patch).eq("id", planSessionId);
    if (error) return Response.json({ error: error.message }, { status: 500 });

    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
