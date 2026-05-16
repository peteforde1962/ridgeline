// /coach — AI coaching chat. Real LLM if ANTHROPIC_API_KEY set, local fallback otherwise.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CoachChat from "@/components/CoachChat";

export default async function CoachPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <a href="/dashboard" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">← Dashboard</a>
        <div className="flex items-center gap-2">
          <div className="logo-mark">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 19l5-9 3 5 4-7 6 11z" />
            </svg>
          </div>
          <div className="font-extrabold text-sm">RidgeLine</div>
        </div>
      </header>

      <h1 className="text-3xl font-extrabold mb-1">Coach AI</h1>
      <p className="text-[var(--muted)] mb-6">
        Ask anything. Coach has your profile, recent check-ins, and recent rides as context.
      </p>

      <CoachChat />
    </main>
  );
}
