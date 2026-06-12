// Landing page — marketing for non-signed-in visitors.
// Signed-in users redirect to dashboard.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Icon from "@/lib/icons";
import LogoMark from "@/components/LogoMark";

export default async function Home() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <main className="min-h-screen">
      {/* Top nav */}
      <nav className="px-6 py-4 flex items-center justify-between max-w-6xl mx-auto">
        <a href="/" className="flex items-center gap-2.5">
          <LogoMark size={32} />
          <span className="font-extrabold text-xl tracking-wide">RidgeLine</span>
        </a>
        <div className="flex items-center gap-2">
          <a href="/login" className="btn-ghost text-sm">Sign in</a>
          <a href="/signup" className="btn-primary text-sm">Get started</a>
        </div>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-8 pb-16 md:pt-20 md:pb-24 max-w-5xl mx-auto text-center">
        <div className="inline-block mb-5 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full"
             style={{ background: "rgba(248,182,166,0.15)", color: "var(--accent)", border: "1px solid rgba(248,182,166,0.4)" }}>
          For mountain bikers · Free during preview
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-5">
          Train for the trails you<br className="hidden md:block" />
          <span style={{ color: "var(--accent)" }}> actually ride.</span>
        </h1>
        <p className="text-lg md:text-xl text-[var(--muted)] max-w-2xl mx-auto mb-8">
          Personalized cycle plans, daily readiness check-ins, AI coaching, and automatic Strava sync that detects which trails you rode — all in one place.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <a href="/signup" className="btn-primary text-base" style={{ padding: "14px 24px", fontSize: 15 }}>
            Start training free
          </a>
          <a href="/login" className="btn-ghost text-base" style={{ padding: "14px 24px", fontSize: 15 }}>
            Sign in
          </a>
        </div>
        <p className="text-xs text-[var(--muted)] mt-5">No credit card · 30-second sign-up</p>
      </section>

      {/* Feature grid */}
      <section className="px-6 py-16 max-w-6xl mx-auto" style={{ borderTop: "1px solid var(--line)" }}>
        <h2 className="text-2xl md:text-3xl font-extrabold mb-2 text-center">Built for how riders actually train</h2>
        <p className="text-center text-[var(--muted)] mb-12 max-w-2xl mx-auto">
          Most training apps are made for road cyclists with power meters. RidgeLine is for mountain bikers — base + build + peak periodization, skill work, trail conditions, all the stuff that matters off-road.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Feature
            icon="calendar"
            title="Periodized plans"
            body="6-, 8-, 12-, 16-, or 24-week plans built around Base → Build → Peak → Race → Recovery. Pick your preset (Novice, Sport, Pro), adjust hours, swap workouts."
          />
          <Feature
            icon="heart"
            title="Daily body check-in"
            body="30 seconds: sleep, soreness, energy. Your readiness score auto-tunes today's intensity — easier when you're cooked, harder when you're flying."
          />
          <Feature
            icon="bike"
            title="Strava auto-sync"
            body="Every ride imports in seconds. GPS polyline matches the route against OpenStreetMap trails — so you see exactly which trails you rode without picking them."
          />
          <Feature
            icon="bolt"
            title="AI Coach"
            body="Knows your profile, plan phase, recent check-ins, and last 10 rides. Generates concrete workouts (warm-up + intervals + cool-down) for any session, on demand."
          />
          <Feature
            icon="globe"
            title="Worldwide trail data"
            body="Browse trails from any major MTB destination — Squamish, Whistler, Moab, Sedona, Rotorua, Finale — powered by OpenStreetMap. Or auto-detect from your rides."
          />
          <Feature
            icon="dumb"
            title="Strength + mobility libraries"
            body="40+ exercises, 30+ yoga poses, run sessions, flow-rope drills. Searchable. Tagged by body part and skill. All cycling-specific."
          />
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 max-w-5xl mx-auto" style={{ borderTop: "1px solid var(--line)" }}>
        <h2 className="text-2xl md:text-3xl font-extrabold mb-12 text-center">How it works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Step
            n="1"
            title="Sign up + set up"
            body="Pick a rider preset, weekly hours, plan length, and your big goal. 60 seconds total. We generate your periodized plan."
          />
          <Step
            n="2"
            title="Connect Strava"
            body="One click. Your rides flow in automatically. Trails auto-populate. Plan days auto-tick when you ride."
          />
          <Step
            n="3"
            title="Train smart"
            body="Daily check-ins shape your day. Coach AI answers anything. Recovery status tells you when to push and when to chill."
          />
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-20 text-center max-w-3xl mx-auto" style={{ borderTop: "1px solid var(--line)" }}>
        <h2 className="text-3xl md:text-4xl font-extrabold mb-4">Ready to ride faster, recover smarter?</h2>
        <p className="text-[var(--muted)] mb-8">Free to start. Cancel anytime — though there's nothing to cancel right now.</p>
        <a href="/signup" className="btn-primary text-base" style={{ padding: "14px 28px", fontSize: 15 }}>
          Create my plan
        </a>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 text-center text-xs text-[var(--muted)]" style={{ borderTop: "1px solid var(--line)" }}>
        © {new Date().getFullYear()} RidgeLine · Built for mountain bikers · <a href="/login" className="hover:text-[var(--text)]">Sign in</a>
      </footer>
    </main>
  );
}

function Feature({ icon, title, body }) {
  return (
    <div className="card">
      <div className="mb-3" style={{ color: "var(--accent)" }}>
        <Icon name={icon} size={28} />
      </div>
      <h3 className="font-bold text-lg mb-2">{title}</h3>
      <p className="text-sm text-[var(--muted)]">{body}</p>
    </div>
  );
}

function Step({ n, title, body }) {
  return (
    <div>
      <div className="w-12 h-12 rounded-full grid place-items-center text-xl font-extrabold mb-3"
           style={{ background: "rgba(248,182,166,0.18)", color: "var(--accent)", border: "1px solid rgba(248,182,166,0.5)" }}>
        {n}
      </div>
      <h3 className="font-bold text-lg mb-2">{title}</h3>
      <p className="text-sm text-[var(--muted)]">{body}</p>
    </div>
  );
}
