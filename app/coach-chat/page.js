// /coach-chat — student-facing view of the coach ↔ student chat.
// Only useful when the current user has a coach linked (profiles.coach_id).
// If no coach is linked, show a friendly "you're not linked to a coach yet" state.

export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";
import CoachStudentChat from "@/components/CoachStudentChat";

export default async function CoachChatPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Load the student's own profile so we know who their coach is.
  const { data: profile } = await supabase
    .from("profiles").select("id, name, email, coach_id").eq("id", user.id).single();

  // Load the coach profile so we can label the chat with their name.
  let coach = null;
  if (profile?.coach_id) {
    const { data } = await supabase
      .from("profiles").select("id, name, email").eq("id", profile.coach_id).single();
    coach = data;
  }

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <PageHeader />
      <h1 className="text-3xl font-extrabold mb-1">Coach chat</h1>
      <p className="text-[var(--muted)] mb-6">
        Direct line to your coach. They see the same thread on their side.
      </p>

      {!profile?.coach_id ? (
        <div className="card text-center" style={{ padding: 28 }}>
          <h2 className="text-lg font-bold mb-2">You don't have a coach yet</h2>
          <p className="text-sm text-[var(--muted)] mb-4">
            Ask your coach for their 6-character code and enter it on your Profile page to link up.
          </p>
          <a href="/profile" className="btn-primary text-sm">Enter coach code →</a>
        </div>
      ) : (
        <CoachStudentChat
          coachId={profile.coach_id}
          studentId={profile.id}
          currentUserId={user.id}
          otherPartyName={coach?.name || coach?.email?.split("@")[0] || "your coach"}
        />
      )}
    </main>
  );
}
