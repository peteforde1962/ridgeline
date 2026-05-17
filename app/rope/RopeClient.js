"use client";

import SearchableList from "@/components/SearchableList";

export default function RopeClient({ drills }) {
  return (
    <SearchableList
      items={drills}
      placeholder="Search drills (e.g. shoulder, beginner, mobility)…"
      getSearchText={(d) => `${d.name} ${d.focus} ${(d.tags || []).join(" ")}`}
      renderItem={(d, i) => (
        <div key={d.id} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "var(--panel2)", border: "1px solid var(--line)" }}>
          <div className="w-8 h-8 rounded-md grid place-items-center font-bold flex-shrink-0"
               style={{ background: "rgba(184,58,45,.2)", color: "var(--accent3,#dcc9a9)" }}>
            {i + 1}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="font-bold">{d.name}</span>
              <span className="text-xs text-[var(--muted)] whitespace-nowrap">{d.time}</span>
            </div>
            <p className="text-sm text-[var(--muted)] mb-2">{d.focus}</p>
            <div className="flex flex-wrap gap-1">
              {(d.tags || []).map((t) => (
                <span key={t} className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--line)] text-[var(--muted)]">
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    />
  );
}
