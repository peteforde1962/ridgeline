// /videos/[id] — student's own video detail with pose overlay + comments.
// Same surface coaches see, minus the student-overview chrome.

export const dynamic = "force-dynamic";

import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";
import VideoCoachingClient from "@/components/VideoCoachingClient";

export default async function VideoDetail({ params }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: video } = await supabase.from("videos")
    .select("*").eq("id", params.id).maybeSingle();
  if (!video) notFound();

  let src = null;
  if (video.kind === "upload") {
    const { data: signed } = await supabase.storage.from("videos")
      .createSignedUrl(video.url, 3600);
    src = signed?.signedUrl || null;
  } else {
    src = video.url;
  }

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <PageHeader />
      <a href="/videos" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">← All videos</a>
      <h1 className="text-2xl font-extrabold mt-2 mb-1">{video.name}</h1>
      <p className="text-[var(--muted)] text-sm mb-5">{video.type} · {video.date}</p>

      <VideoCoachingClient
        videoId={video.id}
        userId={user.id}
        src={src}
        kind={video.kind}
      />
    </main>
  );
}
