"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SuuntoCard({ connected, userId, lastSyncAt, suunto }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function sync() {
    setSyncing(true); setError(""); setResult(null);
    try {
      const res = await fetch("/api/suunto/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Sync failed");
      else { setResult(data); router.refresh(); }
    } catch (e) { setError(e.message); }
    setSyncing(false);
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Suunto? Imported workouts stay; new ones won't auto-sync.")) return;
    const res = await fetch("/api/suunto/disconnect", { method: "POST" });
    if (!res.ok) { alert("Disconnect failed."); return; }
    router.refresh();
  }

  return (
    <div className="card">
      <h2 className="text-lg font-bold mb-1">Suunto</h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        Import workouts from your Suunto watch (cycling + MTB activities only).
      </p>

      {suunto === "connected" && <p className="text-[var(--green)] text-sm mb-3">✓ Suunto connected.</p>}
      {suunto === "denied" && <p className="text-[var(--red)] text-sm mb-3">⚠ Access denied. Reconnect to import.</p>}
      {suunto === "exchange-failed" && <p className="text-[var(--red)] text-sm mb-3">⚠ Token exchange failed. Check Suunto app config.</p>}

      {!connected ? (
        <a href="/api/suunto/connect" className="btn-primary">⌚ Connect Suunto</a>
      ) : (
        <div>
          <div className="text-sm text-[var(--muted)] mb-3">
            User ID: <span className="text-[var(--text)]">{userId || "—"}</span>
            {lastSyncAt && <> · Last sync: <span className="text-[var(--text)]">{new Date(lastSyncAt).toLocaleString()}</span></>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={sync} disabled={syncing} className="btn-primary">
              {syncing ? "Syncing…" : "⟳ Sync workouts now"}
            </button>
            <button onClick={disconnect} className="btn-ghost">Disconnect</button>
          </div>
          {result && (
            <p className="text-sm text-[var(--green)] mt-3">
              ✓ Imported {result.inserted} workout{result.inserted === 1 ? "" : "s"}
              {result.ticked > 0 && ` · ticked ${result.ticked} plan session${result.ticked === 1 ? "" : "s"}`}
              {result.skipped > 0 && ` · ${result.skipped} non-cycling skipped`}.
            </p>
          )}
          {error && <p className="text-sm text-[var(--red)] mt-3">⚠ {error}</p>}
        </div>
      )}
    </div>
  );
}
