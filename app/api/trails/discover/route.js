// GET /api/trails/discover?region=squamish&radiusKm=25
// Fetches MTB trails from OpenStreetMap (free, no auth).

import { createClient } from "@/lib/supabase/server";
import { fetchOsmTrails, getRegion } from "@/lib/osm-trails";

// Allow this route to run up to 60s (default is 10s on Vercel Hobby).
// On Hobby tier the upper bound is 60s — anything beyond requires Pro.
export const maxDuration = 60;

export async function GET(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const url = new URL(request.url);
  const regionId = url.searchParams.get("region");
  const region = regionId ? getRegion(regionId) : null;
  const radiusKm = +url.searchParams.get("radiusKm") || 25;

  let coords, regionLabel = null;
  if (region) {
    coords = { lat: region.lat, lon: region.lon };
    regionLabel = region.label;
  } else {
    const lat = url.searchParams.get("lat");
    const lon = url.searchParams.get("lon");
    if (!lat || !lon) return Response.json({ error: "Provide region or lat+lon" }, { status: 400 });
    coords = { lat: +lat, lon: +lon };
  }

  try {
    const trails = await fetchOsmTrails({ ...coords, radiusKm });
    return Response.json({ trails, regionLabel });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}
