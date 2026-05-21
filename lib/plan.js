// Plan generation. Pure functions — no database calls here.
// Takes a profile (plan_weeks, intensity, etc.) and returns a structured plan.

export const PHASES = [
  { key: "base",     name: "Base",     weeks: 4, desc: "Aerobic endurance + general strength foundation." },
  { key: "build",    name: "Build",    weeks: 4, desc: "Threshold, sweet-spot, hill repeats. Stack the load." },
  { key: "peak",     name: "Peak",     weeks: 2, desc: "Race-specific intensity, VO2, openers." },
  { key: "race",     name: "Race",     weeks: 1, desc: "Taper. Sharpen. Rest. Then send it." },
  { key: "recovery", name: "Recovery", weeks: 1, desc: "Active recovery, mobility-heavy week." },
];

// Each phase: 7 days, each day is an array of session types.
export const PLAN_TEMPLATE = {
  base: [
    ["yoga","strength"],
    ["ride"],
    ["rope","yoga"],
    ["ride","strength"],
    ["rest"],
    ["ride"],
    ["run","yoga"],
  ],
  build: [
    ["strength"],
    ["ride"],
    ["yoga","rope"],
    ["ride","strength"],
    ["rest"],
    ["ride"],
    ["run","yoga"],
  ],
  peak: [
    ["yoga"],
    ["ride"],
    ["rope"],
    ["ride"],
    ["rest"],
    ["ride"],
    ["yoga"],
  ],
  race: [
    ["yoga"],
    ["ride"],
    ["rest"],
    ["ride"],
    ["rest"],
    ["ride"],
    ["yoga","rest"],
  ],
  recovery: [
    ["yoga"],
    ["run"],
    ["yoga","rope"],
    ["ride"],
    ["yoga"],
    ["ride"],
    ["rest"],
  ],
};

export const DAY_NAMES = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

export function sessionLabel(type) {
  return ({
    ride: "Ride",
    strength: "Strength",
    yoga: "Yoga",
    run: "Run",
    rope: "Flow Rope",
    rest: "Rest",
  })[type] || type;
}

// Dark-teal+peach tag colors. Used by /today and other places that still show
// tags as labelled chips. The /plan grid now uses icons-only via PlanDayCell.
export function sessionTagClass(type) {
  return ({
    ride:     "bg-[#f8b6a6]/20 text-[#f8b6a6] border border-[#f8b6a6]/60",
    strength: "bg-[#5fa7c4]/20 text-[#9ccede] border border-[#5fa7c4]/60",
    yoga:     "bg-[#5cb85c]/20 text-[#aaddaa] border border-[#5cb85c]/60",
    run:      "bg-[#f0ad4e]/20 text-[#f5cb87] border border-[#f0ad4e]/60",
    rope:     "bg-[#b59cd9]/20 text-[#c9b5e3] border border-[#b59cd9]/60",
    rest:     "bg-[#2f3334]/60 text-[#a7bcc4] border border-[#2d5c6c]/60",
  })[type] || "bg-[#2f3334]/60 text-[#a7bcc4] border border-[#2d5c6c]/60";
}

// Icon name (used by PlanDayCell + SessionCard) for each session type.
export function sessionIconName(type) {
  return ({
    ride: "bike", strength: "dumb", yoga: "yoga",
    run: "run", rope: "rope", rest: "moon",
  })[type] || "moon";
}

// Color for a session type chip (just hex of the accent color).
export function sessionColor(type) {
  return ({
    ride: "#f8b6a6", strength: "#5fa7c4", yoga: "#5cb85c",
    run: "#f0ad4e", rope: "#b59cd9", rest: "#a7bcc4",
  })[type] || "#a7bcc4";
}

function workoutDetailsFor(phase, dayIdx, sessions) {
  const out = [];
  for (const s of sessions) {
    if (s === "ride") {
      if (phase === "base") {
        out.push({ type: "ride", name: ["60 min Z2 endurance","45 min easy spin","2 hr endurance ride","90 min tempo (15 min Z3 × 2)"][dayIdx % 4],
                   notes: "Conversational pace. Eat & drink consistently." });
      } else if (phase === "build") {
        out.push({ type: "ride", name: ["75 min w/ 4×8 min @ threshold","Sweet-spot 3×12 min","2.5 hr w/ climbs","Tempo + 6 short sprints"][dayIdx % 4],
                   notes: "Track HR or RPE 7–8. Full recovery between intervals." });
      } else if (phase === "peak") {
        out.push({ type: "ride", name: ["5×3 min VO2 @ all-out","Race-pace 30/30 intervals","60 min opener w/ 3×1 min","Long ride w/ race-pace efforts"][dayIdx % 4],
                   notes: "Quality over quantity. Skip if fatigued." });
      } else if (phase === "race") {
        out.push({ type: "ride", name: dayIdx === 5 ? "🏁 RACE DAY" : "20 min spin + 3×30 sec openers",
                   notes: dayIdx === 5 ? "Warm up. Pace yourself. Send." : "Wake legs up. Stay fresh." });
      } else {
        out.push({ type: "ride", name: "Easy trail spin — no Strava",
                   notes: "Ride for joy. Stop for snacks." });
      }
    } else if (s === "strength") {
      out.push({ type: "strength", name: ["Lower-body Power","Upper + Core","Cycling-Specific Endurance"][(dayIdx + (phase==="build"?1:0)) % 3],
                 notes: "Open the Strength tab for the full lift list." });
    } else if (s === "yoga") {
      out.push({ type: "yoga", name: dayIdx % 2 === 0 ? "Pre-ride dynamic flow (15 min)" : "Post-ride restorative (20 min)",
                 notes: "Open the Yoga tab for the pose sequence." });
    } else if (s === "run") {
      out.push({ type: "run", name: phase === "recovery" ? "20 min easy trail jog" : "30–40 min easy aerobic run",
                 notes: "Nasal-breathing pace. Skip if knees are unhappy." });
    } else if (s === "rope") {
      out.push({ type: "rope", name: "Flow rope — 15 min skills",
                 notes: "Coordination + grip relaxation. Move smoothly." });
    } else if (s === "rest") {
      out.push({ type: "rest", name: "Full rest day",
                 notes: "Walk, hydrate, sleep. Adaptation happens now." });
    }
  }
  return out;
}

