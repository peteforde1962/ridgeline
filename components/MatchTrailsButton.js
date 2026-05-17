"use client";

// Backfill trail matching for rides that don't yet have a trail linked.

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function MatchTrailsButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function run() {
    setBusy(true); setError(""); setResult(null);
    try {
      const res = await fetch("/api/rides/match-trails", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Match failed"); }
      else { setResult(data); router.refresh(); }
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={run} disabled={busy} className="btn-ghost text-sm">
        {busy ? "Matching…" : "🔗 Auto-link rides to trails"}
      </button>
      {result && (
        <span className="text-sm text-[var(--green)]">
          ✓ Linked {result.matched} of {result.scanned} unmatched rides.
          {result.note && ` ${result.note}`}
        </span>
      )}
      {error && <span className="text-sm text-[var(--red)]">⚠ {error}</span>}
    </div>
  );
}
