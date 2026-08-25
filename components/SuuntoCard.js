"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/lib/icons";

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
        Import every workout from your Suunto watch — rides, runs, hikes, swims, strength, yoga, ski. All activity types come through tagged with the correct sport.
      </p>

      {suunto === "connected" && <p className="text-[var(--green)] text-sm mb-3">✓ Suunto connected.</p>}
      {suunto === "denied" && <p className="text-[var(--red)] text-sm mb-3">⚠ Access denied. Reconnect to import.</p>}
      {suunto === "exchange-failed" && <p className="text-[var(--red)] text-sm mb-3">⚠ Token exchange failed. Check Suunto app config.</p>}

      {!connected ? (
        <a href="/api/suunto/connect" className="btn-primary inline-flex items-center gap-2">
          <Icon name="bolt" size={14} stroke="#1a2a30" /> Connect Suunto
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
            <>
              <p className="text-sm text-[var(--green)] mt-3">
                ✓ Imported {result.inserted} workout{result.inserted === 1 ? "" : "s"}
                {result.ticked > 0 && ` · ticked ${result.ticked} plan session${result.ticked === 1 ? "" : "s"}`}.
              </p>
              {result.inserted === 0 && result.fetchInfo && (
                <div className="text-xs text-[var(--muted)] mt-2 p-3 rounded-lg"
                     style={{ background: "rgba(255,255,255,.04)", border: "1px solid var(--line)" }}>
                  <strong className="text-[var(--text)] block mb-1">Nothing imported — diagnostic:</strong>
                  Suunto returned <strong>{result.fetchInfo.workouts_returned}</strong> workout(s) from the API.
                  {result.fetchInfo.workouts_returned === 0 && (
                    <> Either your Suunto account has no recent workouts, or the API key
                    doesn't have access to workout data. Try recording a workout on your watch and syncing again.</>
                  )}
                  {result.fetchInfo.workouts_returned > 0 && result.skipped > 0 && (
                    <> {result.skipped} were skipped (unsupported activity type or under 1 min).</>
                  )}
                  {result.fetchInfo.workouts_returned > 0 && result.skipped === 0 && (
                    <> None were skipped by filters — all failed at the database insert step.
                    See the errors below for the actual reason.</>
                  )}

                  {/* Surface the first few debug entries so the actual error is visible. */}
                  {Array.isArray(result.debug) && result.debug.length > 0 && (
                    <details className="mt-2" open>
                      <summary className="cursor-pointer text-[var(--text)] font-semibold">
                        Per-workout errors ({result.debug.length})
                      </summary>
                      <ul className="mt-1 space-y-1">
                        {result.debug.slice(0, 5).map((d, i) => (
                          <li key={i} className="text-[11px] pl-2"
                              style={{ borderLeft: "2px solid var(--accent)" }}>
                            <strong>{d.workout}</strong>
                            {d.error && <> · <span style={{ color: "var(--red,#e87262)" }}>{d.error}</span></>}
                            {d.skipped && <> · skipped: {d.skipped}</>}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  <details className="mt-2">
                    <summary className="cursor-pointer text-[var(--muted)]">Full technical details</summary>
                    <pre className="mt-1 text-[10px] whitespace-pre-wrap break-all">{JSON.stringify(result.fetchInfo, null, 2)}</pre>
                  </details>
                </div>
              )}
            </>
          )}
          {error && <p className="text-sm text-[var(--red)] mt-3">⚠ {error}</p>}
        </div>
      )}
    </div>
  );
}
