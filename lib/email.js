// Daily briefing email — sent via Resend.
// Subject + HTML body are simple inline-styled so they render anywhere.

import { buildPlan, currentWeekIndex, todayDayIndex, todayDateInTz, sessionLabel } from "@/lib/plan";
import { recoveryRecommendation } from "@/lib/recovery";

const FROM = process.env.EMAIL_FROM || "RidgeLine <briefing@ridgeline-mtb.ca>";

export async function sendDailyBriefing(profile, supabase) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not set");
  if (!profile?.email) throw new Error("Profile has no email");

  const plan = buildPlan(profile);
  const wIdx = currentWeekIndex(profile.started_at, plan.length);
  const dIdx = todayDayIndex(profile.timezone);
  const week = plan[wIdx];
  const day  = week?.days?.[dIdx];
  if (!day) return { skipped: "no plan day" };

  const today = todayDateInTz(profile.timezone);

  const [{ data: todayCheckin }, { data: recentRides }, { data: extras }] = await Promise.all([
    supabase.from("check_ins").select("*").eq("user_id", profile.id).eq("date", today).maybeSingle(),
    supabase.from("rides").select("date, km, elev_m, minutes")
      .eq("user_id", profile.id)
      .gte("date", new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10)),
    supabase.from("plan_sessions")
      .select("session_idx, swapped_to, custom_name")
      .eq("user_id", profile.id).eq("week_index", wIdx).eq("day_index", dIdx)
      .eq("is_extra", true),
  ]);

  const recovery = recoveryRecommendation({ rides: recentRides, todayCheckin });

  const sessionList = [
    ...day.details.map((s) => s.name),
    ...((extras || []).map((e) => e.custom_name || sessionLabel(e.swapped_to || "ride"))),
  ];
  const dayLabel = sessionList.length === 0 ? "Rest day" : sessionList.join(" · ");

  const subject = `🚴 RidgeLine · ${day.day} — ${dayLabel}`.slice(0, 80);
  const html = buildHtml({ profile, plan, week, day, dayLabel, recovery, todayCheckin });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from: FROM, to: profile.email, subject, html }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error("Resend: " + t);
  }
  return res.json();
}

