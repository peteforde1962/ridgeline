// POST /api/coach
// Authenticated AI coach endpoint.
// Server pulls the user's profile + recent training context and asks Claude.
// The Anthropic API key NEVER reaches the browser.

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs"; // keep on Node so we can use fetch with longer timeouts

export async function POST(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

    const body = await request.json();
    const messages = body.messages || [];
    if (!Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "Send at least one message" }, { status: 400 });
    }

    // Load lightweight training context so Claude can answer like it knows the rider.
    const today = new Date().toISOString().slice(0, 10);

    const [{ data: profile }, { data: recentCheckins }, { data: recentRides }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("check_ins").select("*").eq("user_id", user.id)
        .order("date", { ascending: false }).limit(7),
      supabase.from("rides").select("*, trails(name)").eq("user_id", user.id)
        .order("date", { ascending: false }).limit(10),
    ]);

    // Compose a compact system message — keep token count tight.
    const systemMsg = [
      "You are an expert mountain biking coach.",
      "Be specific, concrete, and brief. Use mountain biking language. Avoid hedging.",
      "If asked about training adaptations, lean on real exercise-science principles.",
      "",
      "ATHLETE PROFILE:",
      `- Name: ${profile?.name || "rider"}`,
      `- Preset: ${profile?.preset || "Sport"} (${profile?.level || "Intermediate"})`,
      `- Weekly hours available: ${profile?.weekly_hours || "?"}`,
      `- Default intensity: ${profile?.intensity || "standard"}`,
      `- Plan length: ${profile?.plan_weeks || 12} weeks`,
      `- Goal: ${profile?.goal || "Race fitness"}`,
      profile?.race_date ? `- Target event date: ${profile.race_date}` : "",
      "",
      "RECENT CHECK-INS (last 7 days):",
      ...(recentCheckins || []).map(c =>
        `- ${c.date}: sleep ${c.sleep}, soreness ${c.soreness}, energy ${c.energy}${c.notes ? ` ("${c.notes}")` : ""}`
      ),
      (recentCheckins || []).length === 0 ? "- (no check-ins yet)" : "",
      "",
      "RECENT RIDES (last 10):",
      ...(recentRides || []).map(r =>
        `- ${r.date}: ${r.miles}mi · ${r.elev_ft || "?"}ft · ${r.minutes}min · feel ${r.feel || "?"}/5${r.trails?.name ? ` on "${r.trails.name}"` : ""}${r.notes ? ` — ${r.notes}` : ""}`
      ),
      (recentRides || []).length === 0 ? "- (no rides logged yet)" : "",
      "",
      `Today is ${today}. Keep answers to ~150 words unless specifically asked for more detail.`,
    ].filter(Boolean).join("\n");

    // Call Anthropic.
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Fallback: a simple deterministic coach so the feature still works without a key.
      const lastUser = messages.filter(m => m.role === "user").pop()?.content || "";
      return Response.json({
        reply: localCoach(lastUser, profile),
        source: "local-fallback",
        note: "Add ANTHROPIC_API_KEY to environment variables for real LLM responses.",
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
        model: "claude-haiku-4-5-20251001",
        max_tokens: 800,
        system: systemMsg,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      return Response.json({ error: "Anthropic API error: " + errText }, { status: 502 });
    }

    const data = await anthropicRes.json();
    const reply = data?.content?.[0]?.text || "(no reply)";

    return Response.json({ reply, source: "anthropic", usage: data.usage });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// Tiny rule-based fallback if no API key is configured.
function localCoach(text, profile) {
  const t = (text || "").toLowerCase();
  if (/sore|tired|recover/.test(t))
    return "Recovery mode: swap today's hard ride for a 20-min restorative yoga + 15 min easy spin. Reassess tomorrow.";
  if (/race|peak/.test(t))
    return "Race prep: 4 weeks build → 2 weeks peak → 1 week taper. Cut volume 40% race week. Test nutrition on long rides.";
  if (/corner/.test(t))
    return "Cornering: weight outside pedal, look through corner, lean bike more than body, brake BEFORE the apex. Rail one corner 20x to drill it.";
  if (/climb/.test(t))
    return "Climbs: stay seated, look up-trail not at obstacles, pick a 3-min climb and ride it 5x with 5 min recovery.";
  return `Quick coach reply for ${profile?.name || "rider"}: small consistent training beats hero days. What's your most specific question?`;
}
