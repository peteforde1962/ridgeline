"use client";

// One row in the admin's coach-approval queue.

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CoachApprovalRow({ profile }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function decide(approve) {
    if (!approve && !confirm(`Reject ${profile.email}'s coach request?`)) return;
    setBusy(true);
    const res = await fetch("/api/admin/approve-coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: profile.id, approve }),
    });
    setBusy(false);
    if (!res.ok) { alert("Failed: " + (await res.text())); return; }
    router.refresh();
  }

  return (
    <tr className="border-t border-[var(--line)]">
      <td className="p-2">
        <span className="font-semibold">{profile.name || "—"}</span>
        <span className="text-[var(--muted)] ml-2">· {profile.email}</span>
      </td>
      <td className="p-2 text-[var(--muted)] text-xs">
        {profile.coach_requested_at
          ? new Date(profile.coach_requested_at).toLocaleString()
          : "—"}
      </td>
      <td className="p-2">
        <div className="flex gap-2 justify-end">
          <button onClick={() => decide(true)} disabled={busy}
                  className="btn-primary text-xs" style={{ padding: "4px 12px" }}>
            Approve
          </button>
          <button onClick={() => decide(false)} disabled={busy}
                  className="btn-ghost text-xs" style={{ padding: "4px 12px" }}>
            Reject
          </button>
        </div>
      </td>
    </tr>
  );
}
