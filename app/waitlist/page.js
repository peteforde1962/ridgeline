// Public /waitlist landing page.
// - No auth required.
// - Reads ?src= from URL for IG post attribution.
// - Glass panels, on-brand copy, hero → highlights → form flow.
// - Post-submit shows a thank-you state with a link back to the marketing page.

"use client";

import { useEffect, useState } from "react";
import LogoMark from "@/components/LogoMark";
import Icon from "@/lib/icons";

// Highlights shown above the form so IG traffic understands the pitch in 15 sec.
const HIGHLIGHTS = [
  { icon: "bike",  title: "MTB-specific, not generic endurance",
    body: "Periodized plans built around riding — not road cycling or triathlon shoehorned in." },
  { icon: "bolt",  title: "AI coach with full context of your data",
    body: "Reads your rides, plan, check-ins, training load — answers like a real coach, not a chatbot." },
  { icon: "chart", title: "Trail intelligence built in",
    body: "GPS trail detection, elevation profiles from your ride streams, PR tracking segment by segment." },
  { icon: "yoga",  title: "Strength, mobility, skills — all in one",
    body: "Kettlebells, bodyweight, yoga, flow rope, running. Everything the athlete off the bike needs." },
];

export default function WaitlistPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [interests, setInterests] = useState("");
  const [source, setSource] = useState("");     // read from ?src=
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  // Grab the attribution query param (e.g. ig-post-1) so we can trace which
  // post drove this signup once it lands in the waitlist table.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const src = params.get("src") || params.get("utm_source");
    if (src) setSource(src);
  }, []);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          name:  name.trim() || null,
          interests: interests.trim() || null,
          source: source || null,
          referrer: typeof document !== "undefined" ? document.referrer || null : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setDone(true);
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  }

  return (
    <main className="min-h-screen p-6" style={{
      background: "linear-gradient(180deg, var(--bg) 0%, #1a2a30 100%)",
    }}>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-10">
          <a href="/" className="flex items-center gap-2 hover:opacity-80">
            <LogoMark size={32} />
            <span className="font-extrabold text-lg tracking-wide">RidgeLine</span>
          </a>
          <a href="/login" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
            Already have an account? Sign in →
          </a>
        </header>

        {/* Hero */}
        <section className="text-center mb-10">
          <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4"
               style={{ background: "rgba(248,182,166,0.12)", color: "var(--accent)", border: "1px solid rgba(248,182,166,0.35)" }}>
            <Icon name="bolt" size={12} stroke="var(--accent)" /> Beta open · free during beta
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-3 leading-tight">
            MTB training that actually<br />
            <span style={{ background: "linear-gradient(90deg, var(--accent), var(--accent2,#fccabb))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              gets you faster
            </span>
          </h1>
          <p className="text-lg text-[var(--muted)] max-w-xl mx-auto">
            Strength, mobility, skills, and trail intelligence in one app.
            Built by a rider, for riders.
          </p>
        </section>

        {done ? (
          <section className="card-glass text-center" style={{ padding: 40 }}>
            <div className="inline-flex items-center justify-center rounded-full mb-4"
                 style={{ width: 56, height: 56, background: "rgba(92,184,92,0.15)", border: "1px solid rgba(92,184,92,0.4)" }}>
              <Icon name="heart" size={28} stroke="#5cb85c" />
            </div>
            <h2 className="text-2xl font-extrabold mb-2">You're on the list.</h2>
            <p className="text-[var(--muted)] max-w-md mx-auto mb-6">
              I'll email you as soon as your beta slot is ready. In the meantime, if you can't wait — hit Sign up and dive in.
            </p>
            <div className="flex flex-wrap gap-3 justify-center">
              <a href="/signup" className="btn-primary">Sign up now →</a>
              <a href="/" className="btn-ghost">Back to home</a>
            </div>
          </section>
        ) : (
          <>
            {/* Highlights grid */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {HIGHLIGHTS.map((h) => (
                <div key={h.title} className="card-glass" style={{ padding: 20 }}>
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg flex-shrink-0" style={{
                      width: 40, height: 40, display: "grid", placeItems: "center",
                      background: "radial-gradient(circle at 30% 25%, rgba(248,182,166,0.22), rgba(248,182,166,0.08))",
                      border: "1px solid rgba(248,182,166,0.3)",
                    }}>
                      <Icon name={h.icon} size={20} stroke="var(--accent)" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-extrabold mb-1">{h.title}</h3>
                      <p className="text-sm text-[var(--muted)] leading-relaxed">{h.body}</p>
                    </div>
                  </div>
                </div>
              ))}
            </section>

            {/* Waitlist form */}
            <section className="card-glass mb-6" style={{ padding: 28 }}>
              <h2 className="text-xl font-extrabold mb-1">Get early access</h2>
              <p className="text-sm text-[var(--muted)] mb-5">
                Free during beta. In return I want your honest feedback.
              </p>

              <form onSubmit={submit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Email</label>
                    <input
                      type="email" required value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input"
                      placeholder="you@trail.com"
                    />
                  </div>
                  <div>
                    <label className="field-label">Name <span className="text-[var(--muted)] font-normal">(optional)</span></label>
                    <input
                      type="text" value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="input"
                      placeholder="Rider"
                    />
                  </div>
                </div>

                <div>
                  <label className="field-label">
                    What are you hoping to get out of RidgeLine? <span className="text-[var(--muted)] font-normal">(optional)</span>
                  </label>
                  <textarea
                    rows={2} value={interests}
                    onChange={(e) => setInterests(e.target.value)}
                    className="input"
                    placeholder="Faster on descents, first race, coming back from injury, etc."
                  />
                </div>

                {source && (
                  <p className="text-[11px] text-[var(--muted)]">
                    Referred by <span className="text-[var(--accent)] font-semibold">{source}</span>. Thanks for coming from there.
                  </p>
                )}

                {error && <p className="text-[var(--red,#e87262)] text-sm">⚠ {error}</p>}

                <button type="submit" disabled={busy}
                        className="btn-primary w-full justify-center inline-flex items-center gap-2">
                  <Icon name="send" size={16} stroke="#1a2a30" />
                  {busy ? "Sending…" : "Join the beta"}
                </button>

                <p className="text-[11px] text-center text-[var(--muted)]">
                  No spam, no selling your email. Just RidgeLine updates. Unsubscribe any time.
                </p>
              </form>
            </section>

            <p className="text-center text-sm text-[var(--muted)]">
              Prefer to jump straight in? <a href="/signup" className="text-[var(--accent)] font-semibold">Sign up directly →</a>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
