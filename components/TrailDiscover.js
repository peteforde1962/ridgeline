"use client";

// Trail discovery powered by OpenStreetMap (Overpass API). Free, global, no auth.

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

export default function TrailDiscover({ regions }) {
  const router = useRouter();

  const [regionId, setRegionId] = useState(regions[0]?.id || "");
  const [regionLabel, setRegionLabel] = useState("");
  const [radius, setRadius] = useState(25);
  const [trails, setTrails] = useState([]);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [importingId, setImportingId] = useState(null);
  const [importedIds, setImportedIds] = useState(new Set());
  const [diffFilter, setDiffFilter] = useState("all");
  const [error, setError] = useState("");

  useEffect(() => { if (regionId) load(regionId, radius); /* eslint-disable-next-line */ }, [regionId, radius]);

  async function load(rid, rad) {
    setBusy(true); setError(""); setTrails([]);
    try {
      const res = await fetch(`/api/trails/discover?region=${encodeURIComponent(rid)}&radiusKm=${rad}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Fetch failed"); }
      else { setTrails(data.trails || []); setRegionLabel(data.regionLabel || ""); }
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trails.filter((t) => {
      const nameMatch = !q || (t.name || "").toLowerCase().includes(q) || (t.description || "").toLowerCase().includes(q);
      const diffMatch = diffFilter === "all" || t.difficulty === diffFilter;
      return nameMatch && diffMatch;
    });
  }, [trails, query, diffFilter]);

  async function importTrail(trail) {
    setImportingId(trail.id); setError("");
    try {
      const res = await fetch("/api/trails/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trail, regionLabel }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Import failed"); }
      else {
        setImportedIds((s) => new Set(s).add(trail.id));
        router.refresh();
      }
    } catch (e) { setError(e.message); }
    setImportingId(null);
  }

  return (
    <div className="card">
      <h2 className="text-lg font-bold mb-1">Discover trails</h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        Worldwide MTB trail data from OpenStreetMap — the same underlying source that Trailforks and most trail apps started from. Pick a region, filter, import what you ride.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div>
          <label className="field-label">Region</label>
          <select value={regionId} onChange={(e) => setRegionId(e.target.value)} className="input">
            {regions.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Radius</label>
          <select value={radius} onChange={(e) => setRadius(+e.target.value)} className="input">
            {[10, 25, 50, 100].map((r) => <option key={r} value={r}>{r} km</option>)}
          </select>
        </div>
        <div>
          <label className="field-label">Difficulty</label>
          <select value={diffFilter} onChange={(e) => setDiffFilter(e.target.value)} className="input">
            <option value="all">All</option>
            {["Green","Blue","Black","Double Black"].map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="mb-4">
        <label className="field-label">Search</label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Start typing a trail name…"
          className="input"
        />
      </div>

      {error && <p className="text-[var(--red)] text-sm mb-3">⚠ {error}</p>}

      {busy ? (
        <p className="text-sm text-[var(--muted)]">Loading trails… (Overpass can take 10–30 sec for large regions.)</p>
      ) : trails.length === 0 ? (
        <p className="text-sm text-[var(--muted)] py-6 text-center">
          No named trails returned. Try a larger radius, or a different region.
        </p>
      ) : (
        <>
          <div className="text-xs text-[var(--muted)] mb-3">
            {filtered.length} of {trails.length} match
          </div>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {filtered.map((t) => {
              const imported = importedIds.has(t.id);
              return (
                <div key={t.id} className="flex items-start gap-3 p-3 rounded-lg" style={{ background: "var(--panel2)", border: "1px solid var(--line)" }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold">{t.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded border border-[var(--line)] text-[var(--muted)]">{t.difficulty}</span>
                      {t.surface && <span className="text-xs text-[var(--muted)]">· {t.surface}</span>}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {t.length_km != null ? `${t.length_km} km` : "length unknown"}
                    </div>
                    {t.description && <p className="text-sm text-[var(--muted)] line-clamp-2 mt-1">{t.description}</p>}
                  </div>
                  <button
                    onClick={() => importTrail(t)}
                    disabled={importingId === t.id || imported}
                    className={imported ? "btn-ghost text-xs" : "btn-primary text-xs"}
                    style={{ padding: "6px 12px" }}
                  >
                    {imported ? "✓ Added" : importingId === t.id ? "Adding…" : "+ Add"}
                  </button>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-sm text-[var(--muted)] py-6 text-center">No matches for your filters.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
