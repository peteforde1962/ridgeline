"use client";

// Trail discovery powered by Strava segments. Needs the user to be connected to Strava.

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

export default function TrailDiscover({ regions }) {
  const router = useRouter();

  const [regionId, setRegionId] = useState(regions[0]?.id || "");
  const [regionLabel, setRegionLabel] = useState("");
  const [segments, setSegments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [importingId, setImportingId] = useState(null);
  const [importedIds, setImportedIds] = useState(new Set());
  const [error, setError] = useState("");
  const [needsStrava, setNeedsStrava] = useState(false);

  useEffect(() => { if (regionId) load(regionId); }, [regionId]);

  async function load(rid) {
    setBusy(true); setError(""); setSegments([]); setNeedsStrava(false);
    try {
      const res = await fetch(`/api/trails/discover?region=${encodeURIComponent(rid)}`);
      const data = await res.json();
      if (res.status === 403 && data.error === "strava-not-connected") {
        setNeedsStrava(true);
      } else if (!res.ok) {
        setError(data.error || "Fetch failed");
      } else {
        setSegments(data.segments || []);
        setRegionLabel(data.regionLabel || "");
      }
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return segments;
    return segments.filter((s) => (s.name || "").toLowerCase().includes(q));
  }, [segments, query]);

  async function importSegment(segment) {
    setImportingId(segment.id); setError("");
    try {
      const res = await fetch("/api/trails/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ segment, regionLabel }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Import failed"); }
      else {
        setImportedIds((s) => new Set(s).add(segment.id));
        router.refresh();
      }
    } catch (e) { setError(e.message); }
    setImportingId(null);
  }

  if (needsStrava) {
    return (
      <div className="card">
        <h2 className="text-lg font-bold mb-2">Connect Strava to discover trails</h2>
        <p className="text-sm text-[var(--muted)] mb-4">
          Trail discovery uses Strava's segment database (popular cycling segments worldwide).
          Connect Strava on your Profile page first.
        </p>
        <a href="/profile" className="btn-primary">Go to Profile →</a>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-lg font-bold mb-1">Discover trails</h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        Pick a region, browse popular cycling segments, import the ones you ride. (Top 10 segments per region, via Strava.)
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        <div>
          <label className="field-label">Region</label>
          <select value={regionId} onChange={(e) => setRegionId(e.target.value)} className="input">
            {regions.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Search</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Start typing a segment name…"
            className="input"
          />
        </div>
      </div>

      {error && <p className="text-[var(--red)] text-sm mb-3">⚠ {error}</p>}

      {busy ? (
        <p className="text-sm text-[var(--muted)]">Loading segments…</p>
      ) : segments.length === 0 ? (
        <p className="text-sm text-[var(--muted)] py-6 text-center">
          No segments returned for this region. Strava only surfaces popular ones — try a busier MTB hub.
        </p>
      ) : (
        <>
          <div className="text-xs text-[var(--muted)] mb-3">
            {filtered.length} of {segments.length} match
          </div>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {filtered.map((s) => {
              const imported = importedIds.has(s.id);
              const km    = s.distance != null ? (s.distance / 1000).toFixed(2) : null;
              const climb = s.elev_difference != null ? Math.round(s.elev_difference) : null;
              const grade = s.avg_grade != null ? s.avg_grade.toFixed(1) : null;
              return (
                <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "var(--panel2)", border: "1px solid var(--line)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold">{s.name}</span>
                      {s.climb_category_desc && (
                        <span className="text-xs px-2 py-0.5 rounded border border-[var(--line)] text-[var(--muted)]">
                          Cat {s.climb_category_desc}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {km && `${km} km`}
                      {climb != null && ` · ${climb} m climb`}
                      {grade && ` · ${grade}% avg grade`}
                    </div>
                  </div>
                  <button
                    onClick={() => importSegment(s)}
                    disabled={importingId === s.id || imported}
                    className={imported ? "btn-ghost text-xs" : "btn-primary text-xs"}
                    style={{ padding: "6px 12px" }}
                  >
                    {imported ? "✓ Added" : importingId === s.id ? "Adding…" : "+ Add"}
                  </button>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-sm text-[var(--muted)] py-6 text-center">No matches for your search.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
