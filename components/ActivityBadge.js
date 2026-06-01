"use client";

// Small badge showing the activity type with a brand SVG icon.
// Used on /rides/[id], dashboard recent activity, etc.

import Icon from "@/lib/icons";
import { sportInfo } from "@/lib/activity";

export default function ActivityBadge({ sportType, kind, size = "sm" }) {
  // Either pass sportType (preferred — gives accurate label) or kind alone.
  let info;
  if (sportType) {
    info = sportInfo(sportType);
  } else {
    // Best-effort label from kind alone.
    const labels = {
      cycle: "Ride", run: "Run", hike: "Hike", swim: "Swim",
      ski: "Snow", paddle: "Paddle", strength: "Workout",
      yoga: "Yoga", climb: "Climb", other: "Activity",
    };
    info = { kind: kind || "other", icon: kindIcon(kind), label: labels[kind] || "Activity" };
  }

  const px = size === "lg" ? 16 : 12;
  const padding = size === "lg" ? "5px 10px" : "3px 8px";

  return (
    <span className="inline-flex items-center gap-1 rounded font-semibold"
          style={{
            background: "var(--bg2)",
            color: "var(--accent2,#fccabb)",
            padding,
            fontSize: size === "lg" ? 13 : 11,
            letterSpacing: 0.2,
          }}>
      <Icon name={info.icon} size={px} />
      {info.label}
    </span>
  );
}

function kindIcon(kind) {
  return {
    cycle: "bike", run: "run", hike: "hike", swim: "swim",
    ski: "ski", paddle: "paddle", strength: "dumb",
    yoga: "yoga", climb: "climb",
  }[kind] || "bolt";
}
