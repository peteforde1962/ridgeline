"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BackfillPlanButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function run() {
    setBusy(true); setError(""); setResult(null);
    try {
      const res = await fetch("/api/plan/backfill-from-rides", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Backfill failed");
      else { setResult(data); router.refresh(); }
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={run} disabled={busy} className="btn-ghost text-sm">
        {busy ? "Backfilling…" : "⟲ Sync past rides to plan"}
      </button>
      {result && (
        <span className="text-sm text-[var(--green)]">
          ✓ Scanned {result.ridesScanned} ride{result.ridesScanned === 1 ? "" : "s"} · ticked {result.planTicked} · linked {result.linkedExisting ?? 0}.
        </span>
      )}
      {error && <span className="text-sm text-[var(--red)]">⚠ {error}</span>}
    </div>
  );
}
