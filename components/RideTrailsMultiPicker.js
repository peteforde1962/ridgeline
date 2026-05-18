"use client";

// Chip-based multi-trail picker for a single ride.
// Shows the currently linked trails as chips; click a chip to remove it,
// or click "+ Add" to toggle others on. Persists to the `ride_trails` join table.

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RideTrailsMultiPicker({ rideId, linkedTrailIds = [], trails }) {
  const router = useRouter();
  const supabase = createClient();
  const [linked, setLinked] = useState(new Set(linkedTrailIds));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");

  const trailById = useMemo(() => {
    const m = {};
    trails.forEach((t) => { m[t.id] = t; });
    return m;
  }, [trails]);

  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trails.filter((t) => !q || t.name.toLowerCase().includes(q));
  }, [trails, query]);

  async function toggle(trailId) {
    setBusy(true);
    const isLinked = linked.has(trailId);
    const next = new Set(linked);

    if (isLinked) {
      next.delete(trailId);
      const { error } = await supabase
        .from("ride_trails").delete()
        .eq("ride_id", rideId).eq("trail_id", trailId);
      if (error) { alert("Unlink failed: " + error.message); setBusy(false); return; }
    } else {
      next.add(trailId);
      const { error } = await supabase
        .from("ride_trails").insert({ ride_id: rideId, trail_id: trailId });
      if (error) { alert("Link failed: " + error.message); setBusy(false); return; }
    }
    setLinked(next);
    setBusy(false);
    router.refresh();
  }

  const chips = Array.from(linked).map((id) => trailById[id]).filter(Boolean);

  return (
    <div className="relative inline-block">
      <div className="flex items-center gap-1 flex-wrap">
        {chips.length === 0 ? (
          <span className="text-xs text-[var(--muted)]">—</span>
        ) : chips.map((t) => (
          <button
            key={t.id}
            onClick={() => toggle(t.id)}
            disabled={busy}
            className="text-xs px-2 py-0.5 rounded border border-[var(--accent)] bg-[#f8df70]/15 text-[var(--text)] hover:bg-[#f8df70]/30"
            title="Click to remove"
          >
            {t.name} ✕
          </button>
        ))}
        <button
          onClick={() => setOpen(!open)}
          disabled={busy}
          className="text-xs px-2 py-0.5 rounded border border-[var(--line)] text-[var(--muted)] hover:text-[var(--text)] hover:border-[var(--accent)]"
        >
          {open ? "Close" : "+ Add"}
        </button>
      </div>

      {open && (
        <div className="absolute z-30 mt-1 left-0 w-64 max-h-72 overflow-y-auto rounded-lg shadow-xl"
             style={{ background: "var(--panel)", border: "1px solid var(--line)" }}>
          <div className="p-2 sticky top-0" style={{ background: "var(--panel)", borderBottom: "1px solid var(--line)" }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter trails…"
              className="input text-xs"
              autoFocus
            />
          </div>
          {available.length === 0 ? (
            <p className="text-xs text-[var(--muted)] p-3">No matches.</p>
          ) : (
            <ul className="py-1">
              {available.map((t) => {
                const isLinked = linked.has(t.id);
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => toggle(t.id)}
                      disabled={busy}
                      className="w-full text-left text-xs px-3 py-2 hover:bg-[var(--panel2)] flex items-center justify-between"
                    >
                      <span>{t.name}</span>
                      <span style={{ color: isLinked ? "#6a8a6d" : "var(--muted)" }}>
                        {isLinked ? "✓" : "+"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
