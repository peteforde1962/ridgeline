// /trails/discover — global trail discovery via OpenStreetMap.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { REGIONS } from "@/lib/osm-trails";
import TrailDiscover from "@/components/TrailDiscover";
import PageHeader from "@/components/PageHeader";

export default async function TrailDiscoverPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen p-6 max-w-4xl mx-auto">
      <PageHeader back="/trails" />
      <h1 className="text-3xl font-extrabold mb-1">Discover trails</h1>
      <p className="text-[var(--muted)] mb-6">
        MTB trail data from OpenStreetMap — global, free, the same source Trailforks built on.
      </p>

      <TrailDiscover regions={REGIONS} />
    </main>
  );
}
