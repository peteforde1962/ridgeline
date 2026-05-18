"use client";

import SearchableList from "@/components/SearchableList";

export default function StrengthClient({ exercises }) {
  return (
    <SearchableList
      items={exercises}
      placeholder="Search exercises (e.g. squat, core, hamstrings, KB)…"
      getSearchText={(e) => `${e.name} ${e.workout} ${(e.tags || []).join(" ")} ${e.note || ""}`}
      groupBy={(e) => e.workout}
      renderItem={(e) => (
        <div key={e.id} className="card flex items-start gap-3" style={{ padding: 12 }}>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="font-bold">{e.name}</span>
              <span className="text-xs font-semibold text-[var(--accent)] whitespace-nowrap">{e.sets}</span>
            </div>
            <p className="text-sm text-[var(--muted)] mb-2">{e.note}</p>
            <div className="flex flex-wrap gap-1">
              {(e.tags || []).map((t) => (
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
