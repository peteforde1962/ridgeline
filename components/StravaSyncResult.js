"use client";

// Inline Strava sync button with full diagnostic output.
// Lives on /trails so you can pull from Strava without leaving the page.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/lib/icons";

export default function StravaSyncResult() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [showDebug, setShowDebug] = useState(false);

  async function sync() {
    setBusy(true); setError(""); setResult(null);
    try {
      const res = await fetch("/api/strava/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Sync failed");
      else { setResult(data); router.refresh(); }
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  return (
    <div className="card mb-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold">Strava sync</h2>
          <p className="text-xs text-[var(--muted)]">Pull all recent activities from Strava + auto-detect trails on cycling activities.</p>
        </div>
        <button onClick={sync} disabled={busy} className="btn-primary text-sm inline-flex items-center gap-2">
          <Icon name="refresh" size={14} stroke="#1a2a30" />
          {busy ? "Syncing…" : "Sync"}
        </button>
      </div>

      {error && <p className="text-[var(--red)] text-sm mt-3">⚠ {error}</p>}

      {result && (
        <div className="mt-3 text-sm">
          <p className="text-[var(--green)] mb-2">
            ✓ Looked at <strong>{result.fetched}</strong> Strava {result.fetched === 1 ? "activity" : "activities"} ·
            imported <strong>{result.inserted}</strong> ·
            auto-linked <strong>{result.matched}</strong> trail{result.matched === 1 ? "" : "s"}.
          </p>
          {result.debug && result.debug.length > 0 && (
            <>
              <button onClick={() => setShowDebug(!showDebug)} className="text-xs text-[var(--muted)] underline">
                {showDebug ? "Hide" : "Show"} per-activity details
              </button>
              {showDebug && (
                <pre className="mt-2 text-[11px] p-3 rounded overflow-x-auto"
                     style={{ background: "var(--bg2)", border: "1px solid var(--line)", maxHeight: 240 }}>
                  {JSON.stringify(result.debug, null, 2)}
                </pre>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
