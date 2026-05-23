// TrainingPeaks-style training load. Without power meters we estimate TSS
// from duration × intensity tier (easy/moderate/hard/epic).
//
// Definitions:
//   TSS  = Training Stress Score for a single ride
//   CTL  = Chronic Training Load (fitness)  — 42-day exponentially-weighted average
//   ATL  = Acute Training Load (fatigue)    — 7-day exponentially-weighted average
//   TSB  = Training Stress Balance (form)   = CTL − ATL
//     positive TSB = fresh / ready to push
//     near-zero    = balanced
//     negative     = under recovered

function intensityScore(ride) {
  const minutes = ride?.minutes || 0;
  const elev    = ride?.elev_m  || 0;
  const km      = ride?.km      || 0;
  if (minutes >= 180 || elev >= 1000 || km >= 50) return 100; // epic
  if (minutes >= 120 || elev >=  500 || km >= 30) return 80;  // hard
  if (minutes >=  60 || elev >=  200 || km >= 15) return 60;  // moderate
  return 30;                                                   // easy
}

export function tssForRide(ride) {
  const hours = (ride?.minutes || 0) / 60;
  return Math.round(hours * intensityScore(ride));
}

// Build a daily series of TSS, CTL, ATL, TSB for the last `daysBack` days.
export function trainingLoadSeries(rides, daysBack = 60) {
  const tssByDate = {};
  for (const r of (rides || [])) {
    const t = tssForRide(r);
    tssByDate[r.date] = (tssByDate[r.date] || 0) + t;
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
      ctl: Math.round(ctl * 10) / 10,
      atl: Math.round(atl * 10) / 10,
      tsb: Math.round((ctl - atl) * 10) / 10,
    });
  }
  return series;
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
