"use client";

// Composite client component: PoseOverlay + VideoComments wired by a shared ref.
// Used by both the coach's video page and the student's own video detail page.

import { useRef } from "react";
import PoseOverlay from "./PoseOverlay";
import VideoComments from "./VideoComments";

export default function VideoCoachingClient({ videoId, userId, src, kind }) {
  const tRef = useRef(0);

  if (kind !== "upload" || !src) {
    // YouTube/Vimeo embed — pose detection can't run cross-origin on these.
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-lg overflow-hidden" style={{ background: "#000", aspectRatio: "16 / 9" }}>
          <iframe src={src} allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen style={{ width: "100%", height: "100%", border: 0 }} />
        </div>
        <div>
          <p className="text-xs text-[var(--muted)] mb-3">
            Pose overlay only works for uploaded videos. For YouTube/Vimeo, comments still work.
          </p>
          <VideoComments videoId={videoId} currentUserId={userId} currentTimeRef={tRef} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div>
        <PoseOverlay src={src} currentTimeRef={tRef} />
      </div>
      <div>
        <VideoComments videoId={videoId} currentUserId={userId} currentTimeRef={tRef} />
      </div>
    </div>
  );
}
