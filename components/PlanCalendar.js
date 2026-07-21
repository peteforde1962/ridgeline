"use client";

// Month-grid view of the plan. Pairs with the existing week list view at /plan;
// toggle is in the URL (`?view=calendar`).
//
// Each day cell shows up to 3 compact session pills + extras + a today highlight
// + click-through to the day-detail page. Days outside the plan's date range
// render dim and aren't clickable.

import { useMemo, useState } from "react";
import { sessionLabel, sessionTagClass, rideToPlanIndex } from "@/lib/plan";

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
  ridesByDate,       // NEW: { "YYYY-MM-DD": [{ minutes, activity_kind }, ...] }
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

          // Build list of (type, status) pills for this day.
          const pills = [];
          if (dayObj) {
            dayObj.details.forEach((s, si) => {
              if (s.type === "rest") return;
              const row = stored?.[si];
              // Skip pills the user deleted via the Delete button on a template session.
              if (row?.tweak === "removed") return;
              const eff = row?.swapped_to || s.type;
              const done = !!row?.completed;
              const skipped = row?.tweak === "skipped";
              pills.push({ type: eff, done, skipped, extra: false });
            });
            extras.forEach((e) => {
              if (e.tweak === "removed") return;
              pills.push({ type: e.swapped_to || "ride", done: !!e.completed, skipped: false, extra: true });
            });
          }

          const MAX_PILLS = 3;
          const visible = pills.slice(0, MAX_PILLS);
          const overflow = pills.length - visible.length;

          const cellBg = isToday
            ? "rgba(248,182,166,0.15)"
            : (inMonth ? "var(--panel)" : "transparent");

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
                border: isToday ? "1.5px solid var(--accent)" : "1px solid var(--line)",
                borderRadius: 8,
                padding: 6,
                minHeight: 86,
                opacity: inMonth ? 1 : 0.35,
                cursor: "pointer",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div className="flex items-baseline justify-between mb-1 gap-1">
                <span className={`text-xs font-semibold ${isToday ? "text-[var(--accent)]" : ""}`}>
                  {date.getDate()}
                </span>
                <div className="flex items-center gap-1">
                  {ridesByDate?.[dateStr]?.length > 0 && (
                    <span
                      title={`${ridesByDate[dateStr].length} activit${ridesByDate[dateStr].length === 1 ? "y" : "ies"} recorded`}
                      style={{
                        display: "inline-block",
                        width: 6, height: 6, borderRadius: "50%",
                        background: "var(--accent)",
                        boxShadow: "0 0 4px rgba(242,104,56,.6)",
                      }}
                    />
                  )}
                  {hasNote && <span className="text-[10px] text-[var(--accent2,#fccabb)]">✎</span>}
                </div>
              </div>

              <div className="flex flex-wrap gap-0.5">
                {visible.map((p, j) => (
                  <span
                    key={j}
                    className={`text-[9px] px-1.5 py-0.5 rounded ${sessionTagClass(p.type)}`}
                    style={{
                      opacity: p.skipped ? 0.5 : 1,
                      textDecoration: p.skipped ? "line-through" : "none",
                      fontWeight: 700,
                    }}
                    title={sessionLabel(p.type) + (p.done ? " · done" : "") + (p.extra ? " · extra" : "")}
                  >
                    {p.done && "✓"}{!p.done && p.extra && "+"}{sessionLabel(p.type).slice(0, 4)}
                  </span>
                ))}
                {overflow > 0 && (
                  <span className="text-[9px] text-[var(--muted)] font-semibold px-1.5 py-0.5">
                    +{overflow}
                  </span>
                )}
                {pills.length === 0 && inPlan && (
                  <span className="text-[9px] text-[var(--muted)] italic">Rest</span>
                )}
                {pills.length === 0 && !inPlan && ridesByDate?.[dateStr]?.length > 0 && (
                  <span className="text-[9px] text-[var(--muted)] italic">Activity</span>
                )}
              </div>
            </Cell>
          );
        })}
      </div>

      <p className="text-[10px] text-[var(--muted)] mt-3">
        Click a plan day to view details. Pills: ✓ done, + extra, strikethrough = skipped. Peach dot = synced activity that day.
      </p>
    </div>
  );
}
