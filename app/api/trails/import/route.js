// POST /api/trails/import — import a discovered segment into the user's trails table.

import { createClient } from "@/lib/supabase/server";
import { segmentToTrailRow } from "@/lib/segments";

export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json();
  const { segment, regionLabel } = body || {};
  if (!segment?.name) return Response.json({ error: "Missing segment payload" }, { status: 400 });

  const row = segmentToTrailRow(segment, user.id, regionLabel);
  const { error } = await supabase.from("trails").insert(row);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
