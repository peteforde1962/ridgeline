"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SubscribeStravaButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function run() {
    setBusy(true); setError(""); setSuccess("");
    try {
      const res = await fetch("/api/strava/subscribe", { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Subscription failed"); }
      else { setSuccess(`Subscribed. Subscription id: ${data.id}`); router.refresh(); }
    } catch (e) { setError(e.message); }
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={run} disabled={busy} className="btn-primary text-sm">
        {busy ? "Subscribing…" : "🔔 Subscribe to Strava events"}
      </button>
      {success && <span className="text-sm text-[var(--green)]">✓ {success}</span>}
      {error && <span className="text-sm text-[var(--red)]">⚠ {error}</span>}
    </div>
  );
}
