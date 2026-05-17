// GET /api/trails/discover?region=squamish
// Fetches top cycling segments near a region using the user's Strava OAuth.

import { createClient } from "@/lib/supabase/server";
import { fetchSegmentsNear, getRegion, getStravaAccessToken } from "@/lib/segments";

export async function GET(request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const url = new URL(request.url);
  const regionId = url.searchParams.get("region");
  const region = regionId ? getRegion(regionId) : null;

  let coords;
  if (region) {
    coords = { lat: region.lat, lon: region.lon };
  } else {
    const lat = url.searchParams.get("lat");
    const lon = url.searchParams.get("lon");
    if (!lat || !lon) return Response.json({ error: "Provide region or lat+lon" }, { status: 400 });
    coords = { lat: +lat, lon: +lon };
  }

  try {
    const accessToken = await getStravaAccessToken(supabase, user.id);
    const segments = await fetchSegmentsNear({
      lat: coords.lat,
      lon: coords.lon,
      accessToken,
    });
    return Response.json({ segments, regionLabel: region?.label || null });
  } catch (e) {
    if (e.code === "strava-not-connected") {
      return Response.json({ error: "strava-not-connected" }, { status: 403 });
    }
    return Response.json({ error: e.message }, { status: 502 });
  }
}
