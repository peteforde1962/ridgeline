// POST /api/coaching/prescribe
// Coach creates (or updates) a workout on a student's plan. The workout
// appears as an "extra" plan_session for that date. Student gets an email.

import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { buildPlan, rideToPlanIndex } from "@/lib/plan";
import { sendCoachPrescriptionEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

    const { studentId, date, type, name, body, notifyStudent = true } = await request.json();
    if (!studentId || !date || !type || !name || !body) {
      return Response.json({ error: "Missing fields" }, { status: 400 });
    }

    // Verify the caller is a coach + owns this student (via admin to avoid RLS gymnastics).
    const admin = adminClient();
    const { data: me } = await admin.from("profiles").select("*").eq("id", user.id).single();
    if (me?.role !== "coach" || !me?.coach_approved) {
      return Response.json({ error: "Not an approved coach" }, { status: 403 });
    }
    const { data: student } = await admin.from("profiles").select("*").eq("id", studentId).single();
    if (!student || student.coach_id !== user.id) {
      return Response.json({ error: "Not your student" }, { status: 403 });
    }

    // Map the chosen date to plan coordinates so it shows up on the right plan day.
    const plan = buildPlan(student);
    const idx = rideToPlanIndex(student.started_at, date, plan.length);
    if (!idx) {
      return Response.json({ error: "Date is outside this student's plan window" }, { status: 400 });
    }

    // Use an "extra" session slot so we don't clobber the template. session_idx=100..120
    // matches the convention used by the Strava auto-tick / day-extras code.
    // Find first free extras slot for that day.
    const { data: existingExtras } = await admin.from("plan_sessions")
      .select("session_idx")
      .eq("user_id", studentId)
      .eq("week_index", idx.weekIndex).eq("day_index", idx.dayIndex)
      .gte("session_idx", 100);
    const usedIdxs = new Set((existingExtras || []).map((e) => e.session_idx));
    let slot = 100;
    while (usedIdxs.has(slot) && slot < 130) slot++;

    const row = {
      user_id: studentId,
      week_index: idx.weekIndex,
      day_index:  idx.dayIndex,
      session_idx: slot,
      is_extra: true,
      swapped_to: type,
      custom_name: name,
      ai_workout: body,
      prescribed_by_coach_id: user.id,
      prescribed_at: new Date().toISOString(),
      completed: false,
      tweak: "standard",
    };

    const { error: insErr } = await admin.from("plan_sessions").upsert(row, {
      onConflict: "user_id,week_index,day_index,session_idx",
    });
    if (insErr) return Response.json({ error: insErr.message }, { status: 500 });

    // Notify the student.
    let emailResult = null;
    if (notifyStudent && student.email) {
      try {
        emailResult = await sendCoachPrescriptionEmail({
          student, coach: me, date,
          sessionName: name,
          workoutBody: body,
        });
      } catch (e) {
        emailResult = { error: e.message };
      }
    }

    return Response.json({ ok: true, slot, week: idx.weekIndex, day: idx.dayIndex, email: emailResult });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
