"use client";

// Garmin Connect integration card. Mirrors Strava + Suunto.
// Requires Garmin Developer Program access (apply at developerportal.garmin.com)
// to obtain GARMIN_CLIENT_ID + GARMIN_CLIENT_SECRET.

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/lib/icons";

export default function GarminCard({ connected, userId, lastSyncAt, garmin }) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function sync() {
    setSyncing(true); setError(""); setResult(null);
    try {
      const res = await fetch("/api/garmin/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Sync failed");
      else { setResult(data); router.refresh(); }
    } catch (e) { setError(e.message); }
    setSyncing(false);
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Garmin? Imported workouts stay; new ones won't auto-sync.")) return;
    const res = await fetch("/api/garmin/disconnect", { method: "POST" });
    if (!res.ok) { alert("Disconnect failed."); return; }
    router.refresh();
  }

  return (
    <div className="card">
      <h2 className="text-lg font-bold mb-1">Garmin Connect</h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        Import every workout from your Garmin — rides, runs, hikes, swims, strength, yoga, ski. All activity types come through tagged with the correct sport.
      </p>

      {garmin === "connected" && <p className="text-[var(--green)] text-sm mb-3">✓ Garmin connected.</p>}
      {garmin === "denied" && <p className="text-[var(--red)] text-sm mb-3">⚠ Access denied. Reconnect to import.</p>}
      {garmin === "exchange-failed" && <p className="text-[var(--red)] text-sm mb-3">⚠ Token exchange failed. Check Garmin app config.</p>}

      {!connected ? (
        <a href="/api/garmin/connect" className="btn-primary inline-flex items-center gap-2">
          <Icon name="bolt" size={14} stroke="#1a2a30" /> Connect Garmin
        </a>
      ) : (
        <div>
          <div className="text-sm text-[var(--muted)] mb-3">
            User ID: <span className="text-[var(--text)]">{userId || "—"}</span>
            {lastSyncAt && <> · Last sync: <span className="text-[var(--text)]">{new Date(lastSyncAt).toLocaleString()}</span></>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={sync} disabled={syncing} className="btn-primary inline-flex items-center gap-2">
              <Icon name="refresh" size={14} stroke="#1a2a30" />
              {syncing ? "Syncing…" : "Sync"}
            </button>
            <button onClick={disconnect} className="btn-ghost">Disconnect</button>
          </div>
          {result && (
            <p className="text-sm text-[var(--green)] mt-3">
              ✓ Imported {result.inserted} activit{result.inserted === 1 ? "y" : "ies"}.
            </p>
          )}
          {error && <p className="text-sm text-[var(--red)] mt-3">⚠ {error}</p>}
        </div>
      )}
    </div>
  );
}
