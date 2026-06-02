"use client";

// Glassy elevation profile + gradient graph for a trail.
//
// Until we wire real DEM-sampled elevation per waypoint, the curve is generated
// procedurally from the trail's length_km and elev_m so it varies trail-to-trail
// (deterministic by trail id) and visually reads as a realistic profile.
// The PATH is colored by local gradient (steepness) so you can see the climbs
// and descents at a glance — peach for climbs, teal for descents.

import { useEffect, useMemo, useRef, useState } from "react";

const NUM_POINTS = 100;

// Deterministic pseudo-random (mulberry32) seeded by the trail id.
function seededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0xffffffff;
  };
}

function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < (str || "").length; i++) {
    h = (h ^ str.charCodeAt(i)) * 16777619 >>> 0;
  }
  return h || 1;
}

// Generate a realistic-looking profile of length lengthKm with total climb elevM.
//
// Approach: sum a small number of smooth Gaussian bumps (each a climb or
// descent feature), then SCALE the whole curve so the sum of positive deltas
// matches the trail's stated elev gain. That way the displayed total climb is
// faithful to elev_m and gradients stay in a realistic 0–25% range for normal
// trails rather than spiking through wild high-frequency harmonics.
function generateProfile(lengthKm, elevM, seedStr) {
  const rand = seededRand(hashSeed(seedStr || "trail"));

  // Number of climb/descent features grows with length.
  const numFeatures = Math.max(2, Math.min(6, Math.round(lengthKm * 1.2)));

  // Place each feature: smooth Gaussian bump with center, width, amplitude.
  // Amplitudes are unit-less here — we scale to elev_m below.
  const features = [];
  for (let i = 0; i < numFeatures; i++) {
    const center = (i + 0.5 + (rand() - 0.5) * 0.5) / numFeatures;       // ~spread across 0..1
    const width  = 0.18 + rand() * 0.18;                                  // bump width
    const amp    = (rand() < 0.6 ? 1 : -1) * (0.5 + rand() * 0.7);        // climb-biased mix
    features.push({ center, width, amp });
  }

  // Render the raw curve.
  const points = [];
  for (let i = 0; i < NUM_POINTS; i++) {
    const t = i / (NUM_POINTS - 1);
    let y = 0;
    for (const f of features) {
      const d = (t - f.center) / f.width;
      y += f.amp * Math.exp(-d * d * 1.4);     // Gaussian-like
    }
    points.push({ x: t * lengthKm, y_raw: y });
  }

  // Total raw climb (sum of positive deltas).
  let rawClimb = 0;
  for (let i = 1; i < points.length; i++) {
    const d = points[i].y_raw - points[i - 1].y_raw;
    if (d > 0) rawClimb += d;
  }

  // Scale the entire profile so total climb = elev_m. If elev_m isn't known,
  // default to a modest 30 m/km (typical XC pace).
  const targetClimb = elevM && elevM > 0 ? elevM : Math.max(20, lengthKm * 30);
  const scale = rawClimb > 0 ? targetClimb / rawClimb : 1;

  // Apply scale + shift so the curve starts at 0 (visual baseline).
  let minY = Infinity;
  for (const p of points) {
    p.y = p.y_raw * scale;
    if (p.y < minY) minY = p.y;
  }
  for (const p of points) p.y -= minY;

  // Local gradient (%) between adjacent points.
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const dxM = (next.x - prev.x) * 1000;
    const dyM = next.y - prev.y;
    points[i].gradient = dxM > 0 ? (dyM / dxM) * 100 : 0;
  }

  // Final stats (post-scaling — total climb here equals targetClimb).
  let totalClimb = 0, totalDescent = 0, maxGradient = 0, minGradient = 0;
  for (let i = 1; i < points.length; i++) {
    const d = points[i].y - points[i - 1].y;
    if (d > 0) totalClimb += d;
    else totalDescent += -d;
    if (points[i].gradient > maxGradient) maxGradient = points[i].gradient;
    if (points[i].gradient < minGradient) minGradient = points[i].gradient;
  }
  return { points, totalClimb, totalDescent, maxGradient, minGradient };
}

// Color for a given gradient % (smooth lerp between brand colors).
function gradientColor(pct) {
  // <-10% deep teal, -5 to -10 teal, -5 to 0 blue, 0 to 5 light peach,
  // 5 to 10 peach, >10 coral. Smoothly interpolate.
  if (pct >= 10)   return "#e87262";  // steep climb
  if (pct >= 5)    return "#f8b6a6";  // peach
  if (pct >= 0)    return "#fccabb";  // light peach
  if (pct >= -5)   return "#a7bcc4";  // muted teal
  if (pct >= -10)  return "#5fa7c4";  // teal
  return                  "#3d7a93";  // steep descent
}

