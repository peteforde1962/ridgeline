// /docs — hidden internal documentation. Admin-gated, not linked in nav.
//
// This page is the single source of truth for: what each route/feature does,
// how the database is shaped, what env vars exist, the order of SQL migrations,
// and the deploy story. Update it as the app evolves.

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";

// Sections — keep TOC and content in sync via these ids.
const SECTIONS = [
  { id: "overview",     label: "Overview" },
  { id: "stack",        label: "Tech stack" },
  { id: "routes",       label: "Pages & routes" },
  { id: "api",          label: "API routes" },
  { id: "schema",       label: "Database schema" },
  { id: "rls",          label: "Row-level security" },
  { id: "features",     label: "Features" },
  { id: "integrations", label: "Integrations" },
  { id: "ai",           label: "AI features" },
  { id: "video",        label: "Video coaching & pose" },
  { id: "email",        label: "Daily email briefings" },
  { id: "migrations",   label: "SQL migrations (in order)" },
  { id: "env",          label: "Environment variables" },
  { id: "deployment",   label: "Deployment & cron" },
  { id: "ops",          label: "Operator playbook" },
  { id: "changelog",    label: "Build log" },
];

export default async function DocsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Admin-gated. Not linked from the sidebar.
  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!me?.is_admin) redirect("/dashboard");

  return (
    <main className="min-h-screen p-6 max-w-6xl mx-auto">
      <PageHeader />
      <h1 className="text-3xl font-extrabold mb-1">RidgeLine — internal docs</h1>
      <p className="text-[var(--muted)] mb-6 text-sm">
        Single source of truth for what's built, where it lives, and how to operate it.
        Visible only to admins. Update when the app changes.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        {/* Sticky table of contents */}
        <nav className="hidden lg:block">
          <div className="sticky top-4">
            <div className="text-xs uppercase tracking-wide text-[var(--muted)] mb-2">Contents</div>
            <ul className="text-sm space-y-1">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-[var(--muted)] hover:text-[var(--text)]">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Body */}
        <div className="prose-body space-y-10">
          <Section id="overview" title="Overview">
            <p>
              <strong>RidgeLine</strong> is a mountain-bike training app. Riders get a periodized
              training plan, log daily check-ins, track rides and trails (mostly auto-imported from
              Strava), chat with an AI coach, watch their own ride footage with pose-detected
              skeleton overlay, and — for coached riders — get human-coach feedback on uploaded clips.
            </p>
            <p>
              The app is live at <a href="https://ridgeline-mtb.ca" className="text-[var(--accent)]">ridgeline-mtb.ca</a>.
            </p>
            <h3>Three user roles</h3>
            <List>
              <li><strong>Student</strong> (default) — the rider. Sees their own plan, rides, videos.</li>
              <li><strong>Coach</strong> (admin-approved) — sees all data for their attached students. Can comment on student videos.</li>
              <li><strong>Admin</strong> (manually flipped via <Code>profiles.is_admin = true</Code> in SQL) — sees <Link href="/admin">/admin</Link> and this docs page; approves coach requests; manages Strava subscription.</li>
            </List>
          </Section>

          <Section id="stack" title="Tech stack">
            <List>
              <li><strong>Frontend:</strong> Next.js 14 (App Router), React 18, Tailwind CSS, custom CSS variables for theming.</li>
              <li><strong>Backend / DB:</strong> Supabase — Postgres, Auth (email/password), Storage (videos bucket), Row-Level Security on every table.</li>
              <li><strong>Hosting:</strong> Vercel (Hobby tier — daily cron only, 60s function timeout).</li>
              <li><strong>AI:</strong> Anthropic Claude — Haiku for cheap chats, Sonnet for deeper coaching answers.</li>
              <li><strong>Email:</strong> Resend, sending from <Code>briefing@ridgeline-mtb.ca</Code>.</li>
              <li><strong>Pose detection:</strong> Google MediaPipe <Code>pose_landmarker_full</Code>, loaded from CDN at runtime.</li>
              <li><strong>Integrations:</strong> Strava (OAuth + webhook), Suunto (built, awaiting API portal), OpenStreetMap Overpass (trail geometry for GPS matching).</li>
            </List>
          </Section>

          <Section id="routes" title="Pages & routes">
            <h3>Public</h3>
            <List>
              <li><Link href="/">/</Link> — marketing landing page.</li>
              <li><Link href="/login">/login</Link> — email/password sign-in.</li>
              <li><Link href="/signup">/signup</Link> — sign-up with role picker (Student / Coach).</li>
            </List>
            <h3>Rider (any authed user)</h3>
            <List>
              <li><Link href="/dashboard">/dashboard</Link> — Grafana-style home: readiness gauges, distance bar chart, training-load lines (CTL/ATL/TSB), recovery card, recent rides.</li>
              <li><Link href="/today">/today</Link> — what's on today: every plan session + extras + linked rides.</li>
              <li><Link href="/plan">/plan</Link> — full 12-week (default) calendar grid with traffic-light status, swap, complete, skip.</li>
              <li><Code>/plan/[w]/[d]</Code> — single-day detail with session toggles, add-extra, day notes.</li>
              <li><Link href="/checkin">/checkin</Link> — daily sleep/soreness/energy.</li>
              <li><Link href="/trails">/trails</Link> — derived trail list + word cloud + Log Ride link + worldwide trail search.</li>
              <li><Code>/rides/[id]</Code> — single ride with per-trail breakdown and map.</li>
              <li><Link href="/strength">/strength</Link>, <Link href="/yoga">/yoga</Link>, <Link href="/run">/run</Link>, <Link href="/rope">/rope</Link> — workout libraries.</li>
              <li><Link href="/skills">/skills</Link> — self-rated skills (endurance, cornering, drops, etc.).</li>
              <li><Link href="/videos">/videos</Link> — uploaded clips + linked YouTube/Vimeo, grouped by type.</li>
              <li><Code>/videos/[id]</Code> — detail page with pose overlay + timestamped comments.</li>
              <li><Link href="/coach">/coach</Link> — AI Coach chat (streaming, Haiku or Sonnet).</li>
              <li><Link href="/profile">/profile</Link> — rider profile + role switcher + coach invite/link + Strava/Suunto/email prefs.</li>
            </List>
            <h3>Coach role (after admin approval)</h3>
            <List>
              <li><Link href="/coaching">/coaching</Link> — roster of all attached students.</li>
              <li><Code>/coaching/students/[id]</Code> — full student overview: profile, last 10 rides, last 7 check-ins, all videos.</li>
              <li><Code>/coaching/students/[id]/videos/[videoId]</Code> — pose overlay + comment thread on a single student video.</li>
            </List>
            <h3>Admin</h3>
            <List>
              <li><Link href="/admin">/admin</Link> — total users, recent signups, top riders, Strava subscription, <strong>coach approval queue</strong>.</li>
              <li><Link href="/docs">/docs</Link> — this page. Hidden, not linked.</li>
            </List>
          </Section>

          <Section id="api" title="API routes">
            <List>
              <li><Code>POST /api/coach</Code> — streaming AI chat. Pulls user context (plan, recent rides, check-ins, skills) and sends to Claude. Model picker.</li>
              <li><Code>POST /api/coach-link</Code> — student attaches to a coach via 6-char invite code. Uses admin client to look up coach (bypasses RLS).</li>
              <li><Code>POST /api/admin/approve-coach</Code> — admin flips a user's <Code>coach_approved</Code>. Verifies caller is admin server-side.</li>
              <li><Code>GET / POST /api/strava/oauth</Code> — Strava OAuth init + callback (stores refresh token on profile).</li>
              <li><Code>POST /api/strava/sync</Code> — pulls last 14–90 days of activities, detects trails, computes per-trail seconds, auto-ticks plan sessions.</li>
              <li><Code>GET / POST /api/strava/webhook</Code> — Strava push subscription: GET verifies, POST handles new-activity events (same flow as sync, one ride).</li>
              <li><Code>POST /api/strava/subscribe</Code> — admin-only: creates the webhook subscription on Strava's side.</li>
              <li><Code>GET / POST /api/suunto/oauth</Code> — same pattern, awaiting Suunto API portal access.</li>
              <li><Code>POST /api/suunto/sync</Code> — pulls workouts from Suunto Cloud.</li>
              <li><Code>GET /api/cron/daily-email</Code> — Vercel cron entry-point. Sends today's briefing to every user with <Code>daily_email_enabled = true</Code>. Bearer-auth via <Code>CRON_SECRET</Code>.</li>
            </List>
          </Section>

          <Section id="schema" title="Database schema">
            <p>All tables live in the <Code>public</Code> schema. Authoritative source is <Code>supabase/schema.sql</Code> + each migration file listed below.</p>

            <h3><Code>profiles</Code></h3>
            <p>One row per signed-up user. Created automatically by the <Code>handle_new_user</Code> trigger on <Code>auth.users</Code>.</p>
            <List small>
              <li><Code>id</Code> uuid (PK, references <Code>auth.users</Code>)</li>
              <li><Code>email</Code>, <Code>name</Code></li>
              <li><Code>preset</Code> ('Novice' | 'Sport' | 'Pro'), <Code>level</Code>, <Code>weekly_hours</Code>, <Code>goal</Code>, <Code>race_date</Code>, <Code>intensity</Code>, <Code>plan_weeks</Code>, <Code>focus_skills</Code>, <Code>started_at</Code></li>
              <li><Code>timezone</Code> — IANA tz, auto-detected on first visit</li>
              <li><Code>is_admin</Code> — manually flipped in SQL</li>
              <li><strong>Strava:</strong> <Code>strava_athlete_id</Code>, <Code>strava_refresh_token</Code>, <Code>strava_access_token</Code>, <Code>strava_token_expires_at</Code>, <Code>strava_last_sync_at</Code></li>
              <li><strong>Suunto:</strong> <Code>suunto_user_id</Code>, <Code>suunto_refresh_token</Code>, <Code>suunto_access_token</Code>, <Code>suunto_token_expires_at</Code>, <Code>suunto_last_sync_at</Code></li>
              <li><strong>Email:</strong> <Code>daily_email_enabled</Code>, <Code>daily_email_hour</Code></li>
              <li><strong>Coach role:</strong> <Code>role</Code> ('student' | 'coach'), <Code>coach_id</Code>, <Code>coach_code</Code>, <Code>coach_approved</Code>, <Code>coach_requested_at</Code></li>
            </List>

            <h3><Code>check_ins</Code></h3>
            <p>Daily readiness log: <Code>sleep</Code>, <Code>soreness</Code>, <Code>energy</Code> (each 1–10), <Code>notes</Code>. Unique on (user_id, date).</p>

            <h3><Code>trails</Code></h3>
            <p>Saved trails with <Code>name</Code>, <Code>length_km</Code>, <Code>elev_m</Code>, <Code>difficulty</Code>, <Code>region</Code>, <Code>pr_minutes</Code>, <Code>last_ride</Code>. Auto-imported from Strava segments or OSM Overpass.</p>

            <h3><Code>rides</Code></h3>
            <p>One row per ride. <Code>date</Code>, <Code>km</Code>, <Code>elev_m</Code>, <Code>minutes</Code>, <Code>feel</Code> (1–5), <Code>notes</Code>, <Code>source</Code> (manual / strava / suunto), <Code>strava_activity_id</Code>, <Code>start_lat</Code>, <Code>start_lon</Code>, <Code>polyline</Code>. Back-compat <Code>trail_id</Code> kept; primary trail data is in <Code>ride_trails</Code>.</p>

            <h3><Code>ride_trails</Code></h3>
            <p>Many-to-many: rides ↔ trails. Per-trail metadata: <Code>points_on_trail</Code> (GPS hit count) and <Code>seconds_on_trail</Code> (estimated time on this trail). Drives PR computation per trail.</p>

            <h3><Code>plan_sessions</Code></h3>
            <p>One row per <em>actioned</em> plan slot (week_index, day_index, session_idx). Stores <Code>completed</Code>, <Code>tweak</Code> (easier/standard/harder/skipped), <Code>swapped_to</Code>, <Code>is_extra</Code>, <Code>custom_name</Code>, <Code>custom_notes</Code>, <Code>ride_id</Code> (link to recorded ride), <Code>ai_workout</Code> (Claude-generated session details).</p>

            <h3><Code>skills</Code></h3>
            <p>Self-ratings keyed by (<Code>user_id</Code>, <Code>key</Code>): endurance, power, cornering, drops, climbs, descents, mobility, strength. 1–10.</p>

            <h3><Code>videos</Code></h3>
            <p>Either an uploaded file (path in Supabase Storage) or a YouTube/Vimeo link. <Code>kind</Code>, <Code>url</Code>, <Code>name</Code>, <Code>type</Code>, <Code>notes</Code>, <Code>date</Code>. New columns from coach feature: <Code>pose_keypoints</Code> (jsonb cache), <Code>pose_status</Code>, <Code>pose_fps</Code>.</p>

            <h3><Code>video_comments</Code></h3>
            <p>Threaded feedback on a video. <Code>video_id</Code>, <Code>author_id</Code>, <Code>timestamp_ms</Code> (0 = general, &gt;0 = pinned to frame), <Code>body</Code>, <Code>frame_pose</Code>. Authored by the rider themselves or their approved coach.</p>

            <h3>Trail conditions, Strava subscription</h3>
            <p>Smaller tables: <Code>trail_conditions</Code> (user-submitted feed: muddy/dry/closed etc.), <Code>strava_subscription</Code> (singleton row tracking the active webhook subscription id).</p>
          </Section>

          <Section id="rls" title="Row-level security">
            <p>Every table has RLS enabled. The pattern is:</p>
            <List>
              <li><strong>Default:</strong> each user can read/write their own rows (<Code>auth.uid() = user_id</Code>).</li>
              <li><strong>Coach extension:</strong> a <Code>SECURITY DEFINER</Code> helper <Code>is_coach_of(student_id)</Code> bypasses RLS to check the link. Policies on <Code>check_ins</Code>, <Code>rides</Code>, <Code>trails</Code>, <Code>skills</Code>, <Code>plan_sessions</Code>, <Code>videos</Code> grant <Code>SELECT</Code> to coaches when this returns true.</li>
              <li><strong>Profiles:</strong> a coach can read their students (<Code>coach_id = auth.uid()</Code>); a student can read their own coach via <Code>my_coach_id()</Code> SECURITY DEFINER helper (this dodges infinite recursion on the profiles policy).</li>
              <li><strong>Storage:</strong> video files are stored at <Code>{`{user_id}/{filename}`}</Code>. A storage policy lets coaches read files in their students' folders.</li>
              <li><strong>Admin:</strong> admin pages call <Code>adminClient()</Code> (service role key) to bypass RLS for cross-user queries.</li>
            </List>
            <p className="text-xs text-[var(--muted)]">
              Gotcha: never query <Code>profiles</Code> in another policy's <Code>USING</Code> clause directly — it recurses. Always go through a SECURITY DEFINER helper.
            </p>
          </Section>

          <Section id="features" title="Features">
            <h3>Periodized training plan (<Code>lib/plan.js</Code>)</h3>
            <p>
              Generated procedurally from profile fields (preset, weekly_hours, goal, race_date, intensity, focus_skills, plan_weeks).
              Phases: base → build → peak → taper. Each day has a list of sessions (ride, strength, yoga, rope, run, rest).
              Sessions persist their state in <Code>plan_sessions</Code>: completed/tweak/swap/extra/notes/AI-generated details.
              Strava rides on a planned ride day auto-tick the existing slot; rides on rest days become "Recorded ride" extras.
            </p>

            <h3>Daily check-in</h3>
            <p>
              Sleep / soreness / energy (1–10). <Code>readinessFromCheckin</Code> turns these into a high/normal/low band that the Today view exposes,
              and the dashboard plots as a 14-day gauge + chart.
            </p>

            <h3>Trails & rides</h3>
            <p>
              Trails are derived: every ride's matched trails become entries in the user's trail list. Three-tier detection:
              <strong> Strava segment_efforts</strong> (Tier 0, primary — community-named trails with exact times),
              <strong> name match</strong> against existing trails (Tier 1),
              <strong> GPS polyline ∩ OSM Overpass</strong> (Tier 2, fallback — see <Code>lib/trail-detection.js</Code>).
              Per-trail seconds drive PRs.
            </p>

            <h3>Trail conditions feed</h3>
            <p>User-submitted "muddy / dry / closed / loose" badges per trail, time-decayed.</p>

            <h3>Recovery</h3>
            <p>Sums TSS over the last few days against fitness, returns "easy / moderate / hard / rest" recommendation displayed on the dashboard.</p>

            <h3>Skills self-rating</h3>
            <p>The profile's <Code>focus_skills</Code> bias the plan generator — riders weak on cornering get more skills work, weak on power get more intervals.</p>
          </Section>

          <Section id="integrations" title="Integrations">
            <h3>Strava</h3>
            <p>
              <Code>lib/strava.js</Code> handles OAuth (refresh tokens stored on profile), token refresh, and activity fetch.
              The sync route (<Code>/api/strava/sync</Code>) pulls last 14–90 days, runs trail detection, writes <Code>rides</Code> + <Code>ride_trails</Code>,
              and auto-ticks <Code>plan_sessions</Code>. The webhook (<Code>/api/strava/webhook</Code>) does the same for a single new activity in real-time.
              Subscription is admin-managed from <Link href="/admin">/admin</Link>.
            </p>

            <h3>Suunto</h3>
            <p>Built (<Code>lib/suunto.js</Code>, OAuth, sync) but paused — Suunto's API portal at apizone.suunto.com was inaccessible when we tried to register.</p>

            <h3>OpenStreetMap Overpass</h3>
            <p>
              <Code>lib/osm-trails.js</Code> queries Overpass mirrors for ways tagged <Code>mtb:scale</Code> or <Code>route=mtb</Code>.
              Used as the fallback trail source when Strava segments aren't available (notably on e-bike rides).
              Multiple mirrors with auto-fallback because Overpass is rate-limited and frequently 504s.
            </p>
          </Section>

          <Section id="ai" title="AI features">
            <h3>Coach AI (<Link href="/coach">/coach</Link>)</h3>
            <p>
              Streaming chat via Anthropic Claude. Two models available: Haiku (fast/cheap) and Sonnet (deeper).
              System prompt seeded with the user's profile, today's plan slot, last week of rides, last check-in, and skills ratings.
              Starter prompts adapt to context (e.g., "Should I do the planned hill repeats given my soreness?" if check-in shows high soreness).
            </p>

            <h3>AI workout generation</h3>
            <p>
              Inside the Plan day detail, clicking a session can request Claude to generate a full workout breakdown (sets/reps/cues).
              Result is cached in <Code>plan_sessions.ai_workout</Code> so subsequent views are free.
            </p>
          </Section>

          <Section id="video" title="Video coaching & pose">
            <h3>Storage</h3>
            <p>
              Bucket <Code>videos</Code>, path convention <Code>{`{user_id}/{filename}`}</Code>.
              200MB cap on uploads. YouTube/Vimeo URLs supported (normalized to embed URLs; no overlay possible on these).
            </p>

            <h3>MediaPipe pose overlay (<Code>components/PoseOverlay.js</Code>)</h3>
            <p>
              <Code>pose_landmarker_full</Code> loaded from CDN via dynamic <Code>import()</Code>. Detection throttled to ~15fps with a same-frame skip
              to keep CPU sane. Custom fullscreen toggle keeps the canvas overlay aligned at any scale.
              Joint angles computed per frame: knee, hip-hinge, elbow, torso-from-vertical, with ideal-range green/red badges tuned for MTB attack position.
            </p>

            <h3>Coach/student model</h3>
            <p>
              Riders sign up as Student by default. Toggling to Coach in <Link href="/profile">/profile</Link> creates a 6-char invite code and a pending request.
              An admin approves from <Link href="/admin">/admin</Link>; only then does the <Link href="/coaching">/coaching</Link> area unlock.
              Students paste a coach's code on their profile to attach — this grants the coach SELECT permission across the student's data via the
              <Code>is_coach_of</Code> RLS helper.
            </p>

            <h3>Comments</h3>
            <p>
              Pinned to the video's current frame by default. Coach comments get an accent-colored left border. Clicking a comment's timestamp
              seeks the video (dispatched via a window event so the overlay component can scrub).
            </p>
          </Section>

          <Section id="email" title="Daily email briefings">
            <p>
              <Code>lib/email.js</Code> renders an HTML briefing — today's plan slot, readiness band, link to <Link href="/today">/today</Link> — and sends via Resend
              from <Code>briefing@ridgeline-mtb.ca</Code>. Users opt in via <Code>EmailPrefs</Code> in their profile.
            </p>
            <p>
              Vercel cron entry-point is <Code>/api/cron/daily-email</Code>, secured with a Bearer header (<Code>CRON_SECRET</Code>).
              Runs daily at <Code>0 13 * * *</Code> UTC (6am Pacific). Hobby tier limits cron to once per day, so the route iterates every opted-in user in one shot.
            </p>
          </Section>

          <Section id="migrations" title="SQL migrations (run in this order)">
            <p className="text-sm text-[var(--muted)]">All files in <Code>supabase/</Code>. Run on first deploy; later migrations are additive and idempotent.</p>
            <List small>
              <li><Code>schema.sql</Code> — base tables + RLS.</li>
              <li><Code>storage-setup.sql</Code> — videos bucket + per-user storage policy.</li>
              <li><Code>strava-migration.sql</Code> — Strava OAuth columns + subscription table.</li>
              <li><Code>metric-migration.sql</Code> — switch length/elev units to km/m.</li>
              <li><Code>multi-trail-migration.sql</Code> — <Code>ride_trails</Code> table + RLS.</li>
              <li><Code>per-trail-time.sql</Code> — add <Code>seconds_on_trail</Code>.</li>
              <li><Code>plan-extras-migration.sql</Code> — <Code>is_extra</Code>, <Code>custom_name</Code>, <Code>custom_notes</Code> on <Code>plan_sessions</Code>.</li>
              <li><Code>plan-workout-link.sql</Code> — <Code>ride_id</Code>, <Code>ai_workout</Code> on <Code>plan_sessions</Code>.</li>
              <li><Code>admin-migration.sql</Code> — <Code>is_admin</Code> column.</li>
              <li><Code>trail-conditions-migration.sql</Code> — feed table.</li>
              <li><Code>email-prefs-migration.sql</Code> — opt-in columns.</li>
              <li><Code>timezone-migration.sql</Code> — IANA <Code>timezone</Code> column.</li>
              <li><Code>suunto-migration.sql</Code> — Suunto OAuth columns.</li>
              <li><Code>coach-migration.sql</Code> — role / coach_id / coach_code + video_comments + storage policy.</li>
              <li><Code>coach-rls-fix.sql</Code> — <Code>my_coach_id()</Code> helper to break recursion.</li>
              <li><Code>coach-approval-migration.sql</Code> — <Code>coach_approved</Code>, <Code>coach_requested_at</Code>.</li>
            </List>
          </Section>

          <Section id="env" title="Environment variables (Vercel)">
            <List small>
              <li><Code>NEXT_PUBLIC_SUPABASE_URL</Code>, <Code>NEXT_PUBLIC_SUPABASE_ANON_KEY</Code> — frontend Supabase client.</li>
              <li><Code>SUPABASE_SERVICE_ROLE_KEY</Code> — server-only, used by <Code>adminClient()</Code> for cross-user queries.</li>
              <li><Code>ANTHROPIC_API_KEY</Code> — Claude API key.</li>
              <li><Code>STRAVA_CLIENT_ID</Code>, <Code>STRAVA_CLIENT_SECRET</Code> — OAuth.</li>
              <li><Code>STRAVA_VERIFY_TOKEN</Code> — random string used for webhook subscription verification.</li>
              <li><Code>SUUNTO_CLIENT_ID</Code>, <Code>SUUNTO_CLIENT_SECRET</Code>, <Code>SUUNTO_SUBSCRIPTION_KEY</Code> — unused until portal access.</li>
              <li><Code>RESEND_API_KEY</Code>, <Code>EMAIL_FROM</Code> (e.g. <Code>RidgeLine &lt;briefing@ridgeline-mtb.ca&gt;</Code>) — daily emails.</li>
              <li><Code>CRON_SECRET</Code> — Bearer header for the cron entry-point.</li>
              <li><Code>NEXT_PUBLIC_SITE_URL</Code> — used in OAuth callbacks + email links.</li>
            </List>
          </Section>

          <Section id="deployment" title="Deployment & cron">
            <h3>Hosting</h3>
            <p>
              Vercel project on the Hobby tier. Production branch: <Code>main</Code>. Auto-deploys on push (when the GitHub integration is firing — if not,
              <Code>npx vercel --prod</Code> from the project folder forces a deploy).
            </p>
            <h3>Cron</h3>
            <p>
              <Code>vercel.json</Code> registers one cron: <Code>0 13 * * *</Code> hitting <Code>/api/cron/daily-email</Code>.
              Hobby tier limits cron to a single execution per day.
            </p>
            <h3>Webhook</h3>
            <p>
              Strava webhook lives at <Code>/api/strava/webhook</Code>. Verify token is exchanged once via the admin Subscribe button, then Strava posts new activities to that URL.
              <strong> Note:</strong> Vercel "Deployment Protection" blocks external POSTs by default — set it to "Only Preview Deployments" so production is reachable.
            </p>
            <h3>Domain & SSL</h3>
            <p>
              <Code>ridgeline-mtb.ca</Code> → Vercel-managed DNS + SSL. The Resend domain is also configured here for SPF/DKIM.
            </p>
          </Section>

          <Section id="ops" title="Operator playbook">
            <h3>Make someone an admin</h3>
            <p>Supabase SQL Editor:</p>
            <Pre>{`update profiles set is_admin = true where email = 'them@example.com';`}</Pre>

            <h3>Approve a coach request</h3>
            <p>Go to <Link href="/admin">/admin</Link> → "Coach requests" → Approve.</p>

            <h3>Bypass signup email rate limit (testing)</h3>
            <List>
              <li>Supabase → Authentication → Users → "Add user" with "Auto Confirm" — bypasses email entirely.</li>
              <li>Or: Authentication → Email provider → disable "Confirm email" while testing.</li>
              <li>Long term: configure Resend SMTP in Authentication → SMTP Settings.</li>
            </List>

            <h3>Re-sync a user's Strava history</h3>
            <p>That user goes to <Link href="/trails">/trails</Link> → "Sync rides now". Reads last 14 days at minimum, more if last_sync_at is older.</p>

            <h3>Force a Vercel deploy</h3>
            <Pre>{`cd "/Users/peteforde/Documents/Claude/Projects/web applications for mtb training"
npx vercel --prod`}</Pre>

            <h3>Check Strava subscription health</h3>
            <p><Link href="/admin">/admin</Link> shows the active subscription id. If missing, click Subscribe to create.</p>
          </Section>

          <Section id="changelog" title="Build log">
            <p className="text-sm text-[var(--muted)]">High-level milestones in order of build:</p>
            <List small>
              <li>Scaffold + auth + profile + dashboard</li>
              <li>Plan generation + Today/Plan/Day routes + session card</li>
              <li>Daily check-in + readiness</li>
              <li>Trails + rides + delete</li>
              <li>AI Coach (streaming Haiku/Sonnet, contextual starters)</li>
              <li>Workout libraries (strength, yoga, run, rope)</li>
              <li>Skills self-rating</li>
              <li>Mobile layout + desktop sidebar</li>
              <li>Plan UX: traffic lights, swaps, extras, day notes, AI workout details</li>
              <li>Trails rework: multi-trail per ride, GPS detection, per-trail time, word cloud</li>
              <li>Strava OAuth + sync + webhook + auto-tick</li>
              <li>Trail discovery via MTB Project → Strava segments → OSM Overpass</li>
              <li>Admin panel + Strava subscription mgmt</li>
              <li>Light → dark teal + peach palette iterations</li>
              <li>Dashboard rework (Grafana-style)</li>
              <li>Trail conditions feed + recovery recommendation</li>
              <li>Marketing landing page + SSL on custom domain</li>
              <li>Auto-detect timezone</li>
              <li>Daily email briefings (Resend + Vercel cron)</li>
              <li>Suunto integration (built, paused)</li>
              <li>Strava segments as primary trail source</li>
              <li>Coach/student roles, pose overlay, video comments</li>
              <li>Admin-gated coach approval flow</li>
              <li>This docs page</li>
            </List>
          </Section>
        </div>
      </div>

      <p className="text-xs text-[var(--muted)] mt-10 pt-6 border-t border-[var(--line)]">
        Last meaningful update — keep this paragraph in sync with the changelog above.
      </p>
    </main>
  );
}

// --- small inline helpers (no external dep) ---

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-4">
      <h2 className="text-2xl font-extrabold mb-3 pb-2 border-b border-[var(--line)]">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function Code({ children }) {
  return (
    <code className="px-1.5 py-0.5 rounded text-[0.85em]"
          style={{ background: "var(--surface2,#1a3d3d)", color: "var(--accent2,#f4b860)" }}>
      {children}
    </code>
  );
}

function Pre({ children }) {
  return (
    <pre className="rounded p-3 text-xs overflow-x-auto"
         style={{ background: "var(--surface2,#1a3d3d)", color: "var(--text)" }}>
      <code>{children}</code>
    </pre>
  );
}

function Link({ href, children }) {
  return <a href={href} className="text-[var(--accent)] font-semibold hover:underline">{children}</a>;
}

function List({ children, small }) {
  return (
    <ul className={`list-disc pl-5 space-y-1.5 ${small ? "text-xs" : "text-sm"}`}>
      {children}
    </ul>
  );
}
