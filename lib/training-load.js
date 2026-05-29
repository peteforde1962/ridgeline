// TrainingPeaks-style training load.
//
// Definitions:
//   TSS  = Training Stress Score for a single workout (100 = 1 hour at threshold)
//   CTL  = Chronic Training Load (Fitness) — 42-day exponentially-weighted avg of TSS
//   ATL  = Acute Training Load (Fatigue)   — 7-day exponentially-weighted avg of TSS
//   TSB  = Training Stress Balance (Form)  = CTL − ATL
//     positive TSB = fresh / ready to push
//     near-zero    = balanced
//     negative     = under recovered
//
// TSS estimation uses the best signal available per ride, in priority order:
//   1. Power + FTP        — true TSS formula
//   2. HR + LTHR          — hrTSS via Banister TRIMP-like model
//   3. Strava suffer_score — Strava Relative Effort (≈ TSS)
//   4. Duration × intensity tier — crude fallback for manual rides
//
// The chosen method is returned so the UI can show which signal we used.

// --- TSS calculators ---

// Power-based TSS (proper TrainingPeaks formula).
//   TSS = (duration_sec × NP × IF) / (FTP × 3600) × 100
//   where IF = NP / FTP
function powerTSS(ride, ftp) {
  const np = ride.weighted_avg_watts || ride.avg_watts;
  if (!np || !ftp || !ride.minutes) return null;
  const durSec = ride.minutes * 60;
  const intensityFactor = np / ftp;
  const tss = (durSec * np * intensityFactor) / (ftp * 3600) * 100;
  return Math.round(tss);
}

// Heart-rate TSS — TRIMP-style. Simplification:
//   1) compute hrRatio = avg_hr / lthr
//   2) intensity factor ≈ hrRatio^0.85 (gives ~0.7 at endurance pace, ~1.0 at threshold)
//   3) tss = hours × IF^2 × 100
// Not as accurate as power but consistent across rides.
function hrTSS(ride, lthr) {
  if (!ride.avg_hr || !lthr || !ride.minutes) return null;
  const hrRatio = ride.avg_hr / lthr;
  const intensityFactor = Math.pow(hrRatio, 0.85);
  const hours = ride.minutes / 60;
  return Math.round(hours * intensityFactor * intensityFactor * 100);
}

// Strava Relative Effort scales 1:1-ish with TSS for similar durations.
// We use it directly as a TSS proxy.
function sufferTSS(ride) {
  return ride.suffer_score != null ? ride.suffer_score : null;
}

// Crude duration × intensity tier fallback (the previous behavior).
function tierTSS(ride) {
  const minutes = ride?.minutes || 0;
  const elev    = ride?.elev_m  || 0;
  const km      = ride?.km      || 0;
  let score;
  if (minutes >= 180 || elev >= 1000 || km >= 50) score = 100; // epic
  else if (minutes >= 120 || elev >=  500 || km >= 30) score = 80;  // hard
  else if (minutes >=  60 || elev >=  200 || km >= 15) score = 60;  // moderate
  else score = 30;                                                  // easy
  const hours = minutes / 60;
  return Math.round(hours * score);
}

// Returns { tss, method } — method is one of 'power', 'hr', 'strava', 'tier'.
export function tssForRide(ride, profile) {
  const ftp  = profile?.ftp;
  const lthr = profile?.lthr;

  const p = powerTSS(ride, ftp);
  if (p != null) return { tss: p, method: "power" };

  const h = hrTSS(ride, lthr);
  if (h != null) return { tss: h, method: "hr" };

  const s = sufferTSS(ride);
  if (s != null) return { tss: s, method: "strava" };

  return { tss: tierTSS(ride), method: "tier" };
}

// --- series builder ---

// Build a daily series of TSS, CTL, ATL, TSB for the last `daysBack` days.
// rides: list of ride rows; profile: optional, for FTP/LTHR.
export function trainingLoadSeries(rides, daysBack = 90, profile = null) {
  const tssByDate = {};
  const methodByDate = {};
  for (const r of (rides || [])) {
    const { tss, method } = tssForRide(r, profile);
    tssByDate[r.date] = (tssByDate[r.date] || 0) + tss;
    // Track the "best" method per day in priority order so the UI can summarize.
    const prev = methodByDate[r.date];
    methodByDate[r.date] = methodPriority(method, prev);
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const series = [];
  let ctl = 0, atl = 0;
  const ctlAlpha = 1 - Math.exp(-1 / 42);
  const atlAlpha = 1 - Math.exp(-1 / 7);

  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    const tss = tssByDate[ds] || 0;
    ctl = ctl + (tss - ctl) * ctlAlpha;
    atl = atl + (tss - atl) * atlAlpha;
    series.push({
      date: ds,
      tss,
      method: methodByDate[ds] || null,
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round((ctl - atl) * 10) / 10,
    });
  }
  return series;
}

function methodPriority(next, prev) {
  const rank = { power: 4, hr: 3, strava: 2, tier: 1 };
  if (!prev) return next;
  return rank[next] >= rank[prev] ? next : prev;
}

// Project the series N days into the future assuming zero training.
// Helpful to show "if I rest a week, here's where my form will be."
export function projectForward(series, daysAhead = 14) {
  const last = series[series.length - 1];
  if (!last) return [];
  let ctl = last.ctl, atl = last.atl;
  const ctlAlpha = 1 - Math.exp(-1 / 42);
  const atlAlpha = 1 - Math.exp(-1 / 7);
  const out = [];
  const day0 = new Date(last.date);
  for (let i = 1; i <= daysAhead; i++) {
    ctl = ctl + (0 - ctl) * ctlAlpha;
    atl = atl + (0 - atl) * atlAlpha;
    const d = new Date(day0);
    d.setDate(d.getDate() + i);
    out.push({
      date: d.toISOString().slice(0, 10),
      tss: 0,
      projected: true,
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round((ctl - atl) * 10) / 10,
    });
  }
  return out;
}

export function currentLoad(series) {
  const last = series?.[series.length - 1];
  if (!last) return { fitness: 0, fatigue: 0, form: 0 };
  return { fitness: last.ctl, fatigue: last.atl, form: last.tsb };
}

// Interpret TSB → readable label + color.
export function formInterpretation(tsb) {
  if (tsb >  20) return { label: "Too fresh — losing fitness?", color: "#5fa7c4" };
  if (tsb >   5) return { label: "Fresh — race ready",           color: "#5cb85c" };
  if (tsb >  -5) return { label: "Balanced",                     color: "var(--accent)" };
  if (tsb > -20) return { label: "Loading — fatigued",           color: "#f0ad4e" };
  return                  { label: "Heavily fatigued — recover",  color: "#d9534f" };
}

// Human-readable name for the TSS estimation method.
export function methodLabel(m) {
  switch (m) {
    case "power":  return "Power + FTP";
    case "hr":     return "HR + LTHR";
    case "strava": return "Strava Relative Effort";
    case "tier":   return "Duration estimate";
    default:       return "—";
  }
}
