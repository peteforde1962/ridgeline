// /admin — operator dashboard. Only visible to users with profiles.is_admin = true.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import PageHeader from "@/components/PageHeader";
import SubscribeStravaButton from "@/components/SubscribeStravaButton";
import CoachApprovalRow from "@/components/CoachApprovalRow";
import TrailGeometryBackfillButton from "@/components/TrailGeometryBackfillButton";

export default async function AdminPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Check admin status from the user's own row (RLS-safe).
  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!me?.is_admin) redirect("/dashboard");

  // From here on, use the service-role client to query across all users.
  const admin = adminClient();

  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

  // Run queries in parallel.
  const [
    { data: profiles, count: totalUsers },
    { data: recentCheckinUsers },
    { data: recentRideUsers },
    { data: recentSignups },
    { count: stravaConnected },
    { data: ridesByUser },
    { data: sessionsByUser },
    { data: stravaSub },
    { data: pendingCoaches },
    { data: activeCoaches },
  ] = await Promise.all([
    admin.from("profiles").select("id, email, name, preset, strava_athlete_id, created_at", { count: "exact" }),
    admin.from("check_ins").select("user_id").gte("date", sevenDaysAgo),
    admin.from("rides").select("user_id").gte("date", sevenDaysAgo),
    admin.from("profiles").select("id, email, name, created_at, preset").order("created_at", { ascending: false }).limit(10),
    admin.from("profiles").select("*", { count: "exact", head: true }).not("strava_refresh_token", "is", null),
    admin.from("rides").select("user_id"),
    admin.from("plan_sessions").select("user_id").eq("completed", true),
    admin.from("strava_subscription").select("*").maybeSingle(),
    admin.from("profiles")
      .select("id, email, name, coach_requested_at")
      .eq("role", "coach").eq("coach_approved", false)
      .order("coach_requested_at", { ascending: false }),
    admin.from("profiles")
      .select("id, email, name, coach_code")
      .eq("role", "coach").eq("coach_approved", true)
      .order("name"),
  ]);

  // Aggregate
  const activeIds = new Set([
    ...(recentCheckinUsers || []).map(c => c.user_id),
    ...(recentRideUsers   || []).map(r => r.user_id),
  ]);

  // Top riders by rides logged
  const rideCount = {};
  (ridesByUser || []).forEach(r => { rideCount[r.user_id] = (rideCount[r.user_id] || 0) + 1; });
  const sessionCount = {};
  (sessionsByUser || []).forEach(s => { sessionCount[s.user_id] = (sessionCount[s.user_id] || 0) + 1; });

  const profileById = {};
  (profiles || []).forEach(p => { profileById[p.id] = p; });

  const topRiders = Object.entries(rideCount)
    .map(([id, n]) => ({ id, n, profile: profileById[id] }))
    .sort((a, b) => b.n - a.n).slice(0, 10);

  const topGrinders = Object.entries(sessionCount)
    .map(([id, n]) => ({ id, n, profile: profileById[id] }))
    .sort((a, b) => b.n - a.n).slice(0, 10);

  // Signups in last 7 / 30 days
  const signups7  = (profiles || []).filter(p => p.created_at >= sevenDaysAgo).length;
  const signups30 = (profiles || []).filter(p => p.created_at >= thirtyDaysAgo).length;

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <PageHeader />
      <h1 className="text-3xl font-extrabold mb-1">Admin</h1>
      <p className="text-[var(--muted)] mb-6">Operator view. Only visible to you.</p>

      {/* Top-line stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Total users"        v={totalUsers ?? 0} />
        <Stat label="Active (7d)"        v={activeIds.size} />
        <Stat label="New signups (7d)"   v={signups7} sub={`${signups30} in 30d`} />
        <Stat label="Strava connected"   v={stravaConnected ?? 0} />
      </section>

      {/* Coach approval queue */}
      <section className="card mb-6">
        <h2 className="text-lg font-bold mb-1">
          Coach requests
          {pendingCoaches?.length > 0 && (
            <span className="ml-2 text-xs px-2 py-0.5 rounded"
                  style={{ background: "var(--accent)", color: "white" }}>
              {pendingCoaches.length} pending
            </span>
          )}
        </h2>
        <p className="text-sm text-[var(--muted)] mb-3">
          Users who toggled themselves to Coach in /profile. Approve to unlock the Coaching area for them.
        </p>
        {(!pendingCoaches || pendingCoaches.length === 0) ? (
          <p className="text-sm text-[var(--muted)]">No pending requests.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[var(--muted)] text-xs uppercase tracking-wide">
                <th className="text-left p-2">User</th>
                <th className="text-left p-2">Requested</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {pendingCoaches.map((p) => <CoachApprovalRow key={p.id} profile={p} />)}
            </tbody>
          </table>
        )}

        {activeCoaches?.length > 0 && (
          <details className="mt-4">
            <summary className="text-xs text-[var(--muted)] cursor-pointer">
              {activeCoaches.length} approved coach{activeCoaches.length === 1 ? "" : "es"} (click to view)
            </summary>
            <ul className="text-sm mt-2 space-y-1">
              {activeCoaches.map((c) => (
                <li key={c.id} className="flex justify-between border-b border-[var(--line)] py-1">
                  <span>
                    <strong>{c.name || c.email}</strong>
                    <span className="text-[var(--muted)] ml-2">· code {c.coach_code || "—"}</span>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {/* Trail geometry backfill */}
      <section className="card mb-6">
        <h2 className="text-lg font-bold mb-2">Trail geometry backfill</h2>
        <p className="text-sm text-[var(--muted)] mb-3">
          Trails imported before the geometry-storage feature don't have polylines, so their elevation profiles fall back to estimated curves.
          This runs OSM Overpass for each missing trail, anchored on a linked ride's GPS start point. Batched and rate-limited; processes about 20 per click before continuing.
        </p>
        <TrailGeometryBackfillButton />
      </section>

      {/* Strava auto-sync */}
      <section className="card mb-6">
        <h2 className="text-lg font-bold mb-2">Strava auto-sync</h2>
        {stravaSub ? (
          <p className="text-sm text-[var(--green)]">
            ✓ Webhook subscription active (id {stravaSub.id}). New rides flow in automatically.
          </p>
        ) : (
          <>
            <p className="text-sm text-[var(--muted)] mb-3">
              Subscribe to Strava push events so any user's new ride lands in RidgeLine without clicking Sync.
              One-time setup. Needs <code>STRAVA_VERIFY_TOKEN</code> set in env vars.
            </p>
            <SubscribeStravaButton />
          </>
        )}
      </section>

      {/* Recent signups */}
      <section className="card mb-6">
        <h2 className="text-lg font-bold mb-3">Recent signups</h2>
        {(recentSignups || []).length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Nobody yet — share your URL.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[var(--muted)] text-xs uppercase tracking-wide">
                <th className="text-left p-2">Name / email</th>
                <th className="text-left p-2">Preset</th>
                <th className="text-left p-2">Signed up</th>
              </tr>
            </thead>
            <tbody>
              {recentSignups.map(p => (
                <tr key={p.id} className="border-t border-[var(--line)]">
                  <td className="p-2"><span className="font-semibold">{p.name || "—"}</span> <span className="text-[var(--muted)]">· {p.email}</span></td>
                  <td className="p-2">{p.preset}</td>
                  <td className="p-2 text-[var(--muted)]">{new Date(p.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Top users */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card">
          <h2 className="text-lg font-bold mb-3">Top by rides logged</h2>
          <UserList rows={topRiders} unit="rides" />
        </div>
        <div className="card">
          <h2 className="text-lg font-bold mb-3">Top by sessions completed</h2>
          <UserList rows={topGrinders} unit="sessions" />
        </div>
      </section>
    </main>
  );
}

function Stat({ label, v, sub }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-1">{label}</div>
      <div className="text-2xl font-extrabold">{v}</div>
      {sub && <div className="text-xs text-[var(--muted)] mt-1">{sub}</div>}
    </div>
  );
}

function UserList({ rows, unit }) {
  if (rows.length === 0) return <p className="text-sm text-[var(--muted)]">No data yet.</p>;
  return (
    <ol className="space-y-1 text-sm">
      {rows.map((r, i) => (
        <li key={r.id} className="flex justify-between items-center py-1 border-b border-[var(--line)] last:border-0">
          <span>
            <span className="text-[var(--muted)] mr-2">#{i + 1}</span>
            <span className="font-semibold">{r.profile?.name || "—"}</span>
            <span className="text-[var(--muted)] ml-2 text-xs">{r.profile?.email}</span>
          </span>
          <span className="font-bold">{r.n} {unit}</span>
        </li>
      ))}
    </ol>
  );
}
