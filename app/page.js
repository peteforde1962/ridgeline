// Landing page.
// If signed in → go to dashboard. If not → go to login.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) redirect("/dashboard");

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="card max-w-lg w-full text-center">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="logo-mark">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 19l5-9 3 5 4-7 6 11z" />
            </svg>
          </div>
          <div className="font-extrabold text-xl tracking-wide">RidgeLine</div>
        </div>
        <h1 className="text-3xl font-extrabold mb-2">Train for the trails you actually ride.</h1>
        <p className="text-[var(--muted)] mb-6">
          Periodized plans, daily check-ins, yoga + strength, AI coaching. Built for mountain bikers.
        </p>
        <div className="flex gap-3 justify-center">
          <a href="/signup" className="btn-primary">Create account</a>
          <a href="/login" className="btn-ghost">Sign in</a>
        </div>
      </div>
    </main>
  );
}
