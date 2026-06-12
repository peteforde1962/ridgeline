"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import LogoMark from "@/components/LogoMark";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setError(""); setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) { setError(error.message); return; }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleLogin} className="card max-w-md w-full">
        <div className="flex items-center gap-3 mb-4">
          <LogoMark size={32} />
          <div className="font-extrabold text-xl">RidgeLine</div>
        </div>
        <h1 className="text-2xl font-extrabold mb-1">Welcome back, rider</h1>
        <p className="text-[var(--muted)] text-sm mb-4">Sign in to keep training.</p>

        <label className="field-label">Email</label>
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          className="input mb-3" placeholder="you@trail.com"
        />

        <label className="field-label">Password</label>
        <input
          type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          className="input mb-4"
        />

        {error && <p className="text-[var(--red2,#e87262)] text-sm mb-3">⚠ {error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
          {loading ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-center text-sm text-[var(--muted)] mt-4">
          New here? <a href="/signup" className="text-[var(--accent)] font-semibold">Create an account</a>
        </p>
      </form>
    </main>
  );
}
