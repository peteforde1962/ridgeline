"use client";

// Pose overlay using MediaPipe Pose Landmarker (browser, free, private).
// Renders a <video> with a <canvas> overlay drawing the skeleton + joint angles.
// Loads the model dynamically from a CDN on first mount.
//
// Joint angles we report: knee, hip-hinge, elbow, torso-from-vertical.

import { useEffect, useRef, useState } from "react";

// MediaPipe pose landmark indices.
const LM = {
  nose: 0,
  shoulderL: 11, shoulderR: 12,
  elbowL:    13, elbowR:    14,
  wristL:    15, wristR:    16,
  hipL:      23, hipR:      24,
  kneeL:     25, kneeR:     26,
  ankleL:    27, ankleR:    28,
};

// Bone pairs to draw as the skeleton.
const BONES = [
  [LM.shoulderL, LM.shoulderR],
  [LM.shoulderL, LM.elbowL], [LM.elbowL, LM.wristL],
  [LM.shoulderR, LM.elbowR], [LM.elbowR, LM.wristR],
  [LM.shoulderL, LM.hipL],   [LM.shoulderR, LM.hipR],
  [LM.hipL, LM.hipR],
  [LM.hipL, LM.kneeL],       [LM.kneeL, LM.ankleL],
  [LM.hipR, LM.kneeR],       [LM.kneeR, LM.ankleR],
];

// Joint highlights — the points coaches actually comment on.
const JOINT_DOTS = [LM.shoulderL, LM.shoulderR, LM.elbowL, LM.elbowR,
                    LM.hipL, LM.hipR, LM.kneeL, LM.kneeR];

function angleDeg(a, b, c) {
  if (!a || !b || !c) return null;
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const dot = v1.x * v2.x + v1.y * v2.y;
  const m1 = Math.hypot(v1.x, v1.y);
  const m2 = Math.hypot(v2.x, v2.y);
  if (!m1 || !m2) return null;
  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)));
  return Math.round((Math.acos(cos) * 180) / Math.PI);
}

function torsoFromVerticalDeg(lm) {
  // Angle of shoulders-midpoint → hips-midpoint vs straight down.
  const sx = (lm[LM.shoulderL].x + lm[LM.shoulderR].x) / 2;
  const sy = (lm[LM.shoulderL].y + lm[LM.shoulderR].y) / 2;
  const hx = (lm[LM.hipL].x + lm[LM.hipR].x) / 2;
  const hy = (lm[LM.hipL].y + lm[LM.hipR].y) / 2;
  const dx = hx - sx;
  const dy = hy - sy;
  const fromVert = (Math.atan2(Math.abs(dx), Math.abs(dy)) * 180) / Math.PI;
  return Math.round(fromVert);
}

