"use client";

// Month-grid view of the plan. Pairs with the existing week list view at /plan;
// toggle is in the URL (`?view=calendar`).
//
// Each day cell shows up to 3 compact session pills + extras + a today highlight
// + click-through to the day-detail page. Days outside the plan's date range
// render dim and aren't clickable.

import { useMemo, useState } from "react";
import { sessionLabel, sessionTagClass, rideToPlanIndex, activePause } from "@/lib/plan";
import { sportInfo } from "@/lib/activity";

// Map an activity kind to a plan session type so we can reuse sessionTagClass
// for consistent tag colors across the app. Keeps MTB/E-MTB visually grouped
// with rides, Strength with strength, etc.
const KIND_TO_PLAN_TYPE = {
  cycle: "ride", run: "run", strength: "strength", yoga: "yoga",
  rope: "rope", hike: "run", swim: "rest", ski: "rest",
  paddle: "rest", climb: "rest", other: "rest",
};

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DOW = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

// Build the 6-row × 7-col grid for a given month. Each cell carries a Date and
// inMonth flag so cells outside the visible month can dim.
function buildGrid(year, month) {
  const first = new Date(year, month, 1);
  // Start the grid on the Monday of the week containing the 1st.
  const offsetToMon = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - offsetToMon);
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push({ date: d, inMonth: d.getMonth() === month });
  }
  return cells;
}

