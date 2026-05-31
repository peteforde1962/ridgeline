// POST /api/plan/workout-detail
// Default: build a structured workout from the actual training library
//   (real strength exercises, yoga poses, etc — type-correct).
// On `regenerate: true`: call Claude with a type-specific prompt that won't
//   drift back into cycling intervals.

import { createClient } from "@/lib/supabase/server";
import { buildWorkoutFromLibrary } from "@/lib/workout-builder";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const body = await request.json();
  const {
    weekIndex, dayIndex, sessionIdx,
    sessionType, sessionName, phaseName,
    regenerate,   // true → call AI even if a cached workout exists
  } = body || {};
  if (weekIndex == null || dayIndex == null || sessionIdx == null) {
    return Response.json({ error: "Missing params" }, { status: 400 });
  }

  // Check existing cache only when NOT regenerating.
  if (!regenerate) {
    const { data: existing } = await supabase.from("plan_sessions")
      .select("ai_workout")
      .eq("user_id", user.id).eq("week_index", weekIndex).eq("day_index", dayIndex).eq("session_idx", sessionIdx)
      .maybeSingle();
    if (existing?.ai_workout) {
      return Response.json({ workout: existing.ai_workout, source: "cached" });
    }
  }

  // For non-regenerate first loads, build from the library — instant, free,
  // type-correct. Strength sessions get real strength exercises, not rides.
  if (!regenerate) {
    const fromLib = buildWorkoutFromLibrary({
      type: sessionType, sessionName, phase: phaseName, weekIndex, dayIndex, sessionIdx,
    });
    if (fromLib) {
      await cacheWorkout(supabase, user.id, weekIndex, dayIndex, sessionIdx, fromLib);
      return Response.json({ workout: fromLib, source: "library" });
    }
  }

  // Regenerate path — or unknown type — call the AI with a type-strict prompt.
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const prompt = buildAIPrompt(sessionType, sessionName, profile);

  let workout;
  if (!apiKey) {
    workout = buildWorkoutFromLibrary({
      type: sessionType, sessionName, phase: phaseName, weekIndex, dayIndex, sessionIdx,
    }) || "Set ANTHROPIC_API_KEY for AI-generated workouts.";
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
          max_tokens: 600,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!r.ok) {
        return Response.json({ error: "Anthropic API: " + await r.text() }, { status: 502 });
      }
      const data = await r.json();
      workout = data?.content?.[0]?.text ||
        buildWorkoutFromLibrary({ type: sessionType, sessionName, phase: phaseName, weekIndex, dayIndex, sessionIdx });
    } catch (e) {
      workout = buildWorkoutFromLibrary({ type: sessionType, sessionName, phase: phaseName, weekIndex, dayIndex, sessionIdx });
    }
  }

  await cacheWorkout(supabase, user.id, weekIndex, dayIndex, sessionIdx, workout);
  return Response.json({ workout, source: regenerate ? "ai-regenerate" : "ai" });
}

async function cacheWorkout(supabase, userId, w, d, s, workout) {
  await supabase.from("plan_sessions").upsert({
    user_id: userId, week_index: w, day_index: d, session_idx: s,
    ai_workout: workout,
  }, { onConflict: "user_id,week_index,day_index,session_idx", ignoreDuplicates: false });
}

// Type-strict AI prompt — keeps Claude from drifting into the wrong domain.
function buildAIPrompt(type, sessionName, profile) {
  const rider = `${profile?.preset || "Sport"} (${profile?.level || "Intermediate"}), ${profile?.weekly_hours || 6} hrs/week, goal: ${profile?.goal || "Race fitness"}`;

  switch (type) {
    case "strength":
      return `Design a STRENGTH-TRAINING (weight-room / bodyweight) workout for this mountain biker.

Session: ${sessionName}
Rider: ${rider}

Format (use Markdown):
**Warm-up (5 min)**
• 2–3 dynamic moves

**Main set (4–6 exercises)**
• **Exercise name** — sets × reps — brief cue

**Cool-down (3 min)**
• 1–2 stretches

STRICT RULES:
- This is a STRENGTH session. ONLY weight-room or bodyweight exercises.
- DO NOT include intervals, RPE, HR zones, watts, "spin", or anything cycling/cardio.
- Use sets × reps, not duration × intensity.
- 10–14 lines total, no filler.`;

    case "yoga":
      return `Design a YOGA / MOBILITY session for this mountain biker.

Session: ${sessionName}
Rider: ${rider}

Format (Markdown):
**Sequence**
• **Pose name** — hold time or breath count — what it targets

STRICT RULES:
- 6–10 poses in flow order.
- ${/(recover|post|cool|restorative)/i.test(sessionName) ? "Restorative — longer holds (1–3 min)." : "Dynamic — 3–5 breaths each, building heat."}
- NO weights, NO intervals, NO cycling. Only yoga and mobility moves.`;

    case "run":
      return `Design a RUNNING session for this mountain biker (cross-training).

Session: ${sessionName}
Rider: ${rider}

Format (Markdown):
**Warm-up** — easy jog + dynamic drills
**Main** — running intervals with pace/effort + recovery
**Cool-down** — easy + 2–3 stretches

STRICT RULES:
- Running only. Use pace zones (easy, moderate, tempo, threshold) or RPE 1–10.
- NO cycling, NO weights.
- 20–45 min total session.`;

    case "rope":
      return `Design a FLOW-ROPE / coordination session for this mountain biker.

Session: ${sessionName}
Rider: ${rider}

Format (Markdown):
**Warm-up**
• **Drill** — duration — cue

**Main**
• 4–5 drills, progressing simple → complex

**Cool-down**
• Slow free-flow

STRICT RULES:
- Flow-rope drills only (figure-8s, halos, wraps, passes, free-flow).
- NO weights, NO running, NO cycling.
- 15–25 min total.`;

    case "ride":
    default:
      return `Design a CYCLING workout for this mountain biker.

Session: ${sessionName}
Rider: ${rider}

Format (Markdown):
**Warm-up (10 min)** — easy spin building gradually
**Main set** — intervals with exact durations + RPE 1–10 OR HR zones
**Cool-down (5 min)** — easy spin

Match total session length to weekly hours. Keep concise: 10–15 lines.`;
  }
}
