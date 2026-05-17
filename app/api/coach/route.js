// POST /api/coach
// Streaming Coach AI. Loads rich context + streams Claude's reply token-by-token.
// API key stays server-side; never sent to the browser.

import { createClient } from "@/lib/supabase/server";
import { buildPlan, currentWeekIndex, todayDayIndex, sessionLabel } from "@/lib/plan";

export const runtime = "nodejs";

const MODEL_MAP = {
  haiku:  "claude-haiku-4-5-20251001",
  sonnet: "claude-sonnet-4-6",
};

export async function POST(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

    const body = await request.json();
    const messages = body.messages || [];
    const model = MODEL_MAP[body.model === "sonnet" ? "sonnet" : "haiku"];

    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "Send at least one message" }, { status: 400 });
    }

    // ---------- Load rich context ----------
    const today = new Date().toISOString().slice(0, 10);

    const [{ data: profile }, { data: recentCheckins }, { data: recentRides }, { data: planSessions }, { data: skills }] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("check_ins").select("*").eq("user_id", user.id).order("date", { ascending: false }).limit(7),
        supabase.from("rides").select("*, trails(name)").eq("user_id", user.id).order("date", { ascending: false }).limit(10),
        supabase.from("plan_sessions").select("week_index,day_index,session_idx,completed,tweak").eq("user_id", user.id),
        supabase.from("skills").select("key, rating").eq("user_id", user.id),
      ]);

    const plan = buildPlan(profile);
    const wIdx = currentWeekIndex(profile?.started_at, plan.length);
    const dIdx = todayDayIndex();
    const week = plan[wIdx];
    const todaySessions = week?.days?.[dIdx]?.details || [];

    // Completion stats (this week and overall)
    const thisWeekSessions = (planSessions || []).filter(s => s.week_index === wIdx);
    const thisWeekDone = thisWeekSessions.filter(s => s.completed).length;
    const overallDone = (planSessions || []).filter(s => s.completed).length;
    const totalScheduled = plan.reduce((a, w) => a + w.days.reduce((b, d) => b + d.details.filter(s => s.type !== "rest").length, 0), 0);

    const todayCheckin = (recentCheckins || []).find(c => c.date === today);

    const skillBlock = (skills || []).length === 0
      ? "(no self-rated skills yet)"
      : skills.map(s => `${s.key} ${s.rating}/10`).join(", ");

    const focusBlock = (profile?.focus_skills || []).length === 0
      ? "(none picked)"
      : profile.focus_skills.join(", ");

    const systemMsg = [
      "You are an expert mountain biking coach. You speak directly to the athlete.",
      "Be specific, concrete, brief. Use mountain biking language. Avoid hedging.",
      "Reference the athlete's actual data when answering. If a question has a number answer, give the number.",
      "If suggesting modifications, name the exact session and the change (e.g. 'replace today's tempo ride with a 25-min easy spin').",
      "",
      "── ATHLETE PROFILE ──",
      `Name: ${profile?.name || "rider"}`,
      `Preset: ${profile?.preset || "Sport"} · Level: ${profile?.level || "Intermediate"}`,
      `Weekly hours: ${profile?.weekly_hours ?? "?"} · Default intensity: ${profile?.intensity || "standard"}`,
      `Goal: ${profile?.goal || "Race fitness"}${profile?.race_date ? ` · Target date: ${profile.race_date}` : ""}`,
      `Self-rated skills: ${skillBlock}`,
      `Focus skills (plan should bias toward these): ${focusBlock}`,
      "",
      "── CURRENT PLAN STATE ──",
      `Plan length: ${plan.length} weeks. Started: ${profile?.started_at || "?"}`,
      `Current week: ${week?.week}/${plan.length} (${week?.phaseName} phase)`,
      `Today (${today}): ${todaySessions.length === 0 ? "Rest day" : todaySessions.map(s => `${sessionLabel(s.type)} — ${s.name}`).join(" + ")}`,
      `Completion: ${thisWeekDone} sessions done this week; ${overallDone}/${totalScheduled} overall (${Math.round(100 * overallDone / Math.max(1, totalScheduled))}%)`,
      "",
      "── TODAY'S BODY CHECK-IN ──",
      todayCheckin
        ? `Sleep ${todayCheckin.sleep}/10, soreness ${todayCheckin.soreness}/10, energy ${todayCheckin.energy}/10${todayCheckin.notes ? ` ("${todayCheckin.notes}")` : ""}`
        : "(none logged today — recommend logging one if relevant)",
      "",
      "── RECENT CHECK-INS (last 7 days) ──",
      ...(recentCheckins || []).slice(0, 7).map(c =>
        `${c.date}: sleep ${c.sleep}, soreness ${c.soreness}, energy ${c.energy}${c.notes ? ` "${c.notes}"` : ""}`
      ),
      (recentCheckins || []).length === 0 ? "(none)" : "",
      "",
      "── RECENT RIDES (last 10) ──",
      ...(recentRides || []).map(r =>
        `${r.date}: ${r.km ?? "?"}km · ${r.elev_m ?? "?"}m · ${r.minutes}min · feel ${r.feel || "?"}/5${r.trails?.name ? ` on ${r.trails.name}` : ""}${r.notes ? ` — ${r.notes}` : ""}`
      ),
      (recentRides || []).length === 0 ? "(none)" : "",
      "",
      `Today is ${today}. Keep answers ~120 words unless deeply technical. If the question is short, the answer should be too.`,
    ].filter(Boolean).join("\n");

    // ---------- Anthropic streaming call ----------
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const lastUserMsg = messages.filter(m => m.role === "user").pop()?.content || "";

    if (!apiKey) {
      // Local fallback — stream a single chunk so client code path is identical.
      const text = localCoach(lastUserMsg, profile);
      return new Response(text, {
        headers: { "Content-Type": "text/plain; charset=utf-8", "X-Coach-Source": "local-fallback" },
      });
    }

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        system: systemMsg,
        stream: true,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return Response.json({ error: "Anthropic API: " + errText }, { status: 502 });
    }

    // Parse Anthropic's SSE → emit plain text chunks to the client.
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = anthropicRes.body.getReader();
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            // SSE events are separated by blank lines.
            const events = buffer.split("\n\n");
            buffer = events.pop() || "";

            for (const event of events) {
              const dataLine = event.split("\n").find(l => l.startsWith("data: "));
              if (!dataLine) continue;
              try {
                const data = JSON.parse(dataLine.slice(6));
                if (data.type === "content_block_delta" && data.delta?.text) {
                  controller.enqueue(encoder.encode(data.delta.text));
                }
              } catch { /* ignore malformed lines */ }
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Coach-Source": `anthropic-${body.model === "sonnet" ? "sonnet" : "haiku"}`,
      },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

function localCoach(text, profile) {
  const t = (text || "").toLowerCase();
  if (/sore|tired|recover/.test(t))
    return "Recovery mode: swap today's hard ride for 20-min restorative yoga + 15-min easy spin. Reassess tomorrow.";
  if (/race|peak/.test(t))
    return "Race prep: 4 weeks build → 2 weeks peak → 1 week taper. Cut volume 40% race week. Test nutrition on long rides.";
  if (/corner/.test(t))
    return "Cornering: weight outside pedal, look through corner, lean bike more than body, brake BEFORE the apex. Rail one corner 20x to drill it.";
  if (/climb/.test(t))
    return "Climbs: stay seated, look up-trail not at obstacles. Pick a 3-min climb and ride it 5x with 5 min recovery.";
  return `Quick coach reply for ${profile?.name || "rider"}: small consistent training beats hero days. What's your most specific question?`;
}
