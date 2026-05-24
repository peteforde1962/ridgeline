// /api/cron/daily-email
// Runs hourly via Vercel Cron. For each user, checks if their local hour matches
// their preferred send hour. If yes, sends today's briefing.

import { adminClient } from "@/lib/supabase/admin";
import { sendDailyBriefing } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request) {
  // Vercel cron requests carry an authorization header with CRON_SECRET.
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (process.env.CRON_SECRET && authHeader !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  const admin = adminClient();
  const { data: users, error } = await admin
    .from("profiles")
    .select("*")
    .eq("daily_email_enabled", true);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Hobby plan: cron can only run once daily. Send to every enabled user
  // in one shot (delivery time = whatever the cron schedule fires, in their inbox).
  let sent = 0, failed = 0;
  const details = [];

  for (const u of (users || [])) {
    try {
      await sendDailyBriefing(u, admin);
      sent++;
      details.push({ email: u.email, ok: true });
    } catch (e) {
      failed++;
      details.push({ email: u.email, error: e.message });
    }
  }

  return Response.json({ ok: true, total: users?.length || 0, sent, failed, details });
}
