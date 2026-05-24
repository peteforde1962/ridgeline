"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function EmailPrefs({ userId, profile }) {
  const router = useRouter();
  const supabase = createClient();
  const [enabled, setEnabled] = useState(profile?.daily_email_enabled ?? true);
  const [hour, setHour]       = useState(profile?.daily_email_hour ?? 6);
  const [busy, setBusy]       = useState(false);
  const [saved, setSaved]     = useState(false);

  async function save(next) {
    setBusy(true); setSaved(false);
    const payload = { ...next };
    const { error } = await supabase.from("profiles").update(payload).eq("id", userId);
    setBusy(false);
    if (error) { alert("Save failed: " + error.message); return; }
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 1500);
  }

  async function toggle(e) {
    setEnabled(e.target.checked);
    await save({ daily_email_enabled: e.target.checked });
  }
  async function changeHour(e) {
    const h = +e.target.value;
    setHour(h);
    await save({ daily_email_hour: h });
  }

  return (
    <div className="card">
      <h2 className="text-lg font-bold mb-2">Daily briefing email</h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        A short email each morning with today's prescribed workout, recovery status, and a link.
        Sent once per day around 6am Pacific time.
      </p>
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={enabled} onChange={toggle} disabled={busy} className="w-4 h-4" />
        <span>Send me a daily briefing</span>
        {saved && <span className="text-xs text-[var(--green)] ml-2">✓ Saved</span>}
      </label>
    </div>
  );
}
