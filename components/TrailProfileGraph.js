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
function generateProfile(lengthKm, elevM, seedStr) {
  const rand = seededRand(hashSeed(seedStr || "trail"));
  // Sum of harmonics produces a believable, varied shape.
  const points = [];
  // Bias parameter — high elev/km trails feel more climbing-heavy.
  const climbiness = Math.min(1, (elevM || 0) / (lengthKm * 80));
  for (let i = 0; i < NUM_POINTS; i++) {
    const t = i / (NUM_POINTS - 1);
    const x = t * lengthKm;
    // 3 harmonic sines + small noise. Bias the main hump by climbiness so trails
    // with lots of elev gain rise toward the middle/end.
    const main = Math.sin(t * Math.PI) * (0.55 + 0.20 * climbiness);
    const sub1 = Math.sin(t * Math.PI * 2.7 + 1.2 + rand() * 6) * 0.30;
    const sub2 = Math.sin(t * Math.PI * 5.1 + 2.7 + rand() * 6) * 0.15;
    const sub3 = Math.sin(t * Math.PI * 9.0 + 0.5 + rand() * 6) * 0.06;
    const noise = (rand() - 0.5) * 0.05;
    const y_raw = main + sub1 + sub2 + sub3 + noise;
    points.push({ x, y_raw });
  }
  // Normalize raw y to [0, elevM] so total climb roughly matches the trail's stated elev gain.
  const minY = Math.min(...points.map(p => p.y_raw));
  const maxY = Math.max(...points.map(p => p.y_raw));
  const range = maxY - minY || 1;
  for (const p of points) {
    p.y = ((p.y_raw - minY) / range) * (elevM || 100);
  }
  // Local gradient (%) between adjacent points.
  for (let i = 0; i < points.length; i++) {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const dxM = (next.x - prev.x) * 1000;
    const dyM = next.y - prev.y;
    points[i].gradient = dxM > 0 ? (dyM / dxM) * 100 : 0;
  }
  // Stats
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

export default function TrailProfileGraph({ trailId, name, lengthKm, elevM }) {
  const [revealed, setRevealed] = useState(false);
  const pathRef = useRef(null);

  // Bail out cleanly if we don't have enough data.
  if (!lengthKm || lengthKm <= 0) {
    return null;
  }
  const elev = elevM || Math.max(50, lengthKm * 20);

  const { points, totalClimb, totalDescent, maxGradient, minGradient } = useMemo(
    () => generateProfile(lengthKm, elev, trailId || name),
    [trailId, name, lengthKm, elev]
  );

  // Stroke-dashoffset reveal animation on mount.
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
  }, [trailId, lengthKm, elev]);

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
          Trail profile
        </h2>
        <div className="text-[10px] text-[var(--muted)]">
          color = gradient % · estimated from length + total climb
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
