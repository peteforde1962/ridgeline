// POST /api/coach-link — student attaches to a coach via 6-char invite code.
// Uses admin client to look up coach (bypasses RLS), then updates the student's profile.

import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export async function POST(request) {
  try {
    const { code } = await request.json();
    if (!code || typeof code !== "string" || code.length !== 6) {
      return Response.json({ error: "Invalid code" }, { status: 400 });
    }
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

    const admin = adminClient();
    const { data: coach } = await admin.from("profiles")
      .select("id, role, name, email")
      .eq("coach_code", code.toUpperCase())
      .maybeSingle();
    if (!coach) return Response.json({ error: "Code not found" }, { status: 404 });
    if (coach.id === user.id) return Response.json({ error: "Can't link to yourself" }, { status: 400 });

    const { error } = await supabase.from("profiles")
      .update({ coach_id: coach.id })
      .eq("id", user.id);
    if (error) return Response.json({ error: error.message }, { status: 500 });

    return Response.json({ ok: true, coach: { id: coach.id, name: coach.name } });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
