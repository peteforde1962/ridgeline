// GET /api/waitlist/export — admin-only CSV download of all waitlist signups.
// Uses the service-role admin client to bypass RLS, after verifying the caller
// is a signed-in admin. Returns Content-Type: text/csv so browsers download it.

import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Not signed in", { status: 401 });

  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!me?.is_admin) return new Response("Forbidden", { status: 403 });

  const admin = adminClient();
  const { data: rows, error } = await admin
    .from("waitlist")
    .select("email, name, interests, source, referrer, user_agent, created_at")
    .order("created_at", { ascending: false });
  if (error) return new Response("Query failed: " + error.message, { status: 500 });

  // Naive CSV escape — wraps every cell in quotes and doubles internal quotes.
  const esc = (v) => v == null ? "" : `"${String(v).replace(/"/g, '""')}"`;
  const headers = ["email", "name", "interests", "source", "referrer", "user_agent", "created_at"];
  const lines = [headers.join(",")];
  for (const r of (rows || [])) {
    lines.push(headers.map((h) => esc(r[h])).join(","));
  }
  const csv = lines.join("\n");

  const filename = `ridgeline-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
