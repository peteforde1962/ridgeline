// POST /api/admin/approve-coach — flip a user's coach_approved flag.
// Only callable by admins (verified server-side, then admin client writes).

import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export async function POST(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

    const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
    if (!me?.is_admin) return Response.json({ error: "Forbidden" }, { status: 403 });

    const { userId, approve } = await request.json();
    if (!userId) return Response.json({ error: "userId required" }, { status: 400 });

    const admin = adminClient();
    if (approve) {
      await admin.from("profiles")
        .update({ role: "coach", coach_approved: true })
        .eq("id", userId);
    } else {
      // Reject: drop them back to student and clear approval.
      await admin.from("profiles")
        .update({ role: "student", coach_approved: false })
        .eq("id", userId);
    }
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
