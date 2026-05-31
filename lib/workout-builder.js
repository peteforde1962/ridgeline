// Type-aware workout builder. Pulls actual content from the libraries so a
// "strength" session shows real exercises, not an AI-hallucinated cycling
// workout. The AI Coach is still available via the Regenerate button — but
// it now gets a type-specific prompt that won't drift back into intervals.

import {
  STRENGTH_EXERCISES,
  YOGA_POSES,
  RUN_SESSIONS,
  FLOW_ROPE_DRILLS,
} from "./training-content";

// --- Helpers ---

// Map a session NAME to the most likely strength-workout grouping.
// Falls back to a sensible default for the rider's general fitness.
const STRENGTH_GROUP_KEYWORDS = {
  "Lower-body Power":  ["lower", "legs", "leg ", "quad", "glute", "squat", "deadlift", "power"],
  "Upper + Core":      ["upper", "core", "push", "pull", "bench", "row", "press", "arm"],
  "Cycling Endurance": ["endurance", "cycling", "bike-specific", "trail-ready", "specific"],
  "Stability":         ["stability", "balance", "skill", "rehab", "ankle", "wrist"],
  "Power":             ["plyo", "explosive", "jump", "broad", "box", "speed"],
  "Posterior":         ["posterior", "back ", "glute-focus", "hamstring", "hinge"],
};

function pickStrengthGroup(sessionName) {
  const lower = (sessionName || "").toLowerCase();
  let best = null, bestScore = 0;
  for (const [group, keywords] of Object.entries(STRENGTH_GROUP_KEYWORDS)) {
    const score = keywords.reduce((a, k) => a + (lower.includes(k) ? 1 : 0), 0);
    if (score > bestScore) { bestScore = score; best = group; }
  }
  return best || "Lower-body Power";
}

// Pick N items pseudo-randomly but deterministically based on session key,
// so a refresh shows the same workout — only "Regenerate" changes it.
function deterministicSample(items, n, seed = 0) {
  const indices = items.map((_, i) => i);
  // simple seeded shuffle (mulberry32)
  let s = seed || 1;
  for (let i = indices.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, n).map((i) => items[i]);
}

function hashSeed(...parts) {
  let h = 2166136261 >>> 0;
  for (const p of parts.join("|")) {
    h = (h ^ p.charCodeAt(0)) * 16777619 >>> 0;
  }
  return h;
}

// --- Per-type builders ---

function buildStrength(sessionName, seed) {
  const group = pickStrengthGroup(sessionName);
  const pool = STRENGTH_EXERCISES.filter((e) => e.workout === group);
  const picked = deterministicSample(pool, Math.min(6, pool.length), seed);

  let md = `# ${sessionName}\n_Focus: **${group}**_\n\n`;
  md += `**Warm-up (5 min)**\n`;
  md += `• Light cardio — easy spin, jog, or jumping jacks\n`;
  md += `• 2–3 dynamic stretches (leg swings, arm circles, hip openers)\n\n`;
  md += `**Main set**\n`;
  for (const ex of picked) {
    md += `• **${ex.name}** — ${ex.sets} _(${ex.note})_\n`;
  }
  md += `\n**Cool-down (5 min)**\n`;
  md += `• Walk it out, then stretch hips, hamstrings, and chest\n\n`;
  md += `_For variations, see the [Strength library](/strength)._`;
  return md;
}

function buildYoga(sessionName, seed) {
  const isRecovery = /(recover|post|cool|restorative|relax)/i.test(sessionName);
  const type = isRecovery ? "Recovery" : "Warm-up";
  const pool = YOGA_POSES.filter((p) => p.type === type);
  const picked = deterministicSample(pool, 8, seed);

  let md = `# ${sessionName}\n_${isRecovery ? "Restorative / recovery" : "Pre-ride dynamic"} flow_\n\n`;
  md += `**Sequence**\n`;
  for (const p of picked) {
    md += `• **${p.name}** — ${p.reps} _(${p.why})_\n`;
  }
  md += `\n_For more poses, see the [Yoga & Mobility library](/yoga)._`;
  return md;
}

function buildRun(sessionName, phase, seed) {
  const phaseKey = (phase || "").toLowerCase();
  let pool = RUN_SESSIONS.filter((s) => (s.phase || "").toLowerCase() === phaseKey);
  if (pool.length === 0) pool = RUN_SESSIONS.filter((s) => s.phase === "Anytime");
  if (pool.length === 0) pool = RUN_SESSIONS;
  const pick = deterministicSample(pool, 1, seed)[0];

  let md = `# ${sessionName}\n_${pick.name}_\n\n`;
  md += `**Duration**\n${pick.time}\n\n`;
  md += `**Focus**\n${pick.note}\n\n`;
  md += `_For other run sessions, see the [Running library](/run)._`;
  return md;
}

function buildRope(sessionName, seed) {
  // Lead with a warmup drill, then 4 main drills, then a cool-down flow.
  const warmups = FLOW_ROPE_DRILLS.filter((d) => d.tags.includes("warmup") || d.tags.includes("beginner"));
  const cools   = FLOW_ROPE_DRILLS.filter((d) => d.tags.includes("cooldown"));
  const mains   = FLOW_ROPE_DRILLS.filter((d) => !d.tags.includes("warmup") && !d.tags.includes("cooldown"));

  const warmup = deterministicSample(warmups, 1, seed)[0];
  const main   = deterministicSample(mains, 4, seed + 1);
  const cool   = deterministicSample(cools, 1, seed + 2)[0] || FLOW_ROPE_DRILLS[FLOW_ROPE_DRILLS.length - 1];

  let md = `# ${sessionName}\n_Flow rope — coordination, shoulder mobility, breath_\n\n`;
  md += `**Warm-up**\n• **${warmup.name}** — ${warmup.time} _(${warmup.focus})_\n\n`;
  md += `**Main set**\n`;
  for (const d of main) {
    md += `• **${d.name}** — ${d.time} _(${d.focus})_\n`;
  }
  md += `\n**Cool-down**\n• **${cool.name}** — ${cool.time} _(${cool.focus})_\n\n`;
  md += `_For more drills, see the [Flow Rope library](/rope)._`;
  return md;
}

function buildRide(sessionName) {
  // Rides are infinitely variable. Provide a sane structural default; rider
  // can hit Regenerate to get an AI-tuned interval session.
  let md = `# ${sessionName}\n\n`;
  md += `**Warm-up (10 min)**\n`;
  md += `• 5 min easy spin, RPE 3\n`;
  md += `• 2 × 30 sec gradual acceleration to RPE 5\n`;
  md += `• 3 min easy recovery\n\n`;
  md += `**Main set**\nRide as described in the session name and notes.\n`;
  md += `Hit **Regenerate with Coach** for specific intervals matched to your fitness.\n\n`;
  md += `**Cool-down (5 min)**\n• Easy spin, RPE 2–3`;
  return md;
}

// --- Public entrypoint ---

export function buildWorkoutFromLibrary({ type, sessionName, phase, weekIndex, dayIndex, sessionIdx }) {
  const seed = hashSeed(type, sessionName || "", weekIndex ?? 0, dayIndex ?? 0, sessionIdx ?? 0);
  switch (type) {
    case "strength": return buildStrength(sessionName, seed);
    case "yoga":     return buildYoga(sessionName, seed);
    case "run":      return buildRun(sessionName, phase, seed);
    case "rope":     return buildRope(sessionName, seed);
    case "ride":     return buildRide(sessionName);
    default:         return null;
  }
}