export default function PlanCalendar({
  plan,
  startedAt,
  sessionsByDay,
  extrasByDay,
  notesByDay,
  ridesByDate,       // { "YYYY-MM-DD": [{ minutes, activity_kind, sport_type }, ...] }
  pauses,            // [{ starts_on, ends_on, reason }, ...]
  todayYMD,
}) {
  // Default to the month containing today (or today's local month if no plan).
  const todayDate = new Date();
  const [{ year, month }, setMonth] = useState({
    year:  todayDate.getFullYear(),
    month: todayDate.getMonth(),
  });

  const cells = useMemo(() => buildGrid(year, month), [year, month]);

  function go(delta) {
    let m = month + delta;
    let y = year;
    while (m < 0)  { m += 12; y -= 1; }
    while (m > 11) { m -= 12; y += 1; }
    setMonth({ year: y, month: m });
  }
  function jumpToToday() {
    const t = new Date();
    setMonth({ year: t.getFullYear(), month: t.getMonth() });
  }

  const planLength = plan.length;

  return (
    <div className="card">
      {/* Header — month label + nav */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-extrabold">{MONTH_LABELS[month]} {year}</h2>
          <button onClick={jumpToToday}
                  className="btn-ghost text-xs"
                  style={{ padding: "4px 10px" }}>
            Today
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={() => go(-1)} className="btn-ghost text-sm" style={{ padding: "4px 12px" }}>← Prev</button>
          <button onClick={() => go(+1)} className="btn-ghost text-sm" style={{ padding: "4px 12px" }}>Next →</button>
        </div>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DOW.map((d) => (
          <div key={d} className="text-[10px] uppercase tracking-wide text-[var(--muted)] text-center font-semibold py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map(({ date, inMonth }, i) => {
          const dateStr = ymd(date);
          const planIdx = rideToPlanIndex(startedAt, dateStr, planLength);

          const isToday = dateStr === todayYMD;
          const key     = planIdx ? `${planIdx.weekIndex}-${planIdx.dayIndex}` : null;
          const dayObj  = planIdx ? plan[planIdx.weekIndex]?.days?.[planIdx.dayIndex] : null;
          const stored  = key ? sessionsByDay[key] : null;
          const extras  = key ? (extrasByDay[key] || []) : [];
          const hasNote = key && notesByDay.has(key);

          // Build list of (type, status) pills for this day + tally planned
          // minutes so we can show a per-day total at the bottom of each cell.
          // Also track which synced ride IDs are already represented as plan
          // pills so we don't double-render the same activity as two pills.
          const pills = [];
          const coveredRideIds = new Set();
          let plannedMin = 0;
          if (dayObj) {
            dayObj.details.forEach((s, si) => {
              if (s.type === "rest") return;
              const row = stored?.[si];
              if (row?.tweak === "removed") return;
              const eff = row?.swapped_to || s.type;
              const done = !!row?.completed;
              const skipped = row?.tweak === "skipped";
              pills.push({ type: eff, done, skipped, extra: false });
              if (row?.ride_id) coveredRideIds.add(row.ride_id);
              if (row?.planned_minutes && !skipped) plannedMin += row.planned_minutes;
            });
            extras.forEach((e) => {
              if (e.tweak === "removed") return;
              pills.push({ type: e.swapped_to || "ride", done: !!e.completed, skipped: false, extra: true });
              if (e.ride_id) coveredRideIds.add(e.ride_id);
              if (e.planned_minutes) plannedMin += e.planned_minutes;
            });
          }

          // Sum synced-activity minutes for the day-total line, and produce
          // the list of rides we still need to render as their own pills
          // (i.e. rides NOT already attached to a plan session for this day).
          const ridesToday = ridesByDate?.[dateStr] || [];
          const actualMin = ridesToday.reduce((a, r) => a + (+r.minutes || 0), 0);
          const uncoveredRides = ridesToday.filter((r) => !coveredRideIds.has(r.id));

          const MAX_PILLS = 3;
          const visible = pills.slice(0, MAX_PILLS);
          const overflow = pills.length - visible.length;

          // Holiday check — is this date inside any of the user's pauses?
          const holiday = activePause(dateStr, pauses || []);

          const cellBg = holiday
            ? "repeating-linear-gradient(45deg, rgba(248,182,166,.10) 0 6px, rgba(248,182,166,.04) 6px 12px)"
            : isToday
              ? "rgba(248,182,166,0.15)"
              : (inMonth ? "var(--panel)" : "transparent");

          const cellBorder = holiday
            ? "1px dashed rgba(248,182,166,.55)"
            : isToday
              ? "1.5px solid var(--accent)"
              : "1px solid var(--line)";

          // Every day is clickable now — routes to the universal /day/[date]
          // view so athletes can add workouts on ANY day, not just plan days.
          const inPlan = !!planIdx;
          const href   = `/day/${dateStr}`;
          const Cell   = "a";

          return (
            <Cell
              key={i}
              href={href}
              className="transition-opacity hover:opacity-90 block"
              style={{
                background: cellBg,
                border: cellBorder,
                borderRadius: 8,
                padding: 6,
                minHeight: 100,
                opacity: inMonth ? 1 : 0.35,
                cursor: "pointer",
                textDecoration: "none",
                color: "inherit",
                display: "flex",
                flexDirection: "column",
              }}
              title={holiday ? `On holiday${holiday.reason ? " · " + holiday.reason : ""}` : undefined}
            >
              <div className="flex items-baseline justify-between mb-1 gap-1">
                <span className={`text-xs font-semibold ${isToday ? "text-[var(--accent)]" : ""}`}>
                  {date.getDate()}
                </span>
                <div className="flex items-center gap-1">
                  {holiday && (
                    <span className="text-[9px] font-bold uppercase px-1 rounded"
                          style={{ background: "var(--accent)", color: "#1a2a30", letterSpacing: "0.5px" }}>
                      hol
                    </span>
                  )}
                  {hasNote && <span className="text-[10px] text-[var(--accent2,#fccabb)]">✎</span>}
                </div>
              </div>

              <div className="flex flex-wrap gap-0.5">
                {/* Plan pills (template + extras) */}
                {visible.map((p, j) => (
                  <span
                    key={j}
                    className={`text-[9px] px-1.5 py-0.5 rounded ${sessionTagClass(p.type)}`}
                    style={{
                      opacity: p.skipped ? 0.5 : 1,
                      textDecoration: p.skipped ? "line-through" : "none",
                      fontWeight: 700,
                      // Completed pills get a subtle green tint so "done" pops
                      // visually without changing the underlying kind color.
                      boxShadow: p.done ? "inset 0 0 0 1px rgba(92,184,92,.55)" : undefined,
                    }}
                    title={sessionLabel(p.type) + (p.done ? " · done" : "") + (p.extra ? " · extra" : "")}
                  >
                    {p.done && <span style={{ color: "#5cb85c" }}>✓</span>}
                    {!p.done && p.extra && "+"}
                    {sessionLabel(p.type).slice(0, 4)}
                  </span>
                ))}
                {overflow > 0 && (
                  <span className="text-[9px] text-[var(--muted)] font-semibold px-1.5 py-0.5">
                    +{overflow}
                  </span>
                )}
                {pills.length === 0 && inPlan && !holiday && ridesToday.length === 0 && (
                  <span className="text-[9px] text-[var(--muted)] italic">Rest</span>
                )}
                {pills.length === 0 && ridesToday.length === 0 && holiday && (
                  <span className="text-[9px] italic" style={{ color: "var(--accent2,#fccabb)" }}>
                    Pause{holiday.reason ? ` · ${holiday.reason}` : ""}
                  </span>
                )}

                {/* Synced-activity pills — MTB, E-MTB, Strength, etc. Only
                    render rides that AREN'T already represented as a plan pill
                    (via auto-tick's ride_id), so the same activity never shows
                    twice. Full opacity so their color matches the plan pills. */}
                {uncoveredRides.map((r, idx) => {
                  const info = sportInfo(r.sport_type);
                  const type = KIND_TO_PLAN_TYPE[info.kind] || "rest";
                  return (
                    <span
                      key={`r-${r.id || idx}`}
                      className={`text-[9px] px-1.5 py-0.5 rounded ${sessionTagClass(type)}`}
                      style={{ fontWeight: 700 }}
                      title={`${info.label} · ${r.minutes} min (synced, no plan slot)`}
                    >
                      • {info.label}
                    </span>
                  );
                })}
              </div>

              {/* Footer line — total minutes for the day (planned + actual).
                  Pushed to the bottom with mt-auto so cells stay uniform height. */}
              {(plannedMin > 0 || actualMin > 0) && (
                <div className="mt-auto pt-1.5 flex justify-between items-baseline gap-1 text-[9px]"
                     style={{ borderTop: "1px dashed rgba(255,255,255,.06)" }}>
                  {plannedMin > 0 ? (
                    <span className="text-[var(--muted)]" title="Planned">
                      Plan {plannedMin >= 60 ? `${Math.floor(plannedMin/60)}h${plannedMin%60 ? plannedMin%60 : ""}` : `${plannedMin}m`}
                    </span>
                  ) : <span />}
                  {actualMin > 0 && (
                    <span className="font-bold" style={{ color: "var(--accent2,#fccabb)" }} title="Actual synced">
                      ↑ {actualMin >= 60 ? `${Math.floor(actualMin/60)}h${actualMin%60 ? actualMin%60 : ""}` : `${actualMin}m`}
                    </span>
                  )}
                </div>
              )}
            </Cell>
          );
        })}
      </div>

      <p className="text-[10px] text-[var(--muted)] mt-3 leading-relaxed">
        Click any day to view details. Plan pills: <strong>✓</strong> done, <strong>+</strong> extra, strikethrough = skipped.
        Pills starting with <strong>•</strong> are synced activities (MTB, Strength, E-MTB, etc.).
        <br />
        Footer: <strong>Plan</strong> = planned duration for the day, <strong>↑</strong> = actual minutes synced from Strava/Suunto.
        Diagonal peach lines = <strong>holiday / plan pause</strong>.
      </p>
    </div>
  );
}
