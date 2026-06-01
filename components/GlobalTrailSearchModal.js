"use client";

// Modal that lets the user pick a trail from anywhere in the world (OSM-powered),
// imports it into their trails table, and returns the new trail id to the parent
// so it can be auto-selected on the form.

import { useState, useEffect, useMemo } from "react";
import Icon from "@/lib/icons";

// Same region list as /trails/discover.
const DEFAULT_REGIONS = [
  { id: "squamish",      label: "Squamish, BC",         lat: 49.7016,  lon: -123.1558 },
  { id: "whistler",      label: "Whistler, BC",         lat: 50.1163,  lon: -122.9574 },
  { id: "pemberton",     label: "Pemberton, BC",        lat: 50.3196,  lon: -122.8035 },
  { id: "northvan",      label: "North Vancouver, BC",  lat: 49.3200,  lon: -123.0735 },
  { id: "sea-to-sky",    label: "Sea-to-Sky corridor",  lat: 49.7800,  lon: -123.1500 },
  { id: "moab",          label: "Moab, UT",             lat: 38.5733,  lon: -109.5498 },
  { id: "sedona",        label: "Sedona, AZ",           lat: 34.8697,  lon: -111.7610 },
  { id: "fruita",        label: "Fruita, CO",           lat: 39.1589,  lon: -108.7287 },
  { id: "bentonville",   label: "Bentonville, AR",      lat: 36.3729,  lon:  -94.2088 },
  { id: "asheville",     label: "Asheville, NC",        lat: 35.5951,  lon:  -82.5515 },
  { id: "park-city",     label: "Park City, UT",        lat: 40.6461,  lon: -111.4980 },
  { id: "crested-butte", label: "Crested Butte, CO",    lat: 38.8697,  lon: -106.9878 },
  { id: "rotorua",       label: "Rotorua, NZ",          lat: -38.1368, lon:  176.2497 },
  { id: "queenstown",    label: "Queenstown, NZ",       lat: -45.0312, lon:  168.6626 },
  { id: "finale",        label: "Finale Ligure, IT",    lat:  44.1700, lon:    8.3300 },
  { id: "morzine",       label: "Morzine, FR",          lat:  46.1797, lon:    6.7099 },
  { id: "innsbruck",     label: "Innsbruck, AT",        lat:  47.2692, lon:   11.4041 },
  { id: "derby",         label: "Derby, TAS",           lat: -41.1361, lon:  147.8014 },
];

export default function GlobalTrailSearchModal({ open, onClose, onImported }) {
  const [regionId, setRegionId] = useState(DEFAULT_REGIONS[0].id);
  const [radius, setRadius] = useState(25);
  const [trails, setTrails] = useState([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [importingId, setImportingId] = useState(null);

  useEffect(() => {
    if (open && regionId) load(regionId, radius);
    /* eslint-disable-next-line */
  }, [open, regionId, radius]);

  async function load(rid, rad) {
    setBusy(true); setError(""); setTrails([]);
    try {
      const res = await fetch(`/api/trails/discover?region=${encodeURIComponent(rid)}&radiusKm=${rad}`);
      const data = await res.json();
      if (!res.ok) setError(data.error || "Fetch failed");
      else setTrails(data.trails || []);
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return trails.filter((t) => !q || t.name.toLowerCase().includes(q));
  }, [trails, query]);

  async function importAndPick(trail) {
    setImportingId(trail.id); setError("");
    const regionLabel = DEFAULT_REGIONS.find(r => r.id === regionId)?.label;
    try {
      const res = await fetch("/api/trails/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trail, regionLabel }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error || "Import failed");
      else {
        // Tell parent to add this trail to the ride.
        onImported?.({ name: trail.name });
        onClose();
      }
    } catch (e) { setError(e.message); }
    setImportingId(null);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card max-w-2xl w-full max-h-[85vh] flex flex-col" style={{ background: "var(--panel)" }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold flex items-center gap-2"><Icon name="globe" size={18} /> Search worldwide trails</h2>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-[var(--text)] text-2xl leading-none">×</button>
        </div>
        <p className="text-sm text-[var(--muted)] mb-4">
          Pick a region, find what you rode, click Add. It'll be imported and linked to this ride.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <div>
            <label className="field-label">Region</label>
            <select value={regionId} onChange={(e) => setRegionId(e.target.value)} className="input">
              {DEFAULT_REGIONS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Radius</label>
            <select value={radius} onChange={(e) => setRadius(+e.target.value)} className="input">
              {[10, 25, 50, 100].map((r) => <option key={r} value={r}>{r} km</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Search</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a trail name…"
              className="input"
            />
          </div>
        </div>

        {error && <p className="text-[var(--red)] text-sm mb-3">⚠ {error}</p>}

        <div className="flex-1 overflow-y-auto pr-1">
          {busy ? (
            <p className="text-sm text-[var(--muted)] py-6 text-center">Loading trails… (Overpass takes 10–30 sec for large regions.)</p>
          ) : trails.length === 0 ? (
            <p className="text-sm text-[var(--muted)] py-6 text-center">No named trails returned for this region.</p>
          ) : (
            <>
              <div className="text-xs text-[var(--muted)] mb-2">
                {filtered.length} of {trails.length} match
              </div>
              <div className="space-y-2">
                {filtered.map((t) => (
                  <div key={t.id} className="flex items-start gap-3 p-3 rounded-lg"
                       style={{ background: "var(--panel2)", border: "1px solid var(--line)" }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-bold">{t.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded border border-[var(--line)] text-[var(--muted)]">{t.difficulty}</span>
                      </div>
                      <div className="text-xs text-[var(--muted)]">
                        {t.length_km != null ? `${t.length_km} km` : "length unknown"}
                        {t.surface ? ` · ${t.surface}` : ""}
                      </div>
                    </div>
                    <button
                      onClick={() => importAndPick(t)}
                      disabled={importingId === t.id}
                      className="btn-primary text-xs"
                      style={{ padding: "6px 12px" }}
                    >
                      {importingId === t.id ? "Adding…" : "+ Add to ride"}
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
