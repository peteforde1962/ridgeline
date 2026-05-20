"use client";

// Per-day general notes (debounced auto-save).

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DayNotesEditor({ userId, weekIndex, dayIndex, initialNote }) {
  const router = useRouter();
  const supabase = createClient();
  const [note, setNote] = useState(initialNote || "");
  const [saved, setSaved] = useState(true);
  const [busy, setBusy] = useState(false);

  // Auto-save 800ms after typing stops.
  useEffect(() => {
    if (note === initialNote) return;
    setSaved(false);
    const t = setTimeout(async () => {
      setBusy(true);
      if (note.trim()) {
        await supabase.from("plan_day_notes").upsert({
          user_id: userId, week_index: weekIndex, day_index: dayIndex,
          note: note.trim(), updated_at: new Date().toISOString(),
        }, { onConflict: "user_id,week_index,day_index" });
      } else {
        await supabase.from("plan_day_notes").delete()
          .eq("user_id", userId)
          .eq("week_index", weekIndex)
          .eq("day_index", dayIndex);
      }
      setBusy(false); setSaved(true);
      router.refresh();
    }, 800);
    return () => clearTimeout(t);
    /* eslint-disable-next-line */
  }, [note]);

  return (
    <div className="card mb-4">
      <div className="flex items-center justify-between mb-2">
        <label className="field-label" style={{ margin: 0 }}>Day notes</label>
        <span className="text-xs text-[var(--muted)]">
          {busy ? "Saving…" : saved ? "✓ Saved" : "Unsaved"}
        </span>
      </div>
      <textarea
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="How did today go? Anything to remember for next time…"
        className="input"
      />
    </div>
  );
}
