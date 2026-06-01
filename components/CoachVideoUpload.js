"use client";

// Coach uploads a video directly into a student's account.
// File goes to `videos` bucket at {studentId}/{filename}; videos row is
// inserted with user_id=studentId so the student sees it in their /videos list.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TYPES = ["Form check", "Ride POV", "Tutorial", "Race", "Other"];

export default function CoachVideoUpload({ studentId, studentName }) {
  const router = useRouter();
  const supabase = createClient();
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [type, setType] = useState("Form check");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  async function upload(e) {
    e.preventDefault();
    setError(""); setDone(false);
    if (!file) { setError("Pick a file first."); return; }
    if (file.size > 200 * 1024 * 1024) {
      setError("File over 200 MB. Upload to YouTube as Unlisted instead and let your student add the link.");
      return;
    }
    setBusy(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${studentId}/coach-${Date.now()}-${safeName}`;

    const { error: upErr } = await supabase.storage.from("videos").upload(path, file, {
      contentType: file.type || "video/mp4", upsert: false,
    });
    if (upErr) { setBusy(false); setError("Upload failed: " + upErr.message); return; }

    const { error: insErr } = await supabase.from("videos").insert({
      user_id: studentId,
      name: name || file.name,
      kind: "upload",
      url: path,
      type,
    });
    setBusy(false);
    if (insErr) { setError(insErr.message); return; }

    setDone(true);
    setFile(null); setName(""); setType("Form check");
    router.refresh();
  }

  return (
    <div className="card">
      <h2 className="text-lg font-bold mb-2">Upload a video for {studentName}</h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        Footage you filmed of them (form check, ride POV). Goes straight into their video library, where you can both
        play it with the pose overlay and leave timestamped comments.
      </p>

      <form onSubmit={upload} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="field-label">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
                   className="input" placeholder="Cornering — Tuesday session" />
          </div>
          <div>
            <label className="field-label">Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} className="input">
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="field-label">Video file (200 MB max)</label>
          <input type="file" accept="video/*"
                 onChange={(e) => setFile(e.target.files?.[0] || null)}
                 className="input" />
          {file && (
            <p className="text-xs text-[var(--muted)] mt-1">
              Selected: <strong>{file.name}</strong> ({(file.size / 1024 / 1024).toFixed(1)} MB)
            </p>
          )}
        </div>

        {error && <p className="text-[var(--red,#e87262)] text-sm">⚠ {error}</p>}
        {done && <p className="text-[var(--green,#5cb85c)] text-sm">✓ Uploaded. {studentName} can now see it in their library.</p>}

        <button type="submit" disabled={busy || !file} className="btn-primary">
          {busy ? "Uploading…" : "Upload"}
        </button>
      </form>
    </div>
  );
}
