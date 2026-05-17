"use client";

import SearchableList from "@/components/SearchableList";

export default function RunClient({ sessions }) {
  return (
    <SearchableList
      items={sessions}
      placeholder="Search sessions (e.g. easy, hill, threshold)…"
      getSearchText={(s) => `${s.name} ${s.phase} ${(s.tags || []).join(" ")} ${s.note}`}
      groupBy={(s) => s.phase || "Anytime"}
      renderItem={(s) => (
        <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "var(--panel2)", border: "1px solid var(--line)" }}>
          <span className="text-xs px-2 py-1 rounded bg-[#a37650]/25 text-[#e3c094] border border-[#a37650]/60 flex-shrink-0">Run</span>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="font-bold">{s.name}</span>
              <span className="text-xs text-[var(--muted)] whitespace-nowrap">{s.time}</span>
            </div>
            <p className="text-sm text-[var(--muted)] mb-2">{s.note}</p>
            <div className="flex flex-wrap gap-1">
              {(s.tags || []).map((t) => (
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
