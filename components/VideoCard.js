"use client";

// One video: player + metadata + notes (editable) + delete.
// For uploaded files, the parent already supplied a signed URL.
// For youtube/vimeo, the stored URL is the embed URL.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function VideoCard({ video, signedSrc }) {
  const router = useRouter();
  const supabase = createClient();

  const [notes, setNotes] = useState(video.notes || "");
  const [type, setType] = useState(video.type || "Tutorial");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  async function saveChanges() {
    setSaving(true);
    const { error } = await supabase
      .from("videos")
      .update({ notes, type })
      .eq("id", video.id);
    setSaving(false);
    if (error) { alert("Save failed: " + error.message); return; }
    setDirty(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${video.name}"?`)) return;
    // Remove storage file too (if any)
    if (video.kind === "upload" && video.url) {
      await supabase.storage.from("videos").remove([video.url]);
    }
    const { error } = await supabase.from("videos").delete().eq("id", video.id);
    if (error) { alert("Delete failed: " + error.message); return; }
    router.refresh();
  }

  return (
    <div className="card">
      <div className="rounded-lg overflow-hidden mb-3" style={{ aspectRatio: "16 / 9", background: "#000" }}>
        {video.kind === "upload" ? (
          <video controls src={signedSrc} style={{ width: "100%", height: "100%" }} />
        ) : (
          <iframe
            src={video.url}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ width: "100%", height: "100%", border: 0 }}
            title={video.name}
          />
        )}
      </div>

      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="font-bold truncate">{video.name}</div>
          <div className="text-xs text-[var(--muted)]">
            {video.date} · {video.kind === "upload" ? "Uploaded" : "Linked"}
          </div>
        </div>
        <select
          value={type}
          onChange={(e) => { setType(e.target.value); setDirty(true); }}
          className="bg-transparent border border-[var(--line)] rounded px-2 py-1 text-xs"
        >
          {["Ride POV", "Form check", "Tutorial", "Race", "Other"].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <textarea
        rows={2}
        value={notes}
        onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
        className="input mb-2"
        placeholder="Notes & timestamps (e.g., '0:42 — front wheel washed in loose corner')"
      />

      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <button onClick={handleDelete} className="btn-ghost text-xs" style={{ padding: "4px 10px" }}>
            Delete
          </button>
          <a href={`/videos/${video.id}`} className="btn-ghost text-xs" style={{ padding: "4px 10px" }}>
            Pose & comments →
          </a>
        </div>
        {dirty && (
          <button onClick={saveChanges} disabled={saving} className="btn-primary text-xs" style={{ padding: "4px 10px" }}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        )}
      </div>
    </div>
  );
}
