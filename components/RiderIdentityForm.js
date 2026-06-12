"use client";

// Rider identity: just name + skill level. Distinct from the training-plan
// setup, which lives in its own card.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function RiderIdentityForm({ userId, profile }) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName]   = useState(profile?.name ?? "");
  const [level, setLevel] = useState(profile?.level ?? "Intermediate");
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState("");
  const [success, setSuccess] = useState("");

  async function save(e) {
    e.preventDefault();
    setSaving(true); setError(""); setSuccess("");
    const { error } = await supabase.from("profiles").update({
      name,
      level,
      updated_at: new Date().toISOString(),
    }).eq("id", userId);
    setSaving(false);
    if (error) { setError(error.message); return; }
    setSuccess("Saved.");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="card">
      <h2 className="text-lg font-bold mb-1">Rider profile</h2>
      <p className="text-sm text-[var(--muted)] mb-5">
        Who you are. The training-plan settings live in their own section below.
      </p>

      <div className="mb-4">
        <label className="field-label">Your name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
               className="input" placeholder="Pete" />
      </div>

      <div className="mb-5">
        <label className="field-label">Skill level</label>
        <select value={level} onChange={(e) => setLevel(e.target.value)} className="input">
          {["Beginner","Intermediate","Advanced","Expert"].map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-[var(--red)] text-sm mb-3">⚠ {error}</p>}
      {success && <p className="text-[var(--green)] text-sm mb-3">✓ {success}</p>}

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
