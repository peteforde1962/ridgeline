// Fuzzy-match a Strava activity name → a saved trail.
// Pure function, no DB. Pass in the activity name string and the user's trails array.
//
// Strategy (tiers):
//   1. Exact case-insensitive substring match (longest trail name wins).
//   2. Token overlap — at least 50% of the trail's word-tokens appear in the
//      activity, ignoring tiny words. Highest overlap wins.
// Returns the matched trail id, or null if no confident match.

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

export function matchTrail(activityName, trails) {
  if (!activityName || !trails || trails.length === 0) return null;

  const name = normalize(activityName);
  if (!name) return null;

  // Tier 1: direct substring match. Longest trail wins (most specific).
  const directHits = trails
    .map((t) => ({ t, n: normalize(t.name) }))
    .filter((x) => x.n && name.includes(x.n));
  if (directHits.length > 0) {
    directHits.sort((a, b) => b.n.length - a.n.length);
    return directHits[0].t.id;
  }

  // Tier 2: token overlap.
  const activityTokens = new Set(tokens(activityName));
  let best = null;
  let bestScore = 0;
  for (const t of trails) {
    const trailTokens = tokens(t.name);
    if (trailTokens.length === 0) continue;
    const hits = trailTokens.filter((w) => activityTokens.has(w)).length;
    const score = hits / trailTokens.length;
    if (score >= 0.5 && score > bestScore) {
      bestScore = score;
      best = t.id;
    }
  }
  return best;
}
