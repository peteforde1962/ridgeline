// Fuzzy-match a Strava activity name → trails.
// Pure functions. Pass the activity-name string and the user's trails array.
//
// `matchTrail` returns ONE best trail id (back-compat).
// `matchTrails` returns ALL trails confidently matched (for the multi-trail world).

const STOP_WORDS = new Set([
  "the", "and", "a", "an", "at", "on", "of", "to",
  "morning", "evening", "afternoon", "night", "lunch",
  "ride", "rides", "lap", "laps", "session", "mtb", "bike",
  "easy", "long", "short", "quick", "hard",
]);

function normalize(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^\w\s'-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s) {
  return normalize(s).split(" ").filter((w) => w.length >= 3 && !STOP_WORDS.has(w));
}

// Return ALL trails confidently matched. Used by importers writing to ride_trails.
export function matchTrails(activityName, trails) {
  if (!activityName || !trails || trails.length === 0) return [];
  const name = normalize(activityName);
  if (!name) return [];

  const out = new Set();

  // Tier 1: direct substring match (any trail whose name appears anywhere).
  trails.forEach((t) => {
    const n = normalize(t.name);
    if (n && name.includes(n)) out.add(t.id);
  });

  // Tier 2: token-overlap match (only if no direct hits).
  if (out.size === 0) {
    const activityTokens = new Set(tokens(activityName));
    trails.forEach((t) => {
      const tTokens = tokens(t.name);
      if (tTokens.length === 0) return;
      const hits = tTokens.filter((w) => activityTokens.has(w)).length;
      if (hits / tTokens.length >= 0.5) out.add(t.id);
    });
  }

  return Array.from(out);
}

// Back-compat: return one best (most-specific / longest-name) trail id, or null.
export function matchTrail(activityName, trails) {
  const matches = matchTrails(activityName, trails);
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  // Pick the longest-named trail (most specific).
  const byId = {};
  trails.forEach((t) => { byId[t.id] = t; });
  return matches.sort((a, b) => (byId[b]?.name?.length || 0) - (byId[a]?.name?.length || 0))[0];
}
