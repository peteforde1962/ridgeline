"use client";

// Add a video — paste a YouTube/Vimeo link or upload a file.
// Files go into the `videos` Supabase storage bucket, stored at {user_id}/{filename}.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Convert a YouTube/Vimeo URL to an embed URL. Returns null if unrecognized.
function normalizeEmbedUrl(raw) {
  if (!raw) return null;
  const url = raw.trim();
  // YouTube
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  // Vimeo
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

const TYPES = ["Ride POV", "Form check", "Tutorial", "Race", "Other"];

export default function VideoForm({ userId }) {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState("link");          // 'link' | 'upload'
  const [name, setName] = useState("");
  const [type, setType] = useState("Tutorial");
  const [url, setUrl] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  async function handleLinkSave(e) {
    e.preventDefault();
    setError(""); setBusy(true);

    const embed = normalizeEmbedUrl(url);
    if (!embed) {
      setBusy(false);
      setError("Couldn't parse that URL. Paste a YouTube or Vimeo link.");
      return;
    }

    const { error } = await supabase.from("videos").insert({
      user_id: userId,
      name: name || "Untitled video",
      kind: "youtube", // stored as embed URL
      url: embed,
      type,
    });

    setBusy(false);
    if (error) { setError(error.message); return; }
    setName(""); setUrl(""); setType("Tutorial");
    router.refresh();
  }

  async function handleUploadSave(e) {
    e.preventDefault();
    setError(""); setBusy(true); setProgress(0);

    if (!file) { setBusy(false); setError("Pick a file first."); return; }

    // 200 MB soft cap so storage stays sane.
    if (file.size > 200 * 1024 * 1024) {
      setBusy(false);
      setError("File is over 200 MB. For long rides, upload to YouTube as Unlisted and paste the link instead.");
      return;
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${userId}/${Date.now()}-${safeName}`;

    const { error: uploadErr } = await supabase.storage
      .from("videos")
      .upload(path, file, {
        contentType: file.type || "video/mp4",
        upsert: false,
      });

    if (uploadErr) {
      setBusy(false);
      setError("Upload failed: " + uploadErr.message);
      return;
    }

    const { error: insertErr } = await supabase.from("videos").insert({
      user_id: userId,
      name: name || file.name,
      kind: "upload",
      url: path,           // storage path; signed URL generated on view
      type,
    });

    setBusy(false);
    if (insertErr) { setError(insertErr.message); return; }
    setName(""); setFile(null); setType("Tutorial");
    setProgress(0);
    router.refresh();
  }

  return (
    <div className="card">
      <h2 className="text-lg font-bold mb-3">Add a video</h2>

      {/* mode tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setMode("link")}
          className={mode === "link" ? "btn-primary text-sm" : "btn-ghost text-sm"}
          style={{ padding: "8px 14px" }}
        >
          🔗 Paste link
        </button>
        <button
          onClick={() => setMode("upload")}
          className={mode === "upload" ? "btn-primary text-sm" : "btn-ghost text-sm"}
          style={{ padding: "8px 14px" }}
        >
          📁 Upload file
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="field-label">Name (optional)</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="Cornering drill on Loose Larry" />
        </div>
        <div>
          <label className="field-label">Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="input">
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {mode === "link" ? (
        <form onSubmit={handleLinkSave}>
          <label className="field-label">YouTube or Vimeo URL</label>
          <input
            type="url" value={url} onChange={(e) => setUrl(e.target.value)} required
            className="input mb-3" placeholder="https://www.youtube.com/watch?v=..."
          />
          {error && <p className="text-[var(--red)] text-sm mb-3">⚠ {error}</p>}
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? "Adding…" : "Add video"}
          </button>
          <p className="text-xs text-[var(--muted)] mt-3">
            Tip: for long rides, upload to YouTube as <strong>Unlisted</strong> and paste the link here. Free, no storage limits.
          </p>
        </form>
      ) : (
        <form onSubmit={handleUploadSave}>
          <label className="field-label">Video file (200 MB max)</label>
          <input
            type="file" accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="input mb-3"
          />
          {file && (
            <p className="text-xs text-[var(--muted)] mb-3">
              Selected: <strong>{file.name}</strong> ({(file.size / 1024 / 1024).toFixed(1)} MB)
            </p>
          )}
          {busy && (
            <div className="text-sm text-[var(--muted)] mb-3">Uploading… this can take a minute on slow Wi-Fi.</div>
          )}
          {error && <p className="text-[var(--red)] text-sm mb-3">⚠ {error}</p>}
          <button type="submit" disabled={busy || !file} className="btn-primary">
            {busy ? "Uploading…" : "Upload"}
          </button>
        </form>
      )}
    </div>
  );
}
