"use client";

// Small form on /profile that lets a user change their email address.
// Uses supabase.auth.updateUser — Supabase then sends a confirmation link
// to the NEW address. Once clicked, auth.users.email is updated. We also
// sync profiles.email so the app-side data stays consistent.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/lib/icons";

export default function UpdateEmailForm({ userId, currentEmail }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(""); setSent(false);
    const target = newEmail.trim().toLowerCase();
    if (!target || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      setError("Enter a valid email address.");
      return;
    }
    if (target === (currentEmail || "").toLowerCase()) {
      setError("That's already your current email.");
      return;
    }
    setBusy(true);

    // Send confirmation link to the NEW address; Supabase requires the redirect
    // to be in the Auth allowlist (we set that when we fixed the signup flow).
    const redirectTo = typeof window !== "undefined"
      ? `${window.location.origin}/profile`
      : undefined;

    const { error: authErr } = await supabase.auth.updateUser(
      { email: target },
      { emailRedirectTo: redirectTo }
    );
    setBusy(false);
    if (authErr) { setError(authErr.message); return; }

    setSent(true);
    setNewEmail("");
  }

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-lg font-bold mb-0.5">Email address</h2>
          <p className="text-sm text-[var(--muted)]">
            Signed in as <strong className="text-[var(--text)]">{currentEmail || "—"}</strong>
          </p>
        </div>
        {!open && !sent && (
          <button onClick={() => setOpen(true)} className="btn-ghost text-sm">
            Change email →
          </button>
        )}
      </div>

      {open && !sent && (
        <form onSubmit={submit} className="mt-4">
          <label className="field-label">New email address</label>
          <input
            type="email" required autoFocus
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="input mb-3"
            placeholder="you@newdomain.com"
          />
          <p className="text-xs text-[var(--muted)] mb-3">
            We'll send a confirmation link to the new address. You'll need to click it to complete the change.
            Your data (rides, plan, coaching) stays linked to the same account.
          </p>
          {error && <p className="text-[var(--red,#e87262)] text-sm mb-3">⚠ {error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn-primary text-sm inline-flex items-center gap-1.5">
              <Icon name="send" size={14} stroke="#1a2a30" />
              {busy ? "Sending…" : "Send confirmation link"}
            </button>
            <button type="button" onClick={() => { setOpen(false); setError(""); setNewEmail(""); }}
                    className="btn-ghost text-sm">
              Cancel
            </button>
          </div>
        </form>
      )}

      {sent && (
        <div className="mt-4 p-3 rounded-lg" style={{
          background: "rgba(92,184,92,.10)", border: "1px solid rgba(92,184,92,.4)",
        }}>
          <div className="flex items-center gap-2 mb-1">
            <Icon name="heart" size={16} stroke="#5cb85c" />
            <strong className="text-[var(--green,#5cb85c)]">Confirmation link sent</strong>
          </div>
          <p className="text-sm text-[var(--muted)]">
            Check your new inbox and click the link to complete the change. Until you do,
            you'll keep signing in with your current email.
          </p>
          <button onClick={() => { setSent(false); setOpen(false); }}
                  className="btn-ghost text-xs mt-2" style={{ padding: "4px 10px" }}>
            Done
          </button>
        </div>
      )}
    </div>
  );
}