export default function PoseOverlay({ src, onTimeChange, currentTimeRef }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const landmarkerRef = useRef(null);
  const rafRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(true);
  const [angles, setAngles] = useState(null);
  const [loadError, setLoadError] = useState("");

  // Load MediaPipe Pose Landmarker once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Dynamic ESM import from CDN — keeps the model out of our bundle.
        const vision = await import(
          /* webpackIgnore: true */
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs"
        );
        const { FilesetResolver, PoseLandmarker } = vision;
        const fileset = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        const lm = await PoseLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });
        if (!cancelled) {
          landmarkerRef.current = lm;
          setReady(true);
        }
      } catch (e) {
        if (!cancelled) setLoadError(e.message || "Failed to load pose model");
      }
    })();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      landmarkerRef.current?.close?.();
    };
  }, []);

  // Detection loop — runs while the video is playing.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !ready) return;

    function tick() {
      if (!video || video.paused || video.ended) return;
      detectAndDraw();
      rafRef.current = requestAnimationFrame(tick);
    }
    function onPlay() {
      rafRef.current = requestAnimationFrame(tick);
    }
    function onPauseOrSeek() {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // Still draw once at the paused frame so coaches see the skeleton.
      detectAndDraw();
    }
    function onTime() {
      if (currentTimeRef) currentTimeRef.current = video.currentTime;
      onTimeChange?.(video.currentTime);
    }
    function onSeekRequest(e) {
      const ms = e.detail?.ms || 0;
      video.currentTime = ms / 1000;
      video.pause();
    }
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPauseOrSeek);
    video.addEventListener("seeked", onPauseOrSeek);
    video.addEventListener("timeupdate", onTime);
    window.addEventListener("ridgeline:seek-video", onSeekRequest);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPauseOrSeek);
      video.removeEventListener("seeked", onPauseOrSeek);
      video.removeEventListener("timeupdate", onTime);
      window.removeEventListener("ridgeline:seek-video", onSeekRequest);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [ready, onTimeChange, currentTimeRef]);

  function detectAndDraw() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const lm = landmarkerRef.current;
    if (!video || !canvas || !lm) return;
    if (video.readyState < 2) return;

    // Match canvas size to the rendered video size for crisp overlay.
    const w = video.clientWidth;
    const h = video.clientHeight;
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);

    const ts = performance.now();
    let result;
    try {
      result = lm.detectForVideo(video, ts);
    } catch {
      return;
    }
    const landmarks = result?.landmarks?.[0];
    if (!landmarks) {
      setAngles(null);
      return;
    }

    // --- draw skeleton ---
    if (showSkeleton) {
      ctx.strokeStyle = "rgba(244, 184, 96, 0.95)";  // peach
      ctx.lineWidth = 3;
      ctx.lineCap = "round";
      for (const [a, b] of BONES) {
        const p1 = landmarks[a], p2 = landmarks[b];
        if (!p1 || !p2) continue;
        ctx.beginPath();
        ctx.moveTo(p1.x * w, p1.y * h);
        ctx.lineTo(p2.x * w, p2.y * h);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(242, 104, 56, 1)";  // accent
      for (const idx of JOINT_DOTS) {
        const p = landmarks[idx];
        if (!p) continue;
        ctx.beginPath();
        ctx.arc(p.x * w, p.y * h, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // --- compute joint angles ---
    const kneeR = angleDeg(landmarks[LM.hipR], landmarks[LM.kneeR], landmarks[LM.ankleR]);
    const kneeL = angleDeg(landmarks[LM.hipL], landmarks[LM.kneeL], landmarks[LM.ankleL]);
    const hipR  = angleDeg(landmarks[LM.shoulderR], landmarks[LM.hipR], landmarks[LM.kneeR]);
    const hipL  = angleDeg(landmarks[LM.shoulderL], landmarks[LM.hipL], landmarks[LM.kneeL]);
    const elbowR = angleDeg(landmarks[LM.shoulderR], landmarks[LM.elbowR], landmarks[LM.wristR]);
    const elbowL = angleDeg(landmarks[LM.shoulderL], landmarks[LM.elbowL], landmarks[LM.wristL]);
    const torso = torsoFromVerticalDeg(landmarks);

    setAngles({
      knee: avg(kneeL, kneeR),
      hip:  avg(hipL, hipR),
      elbow: avg(elbowL, elbowR),
      torso,
    });
  }

  return (
    <div>
      <div className="relative rounded-lg overflow-hidden" style={{ background: "#000" }}>
        <video
          ref={videoRef}
          src={src}
          controls
          playsInline
          crossOrigin="anonymous"
          style={{ width: "100%", display: "block" }}
        />
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute", inset: 0,
            pointerEvents: "none",
            width: "100%", height: "100%",
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={showSkeleton}
                 onChange={(e) => setShowSkeleton(e.target.checked)} />
          Skeleton overlay
        </label>
        {!ready && !loadError && (
          <span className="text-xs text-[var(--muted)]">Loading pose model…</span>
        )}
        {loadError && (
          <span className="text-xs text-[var(--red,#e87262)]">⚠ {loadError}</span>
        )}
        {angles && (
          <div className="flex gap-3 text-xs flex-wrap">
            <Angle label="Knee"  v={angles.knee} ideal={[120, 160]} />
            <Angle label="Hip"   v={angles.hip}  ideal={[90, 140]} />
            <Angle label="Elbow" v={angles.elbow} ideal={[140, 170]} />
            <Angle label="Torso" v={angles.torso} ideal={[20, 50]} unit="° from vert" />
          </div>
        )}
      </div>
    </div>
  );
}

function avg(a, b) {
  if (a == null && b == null) return null;
  if (a == null) return b;
  if (b == null) return a;
  return Math.round((a + b) / 2);
}

function Angle({ label, v, ideal, unit = "°" }) {
  if (v == null) return null;
  const inRange = ideal && v >= ideal[0] && v <= ideal[1];
  return (
    <div className="px-2 py-1 rounded"
         style={{ background: inRange ? "rgba(106,194,138,.18)" : "rgba(232,114,98,.16)" }}>
      <span className="text-[var(--muted)]">{label} </span>
      <strong>{v}{unit}</strong>
    </div>
  );
}
