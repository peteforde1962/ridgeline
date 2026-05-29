"use client";

// Timestamped comments thread on a video.
// Clicking a comment seeks the video to that timestamp (via window event).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export default function VideoComments({ videoId, currentUserId, currentTimeRef }) {
  const supabase = createClient();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [body, setBody] = useState("");
  const [stamp, setStamp] = useState(true);
  const [busy, setBusy] = useState(false);
  const [authors, setAuthors] = useState({});

  async function load() {
    const { data } = await supabase
      .from("video_comments")
      .select("id, author_id, timestamp_ms, body, created_at")
      .eq("video_id", videoId)
      .order("timestamp_ms", { ascending: true });
    setItems(data || []);

    const ids = Array.from(new Set((data || []).map((c) => c.author_id)));
    if (ids.length > 0) {
      const { data: a } = await supabase.from("profiles")
        .select("id, name, email, role").in("id", ids);
      const map = {};
      (a || []).forEach((p) => { map[p.id] = p; });
      setAuthors(map);
    }
  }
  useEffect(() => { load(); }, [videoId]);

  async function submit(e) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    const ts = stamp ? Math.round((currentTimeRef?.current || 0) * 1000) : 0;
    const { error } = await supabase.from("video_comments").insert({
      video_id: videoId,
      author_id: currentUserId,
      timestamp_ms: ts,
      body: body.trim(),
    });
    setBusy(false);
    if (error) { alert(error.message); return; }
    setBody("");
    load();
  }

  async function del(id) {
    if (!confirm("Delete this comment?")) return;
    await supabase.from("video_comments").delete().eq("id", id);
    load();
  }

  function seek(ms) {
    window.dispatchEvent(new CustomEvent("ridgeline:seek-video", { detail: { ms } }));
  }

  return (
    <div className="card">
      <h3 className="font-bold mb-3">Comments</h3>

      <form onSubmit={submit} className="mb-4">
        <textarea
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="e.g., 'Drop your heels more here — front wheel is overweighted'"
          className="input mb-2"
        />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
            <input type="checkbox" checked={stamp} onChange={(e) => setStamp(e.target.checked)} />
            Pin to current frame ({fmtTime((currentTimeRef?.current || 0) * 1000)})
          </label>
          <button type="submit" disabled={busy || !body.trim()} className="btn-primary text-xs"
                  style={{ padding: "6px 14px" }}>
            {busy ? "Posting…" : "Post"}
          </button>
        </div>
      </form>

      {items.length === 0 ? (
        <p className="text-xs text-[var(--muted)]">No comments yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((c) => {
            const a = authors[c.author_id] || {};
            const isCoach = a.role === "coach";
            const who = a.name || (a.email || "").split("@")[0] || "User";
            return (
              <li key={c.id} className="border-l-2 pl-3 py-1"
                  style={{ borderColor: isCoach ? "var(--accent)" : "var(--line)" }}>
                <div className="flex items-baseline justify-between gap-2">
                  <div className="text-xs">
                    <strong>{who}</strong>
                    {isCoach && <span className="ml-1 text-[var(--accent)]">· coach</span>}
                    {c.timestamp_ms > 0 && (
                      <button onClick={() => seek(c.timestamp_ms)}
                              className="ml-2 text-[var(--accent2,#f4b860)] font-semibold">
                        @ {fmtTime(c.timestamp_ms)}
                      </button>
                    )}
                  </div>
                  {c.author_id === currentUserId && (
                    <button onClick={() => del(c.id)} className="text-xs text-[var(--muted)]">×</button>
                  )}
                </div>
                <div className="text-sm mt-0.5 whitespace-pre-wrap">{c.body}</div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