// Estimate a plausible elev gain when the trail row has no elev_m. Uses
// length + difficulty + a seeded variance so every trail looks distinct rather
// than all defaulting to 50m.
function estimateElev(lengthKm, difficulty, seedStr) {
  if (!lengthKm || lengthKm <= 0) return 50;
  // Base meters-per-km by difficulty (rough MTB-typical):
  //   Green: ~15  Blue: ~30  Black: ~55  Double Black: ~75
  const baseByDiff = {
    "Green":        15,
    "Blue":         30,
    "Black":        55,
    "Double Black": 75,
  };
  const base = baseByDiff[difficulty] || 35;
  // Seed-based variance ±50% so different trails of the same length don't look identical.
  const rand = seededRand(hashSeed(seedStr || "trail"));
  const variance = 0.5 + rand() * 1.0;        // 0.5x to 1.5x
  return Math.round(base * lengthKm * variance);
}

export default function TrailProfileGraph({ trailId, name, lengthKm, elevM, difficulty }) {
  const [revealed, setRevealed] = useState(false);
  const [realProfile, setRealProfile] = useState(null);   // { samples, total_climb, total_descent }
  const [fetching, setFetching] = useState(true);
  const [source, setSource] = useState("estimated");      // 'real' | 'estimated' | 'no-geometry'
  const pathRef = useRef(null);

  // Bail out cleanly if we don't have enough data.
  if (!lengthKm || lengthKm <= 0) {
    return null;
  }
  // Prefer the trail's stated elev_m; else estimate from length + difficulty
  // + a per-trail seed so every trail looks different (no more 50m everywhere).
  const elev = (elevM != null && elevM > 0)
    ? elevM
    : estimateElev(lengthKm, difficulty, trailId || name);

  // Procedural fallback profile.
  const proc = useMemo(
    () => generateProfile(lengthKm, elev, trailId || name),
    [trailId, name, lengthKm, elev]
  );

  // Try to fetch the real elevation profile (sampled DEM).
  useEffect(() => {
    let cancelled = false;
    setFetching(true);
    (async () => {
      try {
        const res = await fetch(`/api/trails/${trailId}/elevation`);
        const data = await res.json();
        if (cancelled) return;
        if (data?.profile?.samples?.length > 1) {
          setRealProfile(data.profile);
          setSource("real");
        } else {
          setSource("estimated");
        }
      } catch {
        if (!cancelled) setSource("estimated");
      }
      if (!cancelled) setFetching(false);
    })();
    return () => { cancelled = true; };
  }, [trailId]);

  // Choose which profile to render — real if available, else procedural.
  const { points, totalClimb, totalDescent, maxGradient, minGradient } = useMemo(() => {
    if (realProfile?.samples?.length > 1) {
      // Convert real samples to point shape, computing gradient over a
      // sliding ~25m WINDOW rather than adjacent points. Adjacent-point
      // gradient on 1Hz GPS data spikes wildly even on flat ground because
      // points might be 4-5m apart and altitude noise of 1m → 20% spike.
      const arr = realProfile.samples;
      const WINDOW_M = 25;
      const pts = arr.map((s, i) => {
        // Find left/right indices roughly 25m on either side by KM.
        const targetLeft  = s.km - WINDOW_M / 1000;
        const targetRight = s.km + WINDOW_M / 1000;
        let lo = i, hi = i;
        while (lo > 0 && arr[lo - 1].km >= targetLeft)  lo--;
        while (hi < arr.length - 1 && arr[hi + 1].km <= targetRight) hi++;
        const dxM = (arr[hi].km - arr[lo].km) * 1000;
        const dyM = arr[hi].elev - arr[lo].elev;
        let grad = dxM > 0 ? (dyM / dxM) * 100 : 0;
        // Clamp obvious GPS-noise spikes (real MTB grades cap around 40%).
        if (grad >  40) grad =  40;
        if (grad < -40) grad = -40;
        return { x: s.km, y: s.elev, gradient: grad };
      });
      // Shift so minimum elevation is 0 for cleaner visual.
      const baseY = Math.min(...pts.map((p) => p.y));
      for (const p of pts) p.y -= baseY;
      let mx = 0, mn = 0;
      for (const p of pts) {
        if (p.gradient > mx) mx = p.gradient;
        if (p.gradient < mn) mn = p.gradient;
      }
      return {
        points: pts,
        totalClimb: realProfile.total_climb,
        totalDescent: realProfile.total_descent,
        maxGradient: mx,
        minGradient: mn,
      };
    }
    return proc;
  }, [realProfile, proc]);

  // Stroke-dashoffset reveal animation on mount AND when source changes (real arrives).
  useEffect(() => {
    const p = pathRef.current;
    if (!p) return;
    const len = p.getTotalLength();
    p.style.strokeDasharray = len;
    p.style.strokeDashoffset = len;
    p.getBoundingClientRect();  // force layout
    p.style.transition = "stroke-dashoffset 1.4s cubic-bezier(0.45, 0, 0.15, 1)";
    p.style.strokeDashoffset = "0";
    setRevealed(true);
  }, [trailId, lengthKm, elev, source]);

  // SVG layout.
  const W = 720, H = 240, padL = 40, padR = 16, padT = 18, padB = 30;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const yMin = Math.min(...points.map(p => p.y));
  const yMax = Math.max(...points.map(p => p.y));
  const xFor = (km) => padL + (km / lengthKm) * innerW;
  const yFor = (m)  => padT + (1 - (m - yMin) / (yMax - yMin || 1)) * innerH;

  // Build the path as a series of line segments (we'll color each segment by
  // its gradient via SVG <path> stroke + gradient stops — using a multi-segment
  // colored stroke that approximates the gradient). For simplicity we render
  // the curve once with a gradient defined along its length.
  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xFor(p.x).toFixed(2)},${yFor(p.y).toFixed(2)}`)
    .join(" ");
  const fillD = `${pathD} L${xFor(lengthKm).toFixed(2)},${yFor(yMin).toFixed(2)} L${xFor(0).toFixed(2)},${yFor(yMin).toFixed(2)} Z`;

  // Per-point colors to build a linearGradient along the path's bounding box —
  // works well because the path is monotonic in x.
  const stops = points.map((p, i) => {
    const offset = (i / (points.length - 1)) * 100;
    return { offset, color: gradientColor(p.gradient) };
  });

  // x-axis km ticks
  const xTickStep = lengthKm > 8 ? 2 : lengthKm > 3 ? 1 : 0.5;
  const xTicks = [];
  for (let k = 0; k <= lengthKm + 0.001; k += xTickStep) xTicks.push(+k.toFixed(1));

  return (
    <div className="trail-profile-glass" data-revealed={revealed ? "true" : "false"}>
      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2 px-1">
        <h2 className="text-sm font-bold uppercase tracking-wide text-[var(--muted)]">
          Trail profile · <span className="font-normal normal-case text-[10px]">
            {fetching ? "loading DEM…" : source === "real" ? "from SRTM DEM" : "estimated shape"}
          </span>
        </h2>
        <div className="text-[10px] text-[var(--muted)]">
          color = local gradient %
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio="xMidYMid meet"
           style={{ display: "block" }}>
        <defs>
          {/* Per-position color gradient along the curve */}
          <linearGradient id={`tpg-stroke-${trailId}`} x1="0" y1="0" x2="1" y2="0">
            {stops.map((s, i) => (
              <stop key={i} offset={`${s.offset}%`} stopColor={s.color} />
            ))}
          </linearGradient>
          {/* Vertical fill gradient under the curve */}
          <linearGradient id={`tpg-fill-${trailId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#f8b6a6" stopOpacity="0.55" />
            <stop offset="50%"  stopColor="#f8b6a6" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#f8b6a6" stopOpacity="0.00" />
          </linearGradient>
          {/* Glow filter for the stroke */}
          <filter id={`tpg-glow-${trailId}`} x="-10%" y="-30%" width="120%" height="160%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Y-axis ticks (just 2) */}
        <text x={padL - 6} y={yFor(yMax) + 3} textAnchor="end" fontSize="9" fill="var(--muted)">
          {Math.round(yMax)}m
        </text>
        <text x={padL - 6} y={yFor(yMin) + 3} textAnchor="end" fontSize="9" fill="var(--muted)">
          {Math.round(yMin)}m
        </text>
        {/* X-axis km ticks */}
        {xTicks.map((k, i) => (
          <g key={i}>
            <line x1={xFor(k)} y1={H - padB} x2={xFor(k)} y2={H - padB + 4} stroke="var(--muted)" strokeWidth="0.6" />
            <text x={xFor(k)} y={H - 10} textAnchor="middle" fontSize="9" fill="var(--muted)">
              {k}km
            </text>
          </g>
        ))}
        {/* baseline */}
        <line x1={padL} y1={yFor(yMin)} x2={padL + innerW} y2={yFor(yMin)}
              stroke="var(--line)" strokeWidth="0.5" strokeDasharray="2,3" />

        {/* Filled area below the curve */}
        <path d={fillD} fill={`url(#tpg-fill-${trailId})`} />

        {/* The curve, colored along its length by gradient + glowing */}
        <path ref={pathRef} d={pathD} fill="none"
              stroke={`url(#tpg-stroke-${trailId})`} strokeWidth="3"
              strokeLinejoin="round" strokeLinecap="round"
              filter={`url(#tpg-glow-${trailId})`} />
      </svg>

      {/* Stat strip below */}
      <div className="grid grid-cols-4 gap-2 mt-3 px-1">
        <Stat label="Climb"        v={`${Math.round(totalClimb)} m`}    color="#f8b6a6" />
        <Stat label="Descent"      v={`${Math.round(totalDescent)} m`}  color="#5fa7c4" />
        <Stat label="Max grade"    v={`${maxGradient.toFixed(0)}%`}     color={gradientColor(maxGradient)} />
        <Stat label="Steepest dip" v={`${minGradient.toFixed(0)}%`}     color={gradientColor(minGradient)} />
      </div>
    </div>
  );
}

function Stat({ label, v, color }) {
  return (
    <div className="rounded-lg px-3 py-2"
         style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">{label}</div>
      <div className="text-base font-extrabold" style={{ color }}>{v}</div>
    </div>
  );
}
