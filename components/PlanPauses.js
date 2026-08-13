"use client";

// Plan pauses / holidays management. Lives on the Profile page.
// A pause is a date range where daily email is suppressed and (in the future)
// plan sessions render as dimmed. Users can add multiple non-overlapping ranges.

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/lib/icons";

export default function PlanPauses({ userId }) {
  const supabase = createClient();
  const [pauses, setPauses]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [adding, setAdding]     = useState(false);
  const [starts, setStarts]     = useState("");
  const [ends, setEnds]         = useState("");
  const [reason, setReason]     = useState("");
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("plan_pauses")
      .select("id, starts_on, ends_on, reason, created_at")
      .eq("user_id", userId)
      .order("starts_on", { ascending: true });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setPauses(data || []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId]);

  async function addPause(e) {
    e.preventDefault();
    setError("");
    if (!starts || !ends) { setError("Pick a start and end date."); return; }
    if (ends < starts)    { setError("End date must be on or after start."); return; }
    setBusy(true);
    const { error } = await supabase.from("plan_pauses").insert({
      user_id: userId,
      starts_on: starts,
      ends_on: ends,
      reason: reason.trim() || null,
    });
    setBusy(false);
    if (error) { setError(error.message); return; }
    setStarts(""); setEnds(""); setReason("");
    setAdding(false);
    load();
  }

  async function remove(id) {
    if (!window.confirm("Remove this pause?")) return;
    const { error } = await supabase.from("plan_pauses").delete().eq("id", id);
    if (error) { alert("Delete failed: " + error.message); return; }
    load();
  }

  const today = new Date().toISOString().slice(0, 10);

  function fmtRange(p) {
    const opts = { month: "short", day: "numeric", year: "numeric" };
    const s = new Date(p.starts_on + "T00:00:00").toLocaleDateString(undefined, opts);
    const e = new Date(p.ends_on   + "T00:00:00").toLocaleDateString(undefined, opts);
    const days = Math.round((new Date(p.ends_on) - new Date(p.starts_on)) / 86400_000) + 1;
    return `${s} → ${e} · ${days} day${days === 1 ? "" : "s"}`;
  }

  return (
    <div className="card-glass">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-bold mb-0.5">Holidays / pauses</h2>
          <p className="text-xs text-[var(--muted)]">
            No daily emails during these dates. Plan stays intact — this is a "don't remind me" toggle.
          </p>
        </div>
        {!adding && (
          <button onClick={() => setAdding(true)} className="btn-primary text-sm inline-flex items-center gap-1.5">
            <Icon name="plus" size={14} stroke="#1a2a30" /> Add pause
          </button>
        )}
      </div>

      {adding && (
        <form onSubmit={addPause} className="mb-4 p-3 rounded-lg" style={{
          background: "rgba(255,255,255,.04)", border: "1px solid var(--line)",
        }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div>
              <label className="field-label">From</label>
              <input type="date" value={starts} onChange={(e) => setStarts(e.target.value)}
                     min={today} className="input" />
            </div>
            <div>
              <label className="field-label">To</label>
              <input type="date" value={ends} onChange={(e) => setEnds(e.target.value)}
                     min={starts || today} className="input" />
            </div>
            <div>
              <label className="field-label">Reason <span className="text-[var(--muted)] font-normal">(optional)</span></label>
              <input type="text" value={reason} onChange={(e) => setReason(e.target.value)}
                     className="input" placeholder="Ski trip, injury, work travel…" />
            </div>
          </div>
          {error && <p className="text-[var(--red,#e87262)] text-sm mb-2">⚠ {error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn-primary text-sm">
              {busy ? "Saving…" : "Save pause"}
            </button>
            <button type="button" onClick={() => { setAdding(false); setError(""); }}
                    className="btn-ghost text-sm">Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-[var(--muted)]">Loading…</p>
      ) : pauses.length === 0 ? (
        <p className="text-sm text-[var(--muted)] italic">
          No pauses scheduled. Add one before a trip and RidgeLine will stay quiet.
        </p>
      ) : (
        <ul className="space-y-2">
          {pauses.map((p) => {
            const active = today >= p.starts_on && today <= p.ends_on;
            const past   = today > p.ends_on;
            return (
              <li key={p.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg"
                  style={{
                    background: active ? "rgba(248,182,166,.12)" : "rgba(255,255,255,.03)",
                    border: `1px solid ${active ? "rgba(248,182,166,.4)" : "var(--line)"}`,
                    opacity: past ? 0.6 : 1,
                  }}>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">
                    {p.reason || "Pause"}
                    {active && <span className="ml-2 text-[10px] px-2 py-0.5 rounded"
                                     style={{ background: "var(--accent)", color: "#1a2a30", fontWeight: 800 }}>
                      Active now
                    </span>}
                    {past && <span className="ml-2 text-[10px] text-[var(--muted)]">Past</span>}
                  </div>
                  <div className="text-xs text-[var(--muted)]">{fmtRange(p)}</div>
                </div>
                <button onClick={() => remove(p.id)}
                        className="btn-ghost text-xs inline-flex items-center gap-1"
                        style={{ padding: "5px 10px", color: "var(--red,#e87262)" }}>
                  <Icon name="trash" size={12} /> Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
