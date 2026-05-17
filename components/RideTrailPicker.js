"use client";

// Tiny inline trail selector for the rides table.
// Lets the user manually link a ride to one of their saved trails.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RideTrailPicker({ rideId, currentTrailId, trails }) {
  const router = useRouter();
  const supabase = createClient();
  const [value, setValue] = useState(currentTrailId || "");
  const [busy, setBusy] = useState(false);

  async function handleChange(e) {
    const next = e.target.value;
    setValue(next);
    setBusy(true);
    const { error } = await supabase
      .from("rides")
      .update({ trail_id: next || null })
      .eq("id", rideId);
    setBusy(false);
    if (error) { alert("Save failed: " + error.message); setValue(currentTrailId || ""); return; }
    router.refresh();
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={busy}
      className="bg-transparent border border-[var(--line)] rounded px-2 py-1 text-xs max-w-[10rem]"
    >
      <option value="">— none —</option>
      {trails.map((t) => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </select>
  );
}
