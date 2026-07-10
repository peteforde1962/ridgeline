// POST /api/waitlist — public endpoint. Anyone can submit; RLS on the table
// allows anon inserts, so we use the regular Supabase client (not the admin one).
// Dedupe by lower(email) via the unique index — friendly error on duplicate.

import { createClient } from "@/lib/supabase/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const email = (body.email || "").trim().toLowerCase();

    // Basic validation. Deliberately loose — we're not the postmaster, but we
    // do want to catch obvious typos + empty submits.
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    const supabase = createClient();
    const { error } = await supabase.from("waitlist").insert({
      email,
      name:       (body.name || "").trim() || null,
      interests:  (body.interests || "").trim() || null,
      source:     (body.source || "").trim() || null,
      referrer:   (body.referrer || "").trim() || null,
      user_agent: request.headers.get("user-agent")?.slice(0, 250) || null,
    });

    if (error) {
      // Duplicate email — reassure rather than reject.
      if (error.code === "23505" || /duplicate/i.test(error.message)) {
        return Response.json({ ok: true, note: "already on the list" });
      }
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
