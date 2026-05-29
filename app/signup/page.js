"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function rand6() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState("");

  async function handleSignup(e) {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) { setLoading(false); setError(error.message); return; }

    // If we got a session immediately, update the role on the auto-created profile.
    if (data.user && data.session) {
      const patch = { role };
      if (role === "coach") patch.coach_code = rand6();
      await supabase.from("profiles").update(patch).eq("id", data.user.id);
      setLoading(false);
      router.push(role === "coach" ? "/coaching" : "/dashboard");
      return;
    }

    setLoading(false);
    setInfo("Check your email to confirm your account, then sign in. Set your role from your Profile page after sign-in.");
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleSignup} className="card max-w-md w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="logo-mark">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 19l5-9 3 5 4-7 6 11z" />
            </svg>
          </div>
          <div className="font-extrabold text-xl">RidgeLine</div>
        </div>
        <h1 className="text-2xl font-extrabold mb-1">Create your account</h1>
        <p className="text-[var(--muted)] text-sm mb-4">Train smarter, ride further.</p>

        <label className="field-label">Email</label>
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="input mb-3" placeholder="you@trail.com"
        />

        <label className="field-label">Password</label>
        <input
          type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
          className="input mb-4" placeholder="6+ characters"
        />

        <label className="field-label">I'm signing up as</label>
        <div className="flex gap-2 mb-4">
          <button type="button" onClick={() => setRole("student")}
            className={role === "student" ? "btn-primary text-sm" : "btn-ghost text-sm"}
            style={{ padding: "10px 16px", flex: 1 }}>
            Student
          </button>
          <button type="button" onClick={() => setRole("coach")}
            className={role === "coach" ? "btn-primary text-sm" : "btn-ghost text-sm"}
            style={{ padding: "10px 16px", flex: 1 }}>
            Coach
          </button>
        </div>

        {error && <p className="text-[var(--red2,#e87262)] text-sm mb-3">⚠ {error}</p>}
        {info && <p className="text-[var(--green2,#6cc28a)] text-sm mb-3">{info}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
          {loading ? "Creating account…" : "Create account"}
        </button>

        <p className="text-center text-sm text-[var(--muted)] mt-4">
          Already have one? <a href="/login" className="text-[var(--accent)] font-semibold">Sign in</a>
        </p>
      </form>
    </main>
  );
}
