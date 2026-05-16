"use client";

// Tiny client component: delete a row from a Supabase table, confirm first.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DeleteRow({ table, id, label = "Delete", confirm = "Delete this row?" }) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);

  async function handleDelete() {
    if (!window.confirm(confirm)) return;
    setBusy(true);
    const { error } = await supabase.from(table).delete().eq("id", id);
    setBusy(false);
    if (error) { alert("Delete failed: " + error.message); return; }
    router.refresh();
  }

  return (
    <button onClick={handleDelete} disabled={busy} className="btn-ghost text-xs" style={{ padding: "4px 8px" }}>
      {busy ? "…" : label}
    </button>
  );
}
