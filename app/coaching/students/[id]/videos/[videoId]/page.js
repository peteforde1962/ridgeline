// /coaching/students/[id]/videos/[videoId] — coach's video coaching surface.
// Renders pose overlay + timestamped comments.

export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import PageHeader from "@/components/PageHeader";
import VideoCoachingClient from "@/components/VideoCoachingClient";

export default async function CoachVideoPage({ params }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: me } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (me?.role !== "coach") redirect("/profile");

  // RLS allows coaches to read student videos.
  const { data: video } = await supabase.from("videos")
    .select("*").eq("id", params.videoId).maybeSingle();
  if (!video || video.user_id !== params.id) notFound();

  // Use the admin client to bypass storage RLS — the page already verified
  // the viewer is a coach who owns this student.
  let src = null;
  let srcError = null;
  if (video.kind === "upload") {
    const { data: signed, error } = await adminClient().storage
      .from("videos").createSignedUrl(video.url, 3600);
    src = signed?.signedUrl || null;
    srcError = error?.message || (!src ? "Could not generate signed URL" : null);
  } else {
    src = video.url;
  }

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <PageHeader />
      <a href={`/coaching/students/${params.id}`} className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
        ← Back to student
      </a>
      <h1 className="text-2xl font-extrabold mt-2 mb-1">{video.name}</h1>
      <p className="text-[var(--muted)] text-sm mb-5">
        {video.type} · {video.date}
      </p>

      {srcError && (
        <div className="card mb-4 text-sm" style={{ borderColor: "rgba(232,114,98,.5)" }}>
          ⚠ {srcError}
        </div>
      )}

      <VideoCoachingClient
        videoId={video.id}
        userId={user.id}
        src={src}
        kind={video.kind}
      />
    </main>
  );
}