function buildHtml({ profile, plan, week, day, dayLabel, recovery, todayCheckin }) {
  const name = profile.name || "rider";
  const dateStr = new Date().toLocaleDateString("en-US", {
    timeZone: profile.timezone || undefined,
    weekday: "long", month: "short", day: "numeric",
  });

  const sessions = day.details.map((s) => `
    <div style="background:#f8f7f2; border:1px solid #e2dcc4; border-radius:8px; padding:12px; margin-bottom:8px;">
      <div style="font-weight:700; color:#1d2a30;">${escapeHtml(s.name)}</div>
      ${s.notes ? `<div style="color:#6c7a82; font-size:13px; margin-top:4px;">${escapeHtml(s.notes)}</div>` : ""}
    </div>
  `).join("");

  const recoveryHtml = recovery ? `
    <div style="background:${recovery.color}22; border-left:4px solid ${recovery.color}; padding:12px 16px; margin:16px 0; border-radius:4px;">
      <div style="font-weight:700; color:${recovery.color};">Recovery: ${recovery.status === "ready" ? "✓ Ready" : recovery.status === "almost" ? "⏳ Almost" : "🛑 Recovering"}</div>
      <div style="color:#444; font-size:13px; margin-top:4px;">${escapeHtml(recovery.label)}</div>
    </div>
  ` : "";

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1d2a30; background: #ffffff;">
      <div style="text-align:center; margin-bottom:24px;">
        <div style="display:inline-block; width:40px; height:40px; background: linear-gradient(135deg, #f8b6a6, #d68070); border-radius:10px; line-height:40px; color:white; font-weight:bold; font-size:18px;">▲</div>
        <div style="font-weight:800; font-size:18px; margin-top:8px;">RidgeLine</div>
      </div>

      <h1 style="font-size:24px; margin: 0 0 4px;">Good morning, ${escapeHtml(name)}</h1>
      <p style="color:#6c7a82; margin: 0 0 24px;">${dateStr} · Week ${week.week} of ${plan.length} · ${week.phaseName} phase</p>

      <h2 style="font-size:16px; margin: 24px 0 12px;">Today: ${escapeHtml(dayLabel)}</h2>
      ${sessions || `<div style="color:#6c7a82; font-style:italic;">Rest day — hydrate, sleep, mobility.</div>`}

      ${recoveryHtml}

      ${todayCheckin ? "" : `<p style="color:#6c7a82; font-size:13px; margin: 16px 0;">⚪ No check-in today — a quick 30-second one tunes your workout intensity.</p>`}

      <div style="text-align:center; margin: 32px 0;">
        <a href="https://ridgeline-mtb.ca/today" style="display:inline-block; padding:14px 28px; background:#f26838; color:#ffffff; border-radius:10px; text-decoration:none; font-weight:700;">Open today's workout →</a>
      </div>

      <hr style="border:0; border-top:1px solid #eee; margin: 32px 0 16px;" />
      <p style="color:#999; font-size:11px; text-align:center; margin: 0;">
        <a href="https://ridgeline-mtb.ca/profile" style="color:#999;">Manage email preferences</a> ·
        RidgeLine · MTB training, automated.
      </p>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ============================================================
// Coach-prescribed workout notification.
// Sent when a coach adds or updates a workout on a student's plan.
// ============================================================
export async function sendCoachPrescriptionEmail({ student, coach, date, sessionName, workoutBody }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY not set");
  if (!student?.email) throw new Error("Student has no email");

  const coachName = coach?.name || (coach?.email || "").split("@")[0] || "Your coach";
  const studentName = student?.name || (student?.email || "").split("@")[0] || "rider";
  const niceDate = new Date(date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric",
  });
  const subject = `New workout from ${coachName} — ${niceDate}`.slice(0, 80);

  const html = `
    <div style="max-width:560px; margin:0 auto; padding:24px; font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif; color:#1d2a30; background:#fffaf3;">
      <div style="margin-bottom:24px;">
        <div style="display:inline-block; width:40px; height:40px; background: linear-gradient(135deg, #f8b6a6, #d68070); border-radius:10px; line-height:40px; color:white; font-weight:bold; font-size:18px; text-align:center;">▲</div>
        <div style="font-weight:800; font-size:18px; margin-top:8px;">RidgeLine</div>
      </div>

      <h1 style="font-size:22px; margin: 0 0 4px;">${escapeHtml(coachName)} prescribed a workout</h1>
      <p style="color:#6c7a82; margin: 0 0 20px;">For ${escapeHtml(studentName)} · ${escapeHtml(niceDate)}</p>

      <div style="background:#ffffff; border:1px solid #e2dcc4; border-radius:10px; padding:16px; margin-bottom:20px;">
        <div style="font-weight:700; font-size:15px; margin-bottom:8px; color:#1d2a30;">${escapeHtml(sessionName)}</div>
        <div style="color:#333; font-size:13px; line-height:1.55; white-space:pre-wrap;">${escapeHtml(workoutBody || "").slice(0, 1200)}</div>
      </div>

      <div style="text-align:center; margin: 28px 0;">
        <a href="https://ridgeline-mtb.ca/today" style="display:inline-block; padding:14px 28px; background:#f26838; color:#ffffff; border-radius:10px; text-decoration:none; font-weight:700;">Open in RidgeLine →</a>
      </div>

      <hr style="border:0; border-top:1px solid #eee; margin: 28px 0 16px;" />
      <p style="color:#999; font-size:11px; text-align:center; margin: 0;">
        Prescribed by your coach. <a href="https://ridgeline-mtb.ca/profile" style="color:#999;">Manage email preferences</a>.
      </p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from: FROM, to: student.email, subject, html }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error("Resend: " + t);
  }
  return res.json();
}