// Given a 0-indexed week + day, what calendar date is that?
// startedAt is "YYYY-MM-DD". day_index 0 = Monday.
export function dateForDay(startedAt, weekIndex, dayIndex) {
  if (!startedAt) return null;
  const start = new Date(startedAt + "T00:00:00");
  // Anchor week 0 day 0 to the Monday of the start week.
  const day = start.getDay(); // 0=Sun..6=Sat
  const offsetToMon = (day + 6) % 7; // 0 if Mon, 6 if Sun
  start.setDate(start.getDate() - offsetToMon);
  start.setDate(start.getDate() + weekIndex * 7 + dayIndex);
  return start.toISOString().slice(0, 10);
}

export function formatShortDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Build a customizable N-week plan from a profile.
export function buildPlan(profile) {
  const totalWeeks = profile?.plan_weeks || 12;
  const scale = totalWeeks / 12;

  // Proportionally allocate weeks to each phase, ensuring at least 1 each.
  const allocations = PHASES.map(p => Math.max(1, Math.round(p.weeks * scale)));
  // Fix any rounding drift so totals match totalWeeks.
  let drift = totalWeeks - allocations.reduce((a, b) => a + b, 0);
  let idx = 0;
  while (drift !== 0) {
    allocations[idx % allocations.length] += Math.sign(drift);
    drift -= Math.sign(drift);
    idx++;
  }

  const weeks = [];
  let weekNum = 1;
  for (let pi = 0; pi < PHASES.length; pi++) {
    const phase = PHASES[pi];
    const phaseTotalWeeks = allocations[pi];
    for (let j = 0; j < allocations[pi]; j++) {
      weeks.push({
        week: weekNum++,
        phase: phase.key,
        phaseName: phase.name,
        phaseWeek: j + 1,
        phaseTotalWeeks,
        days: PLAN_TEMPLATE[phase.key].map((sessions, dayIdx) => ({
          day: DAY_NAMES[dayIdx],
          sessions,
          details: workoutDetailsFor(phase.key, dayIdx, sessions),
        })),
      });
    }
  }
  return weeks;
}

// Reverse of dateForDay: given a date (YYYY-MM-DD), figure out which plan week+day
// it falls on. Returns null if outside the plan range.
export function rideToPlanIndex(startedAt, rideDate, totalWeeks) {
  if (!startedAt || !rideDate) return null;
  const start = new Date(startedAt + "T00:00:00");
  // Anchor to Monday of start week (same rule as dateForDay/currentWeekIndex).
  const day = start.getDay();
  const offsetToMon = (day + 6) % 7;
  start.setDate(start.getDate() - offsetToMon);

  const ride = new Date(rideDate + "T00:00:00");
  const diffDays = Math.floor((ride - start) / 86400_000);
  if (diffDays < 0) return null;
  const weekIndex = Math.floor(diffDays / 7);
  if (weekIndex >= totalWeeks) return null;
  return { weekIndex, dayIndex: diffDays % 7 };
}

// Which week (0-indexed) is the user currently in?
// Anchors to the Monday of the start week (same logic as dateForDay) so the
// week number always matches the calendar grid the user sees.
// Uses local-midnight parsing so timezones don't shift the boundary.
export function currentWeekIndex(startedAt, totalWeeks) {
  if (!startedAt) return 0;
  const start = new Date(startedAt + "T00:00:00");
  const day = start.getDay();           // 0=Sun..6=Sat
  const offsetToMon = (day + 6) % 7;    // 0 if Mon, 6 if Sun
  start.setDate(start.getDate() - offsetToMon);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((today - start) / (1000 * 60 * 60 * 24));
  return Math.min(totalWeeks - 1, Math.max(0, Math.floor(diffDays / 7)));
}

// Which day of the week (0=Mon..6=Sun)?
export function todayDayIndex() {
  const d = new Date().getDay(); // 0=Sun..6=Sat
  return (d + 6) % 7;             // Mon=0..Sun=6
}

// Scale a session name's numbers by intensity (very simple: nudge any "30 min" / "4×8" tokens).
const INTENSITY_MULT = { easier: 0.75, standard: 1, harder: 1.25 };
export function scaleSessionName(name, intensity) {
  const mult = INTENSITY_MULT[intensity] ?? 1;
  if (mult === 1) return name;
  return name.replace(/(\d+)\s*(min|sec|mi|hr|×)/g, (_, n, u) => {
    const v = Math.max(1, Math.round(+n * mult));
    return `${v} ${u}`;
  });
}

export function readinessFromCheckin(c) {
  if (!c) return null;
  const score = c.sleep + c.energy - c.soreness;
  if (score <= 3)  return { score, level: "low",      label: "Low readiness — go Easier", suggested: "easier"   };
  if (score >= 8)  return { score, level: "high",     label: "High readiness — try Harder", suggested: "harder" };
  return                  { score, level: "standard", label: "Standard day",               suggested: "standard" };
}
