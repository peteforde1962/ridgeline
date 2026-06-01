// POST /api/admin/backfill-trail-geometry
//
// Smart batching: groups trails missing geometry by anchor location (region
// centroid → ride start → polyline first point), then processes ONE anchor per
// call — one OSM Overpass query, then in-memory name matching for every trail
// in that group. Slow trails no longer multiply against the 60s timeout.
//
// Body (optional): { skipAnchorKeys?: ["49.70,-123.16", ...] }
//   Anchor keys the client has already tried and that returned 0 matches; we
//   skip them so we keep making progress.

import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { fetchOsmTrails, REGIONS } from "@/lib/osm-trails";
import { decodePolyline } from "@/lib/polyline-decode";

export const runtime = "nodejs";
export const maxDuration = 60;

const SEARCH_RADIUS_KM = 15;

// Look up centroid for a stored region label like "Squamish, BC".
function regionCentroid(regionLabel) {
  if (!regionLabel) return null;
  const lc = regionLabel.toLowerCase();
  const hit = REGIONS.find((r) =>
    r.label.toLowerCase() === lc || r.id === lc || lc.includes(r.id)
  );
  return hit ? { lat: hit.lat, lon: hit.lon } : null;
}

function firstPolylinePoint(polylineStr) {
  if (!polylineStr) return null;
  try {
    const pts = decodePolyline(polylineStr);
    return pts?.[0] ? { lat: pts[0].lat, lon: pts[0].lon } : null;
  } catch {
    return null;
  }
}

function anchorKey(a) {
  if (!a) return null;
  return `${a.lat.toFixed(2)},${a.lon.toFixed(2)}`;
}

export async function POST(request) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });

    const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
    if (!me?.is_admin) return Response.json({ error: "Admins only" }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const skipAnchorKeys = new Set(body.skipAnchorKeys || []);

    const admin = adminClient();

    // Pull EVERY trail missing geometry — usually a few hundred, cheap to load.
    const { data: trails } = await admin.from("trails")
      .select("id, name, region")
      .is("geometry", null)
      .order("region", { ascending: true });

    const totalMissing = trails?.length || 0;
    if (totalMissing === 0) {
      return Response.json({ ok: true, done: true, remaining: 0, message: "All trails already have geometry." });
    }

    // ----- Group trails by anchor -----
    // First, anchor by region centroid (the cheap path — no per-trail DB hits).
    const groups = new Map(); // key -> { anchor, trails: [...] }
    const needRideLookup = [];
    let noAnchor = 0;

    for (const t of trails) {
      const anchor = regionCentroid(t.region);
      if (anchor) {
        const key = anchorKey(anchor);
        if (!groups.has(key)) groups.set(key, { anchor, trails: [] });
        groups.get(key).trails.push(t);
      } else {
        needRideLookup.push(t);
      }
    }

    // For trails without a region centroid, find one ride's anchor each.
    for (const t of needRideLookup) {
      const { data: rideLink } = await admin
        .from("ride_trails")
        .select("rides!inner(start_lat, start_lon, polyline)")
        .eq("trail_id", t.id)
        .limit(1)
        .maybeSingle();
      const r = rideLink?.rides;
      let anchor = null;
      if (r?.start_lat != null && r?.start_lon != null) {
        anchor = { lat: r.start_lat, lon: r.start_lon };
      } else if (r?.polyline) {
        anchor = firstPolylinePoint(r.polyline);
      }
      if (anchor) {
        const key = anchorKey(anchor);
        if (!groups.has(key)) groups.set(key, { anchor, trails: [] });
        groups.get(key).trails.push(t);
      } else {
        noAnchor++;
      }
    }

    // ----- Pick the next un-skipped group to process -----
    const candidate = [...groups.entries()].find(([key]) => !skipAnchorKeys.has(key));
    if (!candidate) {
      return Response.json({
        ok: true, done: true,
        remaining: totalMissing - noAnchor,
        no_anchor: noAnchor,
        message: "No more anchor groups to try.",
      });
    }
    const [groupKey, group] = candidate;

    // ----- One Overpass query for the whole group -----
    let osmTrails = [];
    let osmError = null;
    try {
      osmTrails = await fetchOsmTrails({
        lat: group.anchor.lat, lon: group.anchor.lon, radiusKm: SEARCH_RADIUS_KM,
      });
    } catch (e) {
      osmError = e.message;
    }

    // Index OSM results by lowercased name for O(1) match per trail.
    const byName = new Map();
    for (const o of osmTrails || []) {
      if (o?.name && o.geometry?.length >= 2) {
        byName.set(o.name.toLowerCase().trim(), o);
      }
    }

    // ----- Match every trail in this group, update in parallel -----
    let filled = 0, noMatch = 0;
    const updates = [];
    for (const t of group.trails) {
      const match = byName.get(t.name.toLowerCase().trim());
      if (!match) { noMatch++; continue; }
      updates.push(
        admin.from("trails").update({ geometry: match.geometry }).eq("id", t.id)
      );
      filled++;
    }
    await Promise.all(updates);

    const remaining = totalMissing - filled;
    return Response.json({
      ok: true,
      groupKey,
      group_label: group.trails[0]?.region || `near ${groupKey}`,
      group_size: group.trails.length,
      filled,
      no_match_in_group: noMatch,
      osm_returned: byName.size,
      osm_error: osmError,
      no_anchor_overall: noAnchor,
      remaining,
      remaining_groups: [...groups.entries()].filter(([k]) => !skipAnchorKeys.has(k) && k !== groupKey).length,
      done: false,
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
