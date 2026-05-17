"use client";

import { useState } from "react";
import SearchableList from "@/components/SearchableList";

export default function YogaClient({ poses }) {
  const [filter, setFilter] = useState("all"); // 'all' | 'warmup' | 'recovery'

  const filtered = filter === "all"
    ? poses
    : poses.filter((p) => filter === "warmup" ? p.type === "Warm-up" : p.type === "Recovery");

  return (
    <>
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { k: "all",      label: "All poses" },
          { k: "warmup",   label: "Pre-ride (Warm-up)" },
          { k: "recovery", label: "Post-ride (Recovery)" },
        ].map((opt) => (
          <button
            key={opt.k}
            onClick={() => setFilter(opt.k)}
            className={filter === opt.k ? "btn-primary text-sm" : "btn-ghost text-sm"}
            style={{ padding: "8px 14px" }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <SearchableList
        items={filtered}
        placeholder="Search poses (e.g. hip, spine, chest, restorative)…"
        getSearchText={(p) => `${p.name} ${p.type} ${(p.tags || []).join(" ")} ${p.why}`}
        groupBy={(p) => p.type}
        renderItem={(p) => (
          <div key={p.id} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "var(--panel2)", border: "1px solid var(--line)" }}>
            <div className="flex-1">
              <div className="flex items-center justify-between gap-3 mb-1">
                <span className="font-bold">{p.name}</span>
                <span className="text-xs text-[var(--muted)] whitespace-nowrap">{p.reps}</span>
              </div>
              <p className="text-sm text-[var(--muted)] mb-2">{p.why}</p>
              <div className="flex flex-wrap gap-1">
                {(p.tags || []).map((t) => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-full border border-[var(--line)] text-[var(--muted)]">
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
      />
    </>
  );
}
