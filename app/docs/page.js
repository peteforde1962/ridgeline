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
  { id: "design",       label: "Design system" },
  { id: "routes",       label: "Pages & routes" },
  { id: "api",          label: "API routes" },
  { id: "schema",       label: "Database schema" },
  { id: "rls",          label: "Row-level security" },
  { id: "features",     label: "Features" },
  { id: "trails",       label: "Trail data pipeline" },
  { id: "activities",   label: "Activity import" },
  { id: "integrations", label: "Integrations" },
  { id: "ai",           label: "AI features" },
  { id: "video",        label: "Video coaching & pose" },
  { id: "coaching",     label: "Human coaching" },
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
              training plan, log daily check-ins, track rides and trails (auto-imported from
              Strava/Suunto/Garmin), chat with an AI coach, watch their own ride footage with
              pose-detected skeleton overlay, and — for coached riders — get human-coach feedback
              and prescribed workouts.
            </p>
            <p>
              The app is live at <a href="https://ridgeline-mtb.ca" className="text-[var(--accent)]">ridgeline-mtb.ca</a>.
            </p>
            <h3>Three user roles</h3>
            <List>
              <li><strong>Student</strong> (default) — the rider. Sees their own plan, rides, videos.</li>
              <li><strong>Coach</strong> (admin-approved) — sees and edits the plan, prescribes workouts, comments on videos, uploads videos directly to a student's library. Coach prescriptions trigger an email to the student.</li>
              <li><strong>Admin</strong> (manually flipped via <Code>profiles.is_admin = true</Code> in SQL) — sees <Link href="/admin">/admin</Link> and this docs page; approves coach requests; manages Strava subscription; backfills trail geometry.</li>
            </List>
          </Section>

          <Section id="stack" title="Tech stack">
            <List>
              <li><strong>Frontend:</strong> Next.js 14 (App Router), React 18, Tailwind CSS, custom CSS variables for theming.</li>
              <li><strong>Backend / DB:</strong> Supabase — Postgres, Auth (email/password), Storage (videos bucket), Row-Level Security on every table.</li>
              <li><strong>Hosting:</strong> Vercel (Hobby tier — daily cron only, 60s function timeout).</li>
              <li><strong>AI:</strong> Anthropic Claude — Haiku for fast chats, Sonnet for deeper coaching.</li>
              <li><strong>Email:</strong> Resend, sending from <Code>briefing@ridgeline-mtb.ca</Code>.</li>
              <li><strong>Pose detection:</strong> Google MediaPipe <Code>pose_landmarker_full</Code>, loaded from CDN at runtime.</li>
              <li><strong>Elevation DEM:</strong> Open Topo Data (Mapzen dataset, free, no key). Used for trail elevation profiles when Strava ride streams aren't available.</li>
              <li><strong>Integrations:</strong> Strava (OAuth + webhook + streams), Suunto (OAuth, awaiting portal access), Garmin (scaffold ready, awaiting Developer Program approval), OpenStreetMap Overpass (trail geometry + name reconciliation).</li>
            </List>
          </Section>

          <Section id="design" title="Design system">
            <h3>Palette (dark teal + peach)</h3>
            <p>
              CSS variables in <Code>globals.css</Code>. Primary accent <Code>#f8b6a6</Code> (peach), secondary <Code>#fccabb</Code> (light peach),
              backgrounds <Code>#134857</Code> deep teal and <Code>#262a2b</Code> charcoal panel. Semantic tokens: green/amber/red/blue traffic lights.
            </p>
            <h3>Glassmorphism</h3>
            <p>
              Two card recipes:
            </p>
            <List small>
              <li><strong><Code>.card</Code></strong> — solid panel, used for forms and lists.</li>
              <li><strong><Code>.card-glass</Code></strong> — translucent + frosted: top-edge highlight, soft top-down sheen, drop shadow that lifts the card off the page. Used on the dashboard's charts/dials/gauges and the training-load page.</li>
            </List>
            <h3>Rolladex pattern</h3>
            <p>
              <Code>.rolladex</Code> in <Code>globals.css</Code> — a glass container with internal vertical scroll and top/bottom <Code>mask-image</Code> fades that make rows "roll into view." Used on the Activities page for the recent-activities + trail-conditions panels.
            </p>
            <h3>Mobile bottom tab bar</h3>
            <p>
              Translucent backdrop-blur tab bar (visible on viewports &lt; 768px). Four primary tabs + a "More" button that opens a glassy sheet with the secondary nav grid. Uses the same brand SVG icon library as the desktop sidebar.
            </p>
            <h3>Brand SVG icons (<Code>lib/icons.js</Code>)</h3>
            <p>
              Shared 1.75px stroke icons — bike, run, hike, swim, ski, paddle, climb, dumb, yoga, rope, refresh, swap, spark, brain, pencil, trash, etc. Sized 12–22px. Used across sidebar, mobile bar, activity badges, action buttons. Emojis have been removed from all UI surfaces.
            </p>
            <h3>Trail profile chart</h3>
            <p>
              <Code>components/TrailProfileGraph.js</Code> — glassy container with an animated stroke-dasharray reveal, gradient-colored curve (color = local gradient %), top sheen sliver, and a stat strip below for climb / descent / max grade / steepest dip. Renders a skeleton shimmer while the elevation fetch resolves so users never see a "wrong → correct" flash.
            </p>
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
              <li><Link href="/dashboard">/dashboard</Link> — Grafana-style home: readiness gauges, distance bar chart, training-load lines (CTL/ATL/TSB), recovery card, recent activity rolladex.</li>
              <li><Link href="/today">/today</Link> — what's on today: every plan session + extras + linked rides.</li>
              <li><Link href="/plan">/plan</Link> — full N-week plan. <Code>?view=weeks</Code> (default) shows vertical week cards; <Code>?view=calendar</Code> shows a month-grid with prev/next nav and "Today" jump.</li>
              <li><Code>/plan/[w]/[d]</Code> — single-day detail with session toggles, add-extra, day notes.</li>
              <li><Link href="/checkin">/checkin</Link> — daily sleep/soreness/energy.</li>
              <li><Link href="/trails">/trails</Link> — Activities page. Word cloud of trails (top 20 with brand gradient), Strava sync card, two rolladex panels for trail conditions + recent activities, KPI strip for distance/elev/time, brand SVG icons throughout.</li>
              <li><Code>/trails/[id]</Code> — single trail with glassy elevation profile graph, condition feed, and per-trail ride history. Includes a GPX upload card to override with authoritative profile data.</li>
              <li><Code>/rides/[id]</Code> — single activity. Kind-aware: cycling activities show a trail breakdown table (clickable through to each trail), strength/yoga/swim/etc show appropriate metrics (HR, watts, kJ, suffer score). Has a "Re-sync this ride from Strava" button on Strava-sourced rides.</li>
              <li><Link href="/rides/new">/rides/new</Link> — log an activity manually.</li>
              <li><Link href="/training-load">/training-load</Link> — TrainingPeaks-style fitness/fatigue/form: 90-day chart with 14-day projection, daily TSS bars, weekly totals, per-ride TSS table, signal-mix breakdown (power vs HR vs Strava suffer vs duration estimate).</li>
              <li><Link href="/strength">/strength</Link>, <Link href="/yoga">/yoga</Link>, <Link href="/run">/run</Link>, <Link href="/rope">/rope</Link> — workout libraries (50+ strength exercises, 45 yoga poses, 15 run sessions, 18 rope drills).</li>
              <li><Link href="/skills">/skills</Link> — self-rated skills (endurance, cornering, drops, etc.).</li>
              <li><Link href="/videos">/videos</Link> — uploaded clips + linked YouTube/Vimeo, grouped by type.</li>
              <li><Code>/videos/[id]</Code> — detail page with MediaPipe pose overlay + timestamped comments.</li>
              <li><Link href="/coach">/coach</Link> — AI Coach chat (streaming, Haiku or Sonnet).</li>
              <li><Link href="/profile">/profile</Link> — rider profile + role switcher + coach invite/link + Strava/Suunto/Garmin cards + training zones (FTP/LTHR/maxHR) + email prefs.</li>
            </List>
            <h3>Coach role (after admin approval)</h3>
            <List>
              <li><Link href="/coaching">/coaching</Link> — roster of all attached students.</li>
              <li><Code>/coaching/students/[id]</Code> — full student overview: profile, KPI strip, training-load card, all rides (30d) with HR/watts, last 7 check-ins, all videos, plus inline Prescribe-a-workout form and Upload-video-for-student form. "View full plan →" button to the calendar editor.</li>
              <li><Code>/coaching/students/[id]/plan</Code> — read-only calendar grid of the student's full plan with peach stars on coach-prescribed sessions.</li>
              <li><Code>/coaching/students/[id]/plan/[w]/[d]</Code> — single-day editor: see template sessions, edit/delete coach-prescribed workouts, add new prescribed workouts (with optional student email).</li>
              <li><Code>/coaching/students/[id]/videos/[videoId]</Code> — pose overlay + comment thread on a single student video.</li>
            </List>
            <h3>Admin</h3>
            <List>
              <li><Link href="/admin">/admin</Link> — total users, recent signups, top riders, Strava subscription, coach approval queue, trail-geometry backfill button.</li>
              <li><Link href="/docs">/docs</Link> — this page. Hidden, not linked.</li>
            </List>
          </Section>

          <Section id="api" title="API routes">
            <h3>AI</h3>
            <List>
              <li><Code>POST /api/coach</Code> — streaming AI chat. Pulls user context (plan, recent rides, check-ins, skills) and sends to Claude. Model picker (Haiku / Sonnet).</li>
              <li><Code>POST /api/plan/workout-detail</Code> — generates a structured workout for a plan session. Library-first builder pulls real exercises from <Code>lib/training-content.js</Code>; <Code>regenerate: true</Code> calls Claude with a type-strict prompt instead.</li>
            </List>
            <h3>Coach features</h3>
            <List>
              <li><Code>POST /api/coach-link</Code> — student attaches to a coach via 6-char invite code.</li>
              <li><Code>POST /api/coaching/prescribe</Code> — coach writes a new prescribed workout on a student's plan; sends email if checkbox is set.</li>
              <li><Code>POST /api/coaching/edit-workout</Code> — coach updates an existing prescribed workout (name/type/body).</li>
              <li><Code>POST /api/coaching/delete-workout</Code> — coach removes a prescribed workout.</li>
            </List>
            <h3>Admin</h3>
            <List>
              <li><Code>POST /api/admin/approve-coach</Code> — flips a user's <Code>coach_approved</Code>.</li>
              <li><Code>POST /api/admin/backfill-trail-geometry</Code> — batched OSM Overpass query per region group to fill in missing trail polylines. Loops via the admin UI button until done.</li>
            </List>
            <h3>Strava</h3>
            <List>
              <li><Code>GET /api/strava/connect</Code> + <Code>GET /api/strava/callback</Code> — OAuth.</li>
              <li><Code>POST /api/strava/sync</Code> — pulls last 14–90 days of activities (all sport types, not just cycling), fetches altitude+distance streams, runs trail detection, writes <Code>rides</Code> + <Code>ride_trails</Code> + per-trail elevation profiles, auto-ticks <Code>plan_sessions</Code>. Returns rich per-activity debug.</li>
              <li><Code>POST /api/strava/sync-one</Code> — re-sync a single activity by Strava ID. Used by the "Re-sync this ride" button on activity detail pages.</li>
              <li><Code>GET / POST /api/strava/webhook</Code> — Strava push subscription: GET verifies, POST handles new-activity events (same flow as sync, single ride).</li>
              <li><Code>POST /api/strava/subscribe</Code> — admin-only: creates the webhook subscription.</li>
            </List>
            <h3>Suunto + Garmin</h3>
            <List>
              <li><Code>GET /api/suunto/connect | callback</Code>, <Code>POST /api/suunto/disconnect | sync</Code> — OAuth + multi-sport import.</li>
              <li><Code>GET /api/garmin/connect | callback</Code>, <Code>POST /api/garmin/disconnect | sync</Code> — same shape; inert until <Code>GARMIN_CLIENT_ID</Code> is set.</li>
            </List>
            <h3>Trails</h3>
            <List>
              <li><Code>GET /api/trails/[id]/elevation</Code> — returns cached profile if any, otherwise samples DEM via Open Topo Data and caches. <Code>?refresh=1</Code> forces a re-fetch.</li>
              <li><Code>POST /api/trails/[id]/upload-gpx</Code> — accepts a GPX file (Trailforks / Strava / Garmin export), parses every trkpt, computes climb/descent + samples, saves as authoritative profile that subsequent syncs won't overwrite.</li>
            </List>
            <h3>Email</h3>
            <List>
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
              <li><strong>Training zones:</strong> <Code>ftp</Code> (W), <Code>lthr</Code> (bpm), <Code>hr_max</Code> (bpm) — drive proper TSS calculations</li>
              <li><strong>Strava:</strong> <Code>strava_athlete_id</Code>, <Code>strava_refresh_token</Code>, <Code>strava_access_token</Code>, <Code>strava_token_expires_at</Code>, <Code>strava_last_sync_at</Code></li>
              <li><strong>Suunto:</strong> <Code>suunto_user_id</Code>, <Code>suunto_refresh_token</Code>, <Code>suunto_access_token</Code>, <Code>suunto_token_expires_at</Code>, <Code>suunto_last_sync_at</Code></li>
              <li><strong>Garmin:</strong> <Code>garmin_user_id</Code>, <Code>garmin_refresh_token</Code>, <Code>garmin_access_token</Code>, <Code>garmin_token_expires_at</Code>, <Code>garmin_last_sync_at</Code></li>
              <li><strong>Email:</strong> <Code>daily_email_enabled</Code>, <Code>daily_email_hour</Code></li>
              <li><strong>Coach role:</strong> <Code>role</Code> ('student' | 'coach'), <Code>coach_id</Code>, <Code>coach_code</Code>, <Code>coach_approved</Code>, <Code>coach_requested_at</Code></li>
            </List>

            <h3><Code>check_ins</Code></h3>
            <p>Daily readiness log: <Code>sleep</Code>, <Code>soreness</Code>, <Code>energy</Code> (each 1–10), <Code>notes</Code>. Unique on (user_id, date).</p>

            <h3><Code>trails</Code></h3>
            <p>Saved trails. Core: <Code>name</Code>, <Code>length_km</Code>, <Code>elev_m</Code>, <Code>descent_m</Code>, <Code>elev_high</Code>, <Code>elev_low</Code>, <Code>difficulty</Code>, <Code>region</Code>, <Code>pr_minutes</Code>, <Code>last_ride</Code>. New JSONB columns: <Code>geometry</Code> (OSM polyline as <Code>[{`{lat, lon}`}]</Code>) and <Code>elevation_profile</Code> (cached samples + climb/descent + source). Auto-imported from Strava segments (with OSM-name reconciliation) or OSM Overpass.</p>

            <h3><Code>rides</Code></h3>
            <p>One row per activity (any sport). Core: <Code>date</Code>, <Code>km</Code>, <Code>elev_m</Code>, <Code>minutes</Code>, <Code>feel</Code>, <Code>notes</Code>, <Code>source</Code> (manual | strava | suunto | garmin), <Code>start_lat</Code>, <Code>start_lon</Code>, <Code>polyline</Code>. Sport type: <Code>sport_type</Code> (raw e.g. "MountainBikeRide") + <Code>activity_kind</Code> (our coarse category — cycle/run/hike/swim/ski/paddle/strength/yoga/climb/other). Intensity: <Code>avg_hr</Code>, <Code>max_hr</Code>, <Code>avg_watts</Code>, <Code>weighted_avg_watts</Code> (NP), <Code>suffer_score</Code>, <Code>kilojoules</Code>, <Code>tss</Code> (cached). External IDs: <Code>strava_activity_id</Code>, <Code>garmin_activity_id</Code>, <Code>suunto_workout_key</Code>.</p>

            <h3><Code>ride_trails</Code></h3>
            <p>Many-to-many: rides ↔ trails. Per-trail metadata: <Code>points_on_trail</Code> (GPS hit count) and <Code>seconds_on_trail</Code> (estimated time on this trail). Primary key (ride_id, trail_id) — the detector aggregates segments that resolve to the same canonical trail.</p>

            <h3><Code>plan_sessions</Code></h3>
            <p>One row per <em>actioned</em> plan slot (week_index, day_index, session_idx). Stores <Code>completed</Code>, <Code>tweak</Code> (easier/standard/harder/skipped), <Code>swapped_to</Code>, <Code>is_extra</Code>, <Code>custom_name</Code>, <Code>custom_notes</Code>, <Code>ride_id</Code> (link to recorded ride), <Code>ai_workout</Code> (Markdown — library-built or Claude-generated). Coach-prescribed sessions also have <Code>prescribed_by_coach_id</Code> and <Code>prescribed_at</Code>.</p>

            <h3><Code>skills</Code></h3>
            <p>Self-ratings keyed by (<Code>user_id</Code>, <Code>key</Code>): endurance, power, cornering, drops, climbs, descents, mobility, strength. 1–10.</p>

            <h3><Code>videos</Code></h3>
            <p>Either an uploaded file (path in Supabase Storage) or a YouTube/Vimeo link. <Code>kind</Code>, <Code>url</Code>, <Code>name</Code>, <Code>type</Code>, <Code>notes</Code>, <Code>date</Code>. Pose-cache columns: <Code>pose_keypoints</Code> (jsonb), <Code>pose_status</Code>, <Code>pose_fps</Code>.</p>

            <h3><Code>video_comments</Code></h3>
            <p>Threaded feedback on a video. <Code>video_id</Code>, <Code>author_id</Code>, <Code>timestamp_ms</Code> (0 = general, &gt;0 = pinned to frame), <Code>body</Code>, <Code>frame_pose</Code>. Authored by the rider themselves or their approved coach.</p>

            <h3>Smaller tables</h3>
            <p><Code>trail_conditions</Code> (user-submitted feed: muddy/dry/closed etc.), <Code>strava_subscription</Code> (singleton row tracking the active webhook subscription id), <Code>plan_day_notes</Code> (free-form notes per day).</p>
          </Section>

          <Section id="rls" title="Row-level security">
            <p>Every table has RLS enabled. The pattern is:</p>
            <List>
              <li><strong>Default:</strong> each user can read/write their own rows (<Code>auth.uid() = user_id</Code>).</li>
              <li><strong>Coach extension:</strong> a <Code>SECURITY DEFINER</Code> helper <Code>is_coach_of(student_id)</Code> bypasses RLS to check the link. Policies on <Code>check_ins</Code>, <Code>rides</Code>, <Code>trails</Code>, <Code>skills</Code>, <Code>plan_sessions</Code>, <Code>videos</Code> grant <Code>SELECT</Code> to coaches when this returns true. <Code>plan_sessions</Code> also grants INSERT/UPDATE to coaches.</li>
              <li><strong>Profiles:</strong> a coach can read their students (<Code>coach_id = auth.uid()</Code>); a student can read their own coach via <Code>my_coach_id()</Code> SECURITY DEFINER helper (this dodges infinite recursion on the profiles policy).</li>
              <li><strong>Storage:</strong> video files are stored at <Code>{`{user_id}/{filename}`}</Code>. Storage policies let coaches read AND upload to files in their students' folders.</li>
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
              Sessions persist their state in <Code>plan_sessions</Code>. Strava rides on a planned ride day auto-tick the existing slot; rides on rest days become "Recorded ride" extras.
              The plan is viewable as Weeks or as a month Calendar via <Code>?view=calendar</Code>.
            </p>

            <h3>Daily check-in</h3>
            <p>
              Sleep / soreness / energy (1–10). <Code>readinessFromCheckin</Code> turns these into a high/normal/low band exposed on Today and plotted as a 14-day gauge + chart on the dashboard.
              Timezone-aware: the check-in form uses the user's IANA timezone so dashboard and check-in agree on "today."
            </p>

            <h3>Trail conditions feed</h3>
            <p>User-submitted "muddy / dry / closed / loose" badges per trail, time-decayed.</p>

            <h3>Recovery</h3>
            <p>Sums TSS over the last few days against fitness, returns "easy / moderate / hard / rest" recommendation displayed on the dashboard.</p>

            <h3>Skills self-rating</h3>
            <p>The profile's <Code>focus_skills</Code> bias the plan generator — riders weak on cornering get more skills work, weak on power get more intervals.</p>

            <h3>Training load (<Code>/training-load</Code>)</h3>
            <p>
              CTL/ATL/TSB with 14-day rest projection. Per-ride TSS uses the best signal available in this priority: power + FTP, then HR + LTHR (hrTSS via TRIMP),
              then Strava Relative Effort (suffer_score), then a duration-tier estimate. The "TSS data sources" chip strip shows the mix so users can see how accurate their numbers are.
            </p>
          </Section>

          <Section id="trails" title="Trail data pipeline">
            <h3>Detection (<Code>lib/trail-detection.js</Code>)</h3>
            <p>Three tiers run on every Strava sync to map an activity to a list of trails:</p>
            <List>
              <li><strong>Tier 0 (primary): Strava segment_efforts.</strong> Each unique segment becomes a trail. The segment name is <strong>cross-referenced against OSM</strong> trails near the ride's start so "Pseudo Tsuga new berms" → "Pseudo Tsuga" automatically. OSM polyline gets saved alongside. Cross-ref is bounded to 4s per Overpass call with shared cache + circuit breaker across the sync.</li>
              <li><strong>Tier 1: name match</strong> against the user's existing trails.</li>
              <li><strong>Tier 2: GPS polyline ∩ OSM Overpass.</strong> Fallback when no segment_efforts (e-bikes, private rides).</li>
            </List>
            <p>Matches dedupe by trail_id (multiple segments resolving to the same canonical trail get aggregated, with seconds_on_trail summed).</p>

            <h3>Elevation profiles</h3>
            <p>Each trail has an <Code>elevation_profile</Code> JSONB column with samples, climb, descent, and a <Code>source</Code> string. Sources are checked in priority order:</p>
            <List small>
              <li><strong><Code>gpx-upload</Code></strong> — user uploaded a GPX from Trailforks/Strava/Garmin. Authoritative — sync never overwrites it.</li>
              <li><strong><Code>strava-ride-streams</Code></strong> — auto-computed during sync by slicing the ride's altitude stream by <Code>segment_effort.start_index/end_index</Code>. High-resolution per-second altitude data, smoothed (9-point moving average) + noise-filtered (2m threshold) so totals come close to Trailforks.</li>
              <li><strong><Code>opentopodata-mapzen-v2</Code></strong> — DEM sample for trails with OSM polyline but no rides. Mapzen dataset (combines SRTM + NED + others). 80-point chart subsampling.</li>
              <li><strong>Procedural fallback</strong> — for trails with no polyline at all. Estimates climb from length × difficulty × seeded variance so every trail looks different. Clearly labeled "estimated shape" in the UI subtitle.</li>
            </List>
            <p>The <Link href="/trails">/trails/[id]</Link> page renders the glassy profile chart with skeleton loading state so users never see the procedural curve flash before real data arrives.</p>

            <h3>Geometry backfill</h3>
            <p>Admin button on <Link href="/admin">/admin</Link> re-queries OSM Overpass for trails missing geometry. Groups by region centroid (with ride start coords + polyline first-point as fallbacks), one Overpass query per region. Auto-loops until done; skips groups with zero matches.</p>
          </Section>

          <Section id="activities" title="Activity import">
            <h3>All sport types, not just cycling</h3>
            <p>
              The <Code>rides</Code> table holds any Strava/Suunto/Garmin activity — runs, hikes, swims, ski, paddle, strength, yoga, climbing, more.
              <Code>lib/activity.js</Code> maps Strava sport_type strings to our <Code>activity_kind</Code> + brand icon + label. The Suunto + Garmin libs map their own activity-type identifiers to the same vocabulary so icons/labels are consistent across sources.
            </p>
            <h3>Brand badges (<Code>components/ActivityBadge.js</Code>)</h3>
            <p>Small chip with icon + label. Appears next to every ride on the dashboard rolladex, the activity detail page header, the trails-page activity table, and the coach's view of student rides.</p>
            <h3>Kind-aware activity detail</h3>
            <p>
              <Code>/rides/[id]</Code> adapts its stat strip + sections to the activity kind. Cycling shows distance + elevation + trails table; strength/yoga/swim show duration + HR + watts + energy and hide the trail breakdown.
            </p>
            <h3>Trail detection skips non-cycling</h3>
            <p><Code>detectTrailsForActivity</Code> early-returns for non-cycling sport types so trail tables stay clean of incidental runs/hikes.</p>
          </Section>

          <Section id="integrations" title="Integrations">
            <h3>Strava</h3>
            <p>
              <Code>lib/strava.js</Code> handles OAuth (refresh tokens stored on profile), token refresh, activity fetch, and the <Code>fetchActivityStreams</Code> helper for per-point altitude/distance/latlng data.
              The sync route (<Code>/api/strava/sync</Code>) pulls all activity types, fetches streams + segment_efforts, runs trail detection with OSM-name cross-ref, writes per-trail elevation profiles, and auto-ticks <Code>plan_sessions</Code>.
              The webhook (<Code>/api/strava/webhook</Code>) does the same for a single new activity in real-time. Subscription is admin-managed from <Link href="/admin">/admin</Link>.
              The API base URL is env-flippable via <Code>STRAVA_API_BASE</Code> ahead of the 2027 mandatory migration to <Code>www.api-v3.strava.com</Code>.
            </p>

            <h3>Suunto</h3>
            <p>
              <Code>lib/suunto.js</Code> — OAuth + multi-sport workout import via Suunto's Cloud API. 35+ Suunto activity-IDs mapped to our sport_type vocabulary so icons and badges Just Work. Built but paused — Suunto's API portal at apizone.suunto.com was inaccessible when we tried to register.
            </p>

            <h3>Garmin</h3>
            <p>
              <Code>lib/garmin.js</Code> — OAuth 2.0 scaffold + 35+ Garmin activity-type mappings + Activity API sync. Inert until <Code>GARMIN_CLIENT_ID</Code> is set in env. Garmin's Developer Program is application-gated (no self-serve at developerportal.garmin.com), so the integration goes live when we get approved.
              In practice, most Garmin users already have Garmin → Strava auto-sync configured, so their data flows through the Strava integration without any Garmin API access.
            </p>

            <h3>Open Topo Data DEM</h3>
            <p>
              <Code>lib/elevation.js</Code> queries <Code>api.opentopodata.org/v1/mapzen</Code> for trail elevation when we have an OSM polyline but no Strava ride streams. Free, no API key. Batched at 100 points per request, capped at 500 per trail. Smoothing + 1m noise threshold; cached on the trail row.
            </p>

            <h3>OpenStreetMap Overpass</h3>
            <p>
              <Code>lib/osm-trails.js</Code> queries Overpass mirrors for ways tagged <Code>mtb:scale</Code> or <Code>route=mtb</Code>.
              Used for both fallback trail detection AND name reconciliation of Strava segments. Multiple mirrors with auto-fallback and per-call timeouts; the trail-detection cache shares Overpass results across rides in a single sync.
            </p>
          </Section>

          <Section id="ai" title="AI features">
            <h3>Coach AI (<Link href="/coach">/coach</Link>)</h3>
            <p>
              Streaming chat via Anthropic Claude. Two models: Haiku (fast) and Sonnet (deep). Selectable via the brain/bolt mode picker.
              System prompt seeded with the user's profile, today's plan slot, last week of rides, last check-in, and skills ratings.
              Starter prompts adapt to context (e.g., "Should I do the planned hill repeats given my soreness?" if check-in shows high soreness).
            </p>

            <h3>Library-first workout builder (<Code>lib/workout-builder.js</Code>)</h3>
            <p>
              Inside the Plan day detail, clicking "Show workout" first pulls real exercises from the training library — strength sessions get real strength exercises grouped by Lower-body Power / Upper + Core / etc.; yoga sessions get real poses; rope/run/ride likewise.
              Deterministic per session (same workout on refresh). Hit "🤖 Regenerate with Coach AI" for a fresh AI-tuned variant.
              The AI prompt is <strong>type-strict</strong> — for strength it explicitly bans cycling vocabulary ("RPE/HR zones/spin"), so Claude can't drift back into ride workouts for a strength session.
            </p>
          </Section>

          <Section id="video" title="Video coaching & pose">
            <h3>Storage</h3>
            <p>
              Bucket <Code>videos</Code>, path convention <Code>{`{user_id}/{filename}`}</Code>. Coach uploads use <Code>{`{studentId}/coach-{timestamp}-{filename}`}</Code>.
              200MB cap on uploads. YouTube/Vimeo URLs supported (normalized to embed URLs; no overlay possible on these).
            </p>

            <h3>MediaPipe pose overlay (<Code>components/PoseOverlay.js</Code>)</h3>
            <p>
              <Code>pose_landmarker_full</Code> loaded from CDN via dynamic <Code>import()</Code>. Detection throttled to ~15fps with a same-frame skip
              to keep CPU sane. Custom fullscreen toggle keeps the canvas overlay aligned at any scale.
              Joint angles computed per frame: knee, hip-hinge, elbow, torso-from-vertical, with ideal-range green/red badges tuned for MTB attack position.
            </p>

            <h3>Comments</h3>
            <p>
              Pinned to the video's current frame by default. Coach comments get an accent-colored left border. Clicking a comment's timestamp
              seeks the video (dispatched via a window event so the overlay component can scrub).
            </p>
          </Section>

          <Section id="coaching" title="Human coaching">
            <h3>Roles + invite codes</h3>
            <p>
              Riders sign up as Student by default. Toggling to Coach in <Link href="/profile">/profile</Link> creates a 6-char invite code and a pending request.
              An admin approves from <Link href="/admin">/admin</Link>; only then does the <Link href="/coaching">/coaching</Link> area unlock.
              Students paste a coach's code on their profile to attach — this grants the coach SELECT permission across the student's data via the <Code>is_coach_of</Code> RLS helper.
            </p>

            <h3>Coach plan editor</h3>
            <p>
              <Code>/coaching/students/[id]/plan</Code> is a calendar grid of the student's plan, peach stars marking coach-prescribed extras.
              Click any day to <Code>/coaching/students/[id]/plan/[w]/[d]</Code> where the coach can edit/delete their prescribed workouts or add a new one. Adding uses the same library-first builder as the rider's own "Show workout" flow.
            </p>

            <h3>Prescription emails</h3>
            <p>
              When a coach saves a new prescribed workout with the "Email student" checkbox enabled, <Code>sendCoachPrescriptionEmail</Code> dispatches an HTML email via Resend with the workout body, date, and a link back to <Link href="/today">/today</Link>.
            </p>

            <h3>Coach video upload</h3>
            <p>
              Coaches can upload footage they shot of a student directly into the student's <Code>videos</Code> library. RLS + storage policies grant the coach insert access to <Code>videos</Code> rows and the student's folder in Storage. Once uploaded, the same MediaPipe pose overlay + comment thread works for both parties.
            </p>
          </Section>

          <Section id="email" title="Daily email briefings">
            <p>
              <Code>lib/email.js</Code> renders an HTML briefing — today's plan slot, readiness band, link to <Link href="/today">/today</Link> — and sends via Resend
              from <Code>briefing@ridgeline-mtb.ca</Code>. Users opt in via <Code>EmailPrefs</Code> in their profile.
              Same module exports <Code>sendCoachPrescriptionEmail</Code> for the coach-prescription notification flow.
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
              <li><Code>training-load-migration.sql</Code> — intensity columns on <Code>rides</Code> + <Code>ftp</Code>, <Code>lthr</Code>, <Code>hr_max</Code> on <Code>profiles</Code>.</li>
              <li><Code>coach-prescribe-migration.sql</Code> — <Code>prescribed_by_coach_id</Code>, <Code>prescribed_at</Code> on <Code>plan_sessions</Code> + RLS for coach insert/update on <Code>plan_sessions</Code> and <Code>videos</Code>; storage policy for coach upload.</li>
              <li><Code>all-activities-migration.sql</Code> — <Code>sport_type</Code>, <Code>activity_kind</Code> on <Code>rides</Code>; backfill existing rides to <Code>cycle</Code>.</li>
              <li><Code>trail-elevation-migration.sql</Code> — <Code>geometry</Code> + <Code>elevation_profile</Code> JSONB on <Code>trails</Code>.</li>
              <li><Code>trail-descent-migration.sql</Code> — <Code>descent_m</Code>, <Code>elev_high</Code>, <Code>elev_low</Code> on <Code>trails</Code>.</li>
              <li><Code>garmin-migration.sql</Code> — Garmin OAuth columns on <Code>profiles</Code>; <Code>garmin_activity_id</Code> + unique index on <Code>rides</Code>.</li>
            </List>
          </Section>

          <Section id="env" title="Environment variables (Vercel)">
            <List small>
              <li><Code>NEXT_PUBLIC_SUPABASE_URL</Code>, <Code>NEXT_PUBLIC_SUPABASE_ANON_KEY</Code> — frontend Supabase client.</li>
              <li><Code>SUPABASE_SERVICE_ROLE_KEY</Code> — server-only, used by <Code>adminClient()</Code> for cross-user queries.</li>
              <li><Code>ANTHROPIC_API_KEY</Code> — Claude API key.</li>
              <li><Code>STRAVA_CLIENT_ID</Code>, <Code>STRAVA_CLIENT_SECRET</Code> — OAuth.</li>
              <li><Code>STRAVA_VERIFY_TOKEN</Code> — random string used for webhook subscription verification.</li>
              <li><Code>STRAVA_API_BASE</Code> — optional. Defaults to <Code>https://www.strava.com/api/v3</Code>. Flip to <Code>https://www.api-v3.strava.com</Code> when Strava confirms the new host is live (mandatory by June 1, 2027). No code change needed — just update the env var and redeploy.</li>
              <li><Code>SUUNTO_CLIENT_ID</Code>, <Code>SUUNTO_CLIENT_SECRET</Code>, <Code>SUUNTO_SUBSCRIPTION_KEY</Code> — unused until portal access.</li>
              <li><Code>GARMIN_CLIENT_ID</Code>, <Code>GARMIN_CLIENT_SECRET</Code> — unused until Garmin Developer Program approval. Garmin scaffold goes live the moment these are set + the user authorizes.</li>
              <li><Code>RESEND_API_KEY</Code>, <Code>EMAIL_FROM</Code> (e.g. <Code>RidgeLine &lt;briefing@ridgeline-mtb.ca&gt;</Code>) — Resend transactional email.</li>
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

            <h3>Backfill trail geometry</h3>
            <p>Go to <Link href="/admin">/admin</Link> → "Trail geometry backfill" → click the button. Auto-loops one region at a time. Trails get OSM polylines, which unlocks DEM elevation profiles on subsequent views.</p>

            <h3>Override a trail's elevation with authoritative data</h3>
            <p>Open the trail page → "Upload GPX from Trailforks / Strava" → drop in a GPX. Replaces geometry + climb + descent + samples with the file's data. Tagged <Code>gpx-upload</Code> so syncs won't overwrite it.</p>

            <h3>Re-sync a single ride</h3>
            <p>Open the activity detail page → "Re-sync this ride from Strava" button. Shows full debug JSON inline (trails matched, ride_trails inserted, OSM cross-ref hits, etc.) — use this for diagnosing trail-detection issues on a specific ride.</p>

            <h3>Bypass signup email rate limit (testing)</h3>
            <List>
              <li>Supabase → Authentication → Users → "Add user" with "Auto Confirm" — bypasses email entirely.</li>
              <li>Or: Authentication → Email provider → disable "Confirm email" while testing.</li>
              <li>Long term: configure Resend SMTP in Authentication → SMTP Settings.</li>
            </List>

            <h3>Re-sync a user's full Strava history</h3>
            <p>That user goes to <Link href="/trails">/trails</Link> → "Sync". Reads last 14 days at minimum, more if last_sync_at is older. Reset <Code>strava_last_sync_at</Code> to NULL in SQL to force a 90-day backsync.</p>

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
              <li>Dark teal + peach palette</li>
              <li>Dashboard rework (Grafana-style)</li>
              <li>Trail conditions feed + recovery recommendation</li>
              <li>Marketing landing page + SSL on custom domain</li>
              <li>Auto-detect timezone</li>
              <li>Daily email briefings (Resend + Vercel cron)</li>
              <li>Suunto integration (built, paused)</li>
              <li>Strava segments as primary trail source</li>
              <li>Coach/student roles, pose overlay, video comments</li>
              <li>Admin-gated coach approval flow</li>
              <li>Internal docs page</li>
              <li>Real TrainingPeaks-style training load (Strava intensity capture, power/HR-based TSS, /training-load page)</li>
              <li>Glassmorphism design system (cards, rolladex, trail profile)</li>
              <li>Fix AI workout type — library-first + type-strict prompts</li>
              <li>Mobile tab bar with brand SVG icons + glassy More sheet</li>
              <li>Coach prescribe workouts + email + upload videos for student</li>
              <li>Coach edit/delete on the whole plan + calendar editor</li>
              <li>Strava API URL migration (2027 prep)</li>
              <li>All Strava activity types with brand icons</li>
              <li>Word cloud top-20 + gradient; Activities rename; activity detail kind-aware</li>
              <li>Glass rolladex for activities + conditions</li>
              <li>Glassy trail profile gradient graph</li>
              <li>Real trail elevation profiles from Open Topo Data DEM</li>
              <li>Admin backfill trail geometry from OSM</li>
              <li>Capture trail descent + descent-biased profiles</li>
              <li>Auto-compute trail profiles from Strava ride streams</li>
              <li>Clickable trails in activity detail</li>
              <li>Resolve Strava segments to OSM/Trailforks canonical names</li>
              <li>GPX upload (Trailforks/Strava/Garmin) as authoritative profile source</li>
              <li>Improve trail stats accuracy (smoothing + noise filter + sliding-window gradient)</li>
              <li>Single-ride re-sync endpoint + button</li>
              <li>Dedupe trail matches by trail_id</li>
              <li>Trail profile skeleton loading state</li>
              <li>Suunto all-activity import + Garmin OAuth 2.0 scaffold</li>
              <li>Calendar view of the plan</li>
              <li>This docs refresh</li>
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
