"use client";

// Upload a GPX file for a trail. Replaces geometry + elevation profile with
// authoritative track data (Trailforks, Strava, Garmin Connect export).

import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/lib/icons";

export default function TrailGpxUpload({ trailId, trailName }) {
  const router = useRouter();
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  async function upload(e) {
    e.preventDefault();
    if (!file) return;
    setError(""); setResult(null); setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/trails/${trailId}/upload-gpx`, {
        method: "POST", body: form,
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Upload failed"); setBusy(false); return; }
      setResult(data);
      setFile(null);
      router.refresh();
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  return (
    <details className="card mb-4" style={{ background: "rgba(255,255,255,0.04)", borderColor: "var(--line)" }}>
      <summary className="cursor-pointer text-sm font-bold text-[var(--accent2,#fccabb)] inline-flex items-center gap-2">
        <Icon name="globe" size={14} />
        Upload GPX from Trailforks / Strava for accurate profile
      </summary>
      <form onSubmit={upload} className="mt-3">
        <p className="text-xs text-[var(--muted)] mb-3">
          Trailforks: open the trail → ⋯ menu → "Download GPX". Strava: open the activity → "Export GPX".
          The file gives us the real polyline + per-point altitude, replacing the DEM estimate for {trailName}.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="file" accept=".gpx,application/gpx+xml,application/xml,text/xml"
                 onChange={(e) => setFile(e.target.files?.[0] || null)}
                 className="input flex-1" style={{ minWidth: 200 }} />
          <button type="submit" disabled={busy || !file} className="btn-primary text-sm">
            {busy ? "Uploading…" : "Upload GPX"}
          </button>
        </div>
        {error && <p className="text-[var(--red,#e87262)] text-xs mt-2">⚠ {error}</p>}
        {result && (
          <p className="text-[var(--green,#5cb85c)] text-xs mt-2">
            ✓ Updated: {result.length_km} km · {result.climb} m climb · {result.descent} m descent
            ({result.points} points, {result.has_elevation ? "with altitude" : "no altitude in file"}).
          </p>
        )}
      </form>
    </details>
  );
}
