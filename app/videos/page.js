// /videos — upload ride POVs / form checks / tutorials, or paste YouTube/Vimeo links.
// For uploaded files, this server component generates signed URLs (1-hour expiry).

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PageHeader from "@/components/PageHeader";
import VideoForm from "@/components/VideoForm";
import VideoCard from "@/components/VideoCard";

export default async function VideosPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: videos } = await supabase
    .from("videos")
    .select("*")
    .eq("user_id", user.id)
    .order("date", { ascending: false });

  // Generate 1-hour signed URLs for uploaded files (skip YouTube/Vimeo links).
  const uploads = (videos || []).filter(v => v.kind === "upload");
  const signedMap = {};
  if (uploads.length > 0) {
    const { data: signed } = await supabase.storage
      .from("videos")
      .createSignedUrls(uploads.map(v => v.url), 3600);
    (signed || []).forEach((s, i) => {
      signedMap[uploads[i].id] = s.signedUrl;
    });
  }

  // Group by type for the section headings.
  const groups = {};
  (videos || []).forEach((v) => {
    const k = v.type || "Other";
    groups[k] = groups[k] || [];
    groups[k].push(v);
  });
  const TYPE_ORDER = ["Ride POV", "Form check", "Tutorial", "Race", "Other"];

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <PageHeader />
      <h1 className="text-3xl font-extrabold mb-1">Videos</h1>
      <p className="text-[var(--muted)] mb-6">
        Ride POV · form check · technique reference. Upload or paste a link, tag it, take notes with timestamps.
      </p>

      <section className="mb-6">
        <VideoForm userId={user.id} />
      </section>

      {(!videos || videos.length === 0) ? (
        <div className="card text-center">
          <p className="text-[var(--muted)]">
            No videos yet. Add your first one above.
          </p>
        </div>
      ) : (
        TYPE_ORDER.filter((t) => groups[t]).map((t) => (
          <section key={t} className="mb-6">
            <h2 className="text-lg font-bold mb-3">{t}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groups[t].map((v) => (
                <VideoCard key={v.id} video={v} signedSrc={signedMap[v.id]} />
              ))}
            </div>
          </section>
        ))
      )}
    </main>
  );
}
