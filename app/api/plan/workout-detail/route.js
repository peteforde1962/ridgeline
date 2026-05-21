// POST /api/plan/workout-detail
// Generate (or fetch cached) detailed workout for a plan session.
// Uses the Coach AI to produce concrete intervals, durations, RPE/HR targets.

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json();
  const { weekIndex, dayIndex, sessionIdx, sessionType, sessionName, force } = body || {};
  if (weekIndex == null || dayIndex == null || sessionIdx == null) {
    return Response.json({ error: "Missing params" }, { status: 400 });
  }

  // Check existing cache.
  const { data: existing } = await supabase.from("plan_sessions")
    .select("ai_workout")
    .eq("user_id", user.id).eq("week_index", weekIndex).eq("day_index", dayIndex).eq("session_idx", sessionIdx)
    .maybeSingle();
  if (existing?.ai_workout && !force) {
    return Response.json({ workout: existing.ai_workout, cached: true });
  }

  // Build profile context.
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const apiKey = process.env.ANTHROPIC_API_KEY;

  const userPrompt = `Give a concrete, structured workout for this session:

TYPE: ${sessionType}
NAME: ${sessionName}
RIDER: ${profile?.preset || "Sport"} (${profile?.level || "Intermediate"}), ${profile?.weekly_hours || 6} hrs/week
GOAL: ${profile?.goal || "Race fitness"}

Format:
• Warm-up (5–15 min)
• Main set (intervals/blocks with exact durations + targets in RPE 1–10 OR HR zones OR power-zones)
• Cool-down

Keep it brief: 8–12 lines total. No filler.`;

  let workout;
  if (!apiKey) {
    workout = localFallback(sessionType, sessionName);
  } else {
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 500,
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
      if (!r.ok) {
        return Response.json({ error: "Anthropic API: " + await r.text() }, { status: 502 });
      }
      const data = await r.json();
      workout = data?.content?.[0]?.text || localFallback(sessionType, sessionName);
    } catch (e) {
      workout = localFallback(sessionType, sessionName);
    }
  }

  // Cache it.
  await supabase.from("plan_sessions").upsert({
    user_id: user.id, week_index: weekIndex, day_index: dayIndex, session_idx: sessionIdx,
    ai_workout: workout,
  }, { onConflict: "user_id,week_index,day_index,session_idx", ignoreDuplicates: false });

  return Response.json({ workout, cached: false });
}

function localFallback(type, name) {
  return `${name}

(Set ANTHROPIC_API_KEY for AI-generated detailed sessions.)

• Warm up 10 min easy
• Main set per session description
• Cool down 5 min easy`;
}
