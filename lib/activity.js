// Maps a Strava `sport_type` to:
//   - kind     — our coarse category used by trail detection, training-load,
//                 auto-tick logic, etc.
//   - icon     — the name of a brand SVG icon (see lib/icons.js)
//   - label    — short human-friendly label (e.g. "MTB", "Trail run")
//
// Strava's sport_type list grows over time. Anything unknown maps to
// kind="other" with the generic "bolt" icon — still imports cleanly.

const SPORT_MAP = {
  // Cycling
  Ride:               { kind: "cycle",   icon: "bike",  label: "Ride" },
  MountainBikeRide:   { kind: "cycle",   icon: "bike",  label: "MTB" },
  EMountainBikeRide:  { kind: "cycle",   icon: "bike",  label: "E-MTB" },
  EBikeRide:          { kind: "cycle",   icon: "bike",  label: "E-bike" },
  GravelRide:         { kind: "cycle",   icon: "bike",  label: "Gravel" },
  VirtualRide:        { kind: "cycle",   icon: "bike",  label: "Virtual ride" },
  Velomobile:         { kind: "cycle",   icon: "bike",  label: "Velomobile" },
  Handcycle:          { kind: "cycle",   icon: "bike",  label: "Handcycle" },

  // Running
  Run:                { kind: "run",     icon: "run",   label: "Run" },
  TrailRun:           { kind: "run",     icon: "run",   label: "Trail run" },
  VirtualRun:         { kind: "run",     icon: "run",   label: "Virtual run" },

  // Walk / Hike / Snowshoe
  Walk:               { kind: "hike",    icon: "hike",  label: "Walk" },
  Hike:               { kind: "hike",    icon: "hike",  label: "Hike" },
  Snowshoe:           { kind: "hike",    icon: "hike",  label: "Snowshoe" },

  // Swim
  Swim:               { kind: "swim",    icon: "swim",  label: "Swim" },

  // Snow sports
  AlpineSki:          { kind: "ski",     icon: "ski",   label: "Alpine ski" },
  BackcountrySki:     { kind: "ski",     icon: "ski",   label: "BC ski" },
  NordicSki:          { kind: "ski",     icon: "ski",   label: "Nordic ski" },
  Snowboard:          { kind: "ski",     icon: "ski",   label: "Snowboard" },
  IceSkate:           { kind: "ski",     icon: "ski",   label: "Ice skate" },

  // Water
  Kayaking:           { kind: "paddle",  icon: "paddle", label: "Kayak" },
  Canoeing:           { kind: "paddle",  icon: "paddle", label: "Canoe" },
  Rowing:             { kind: "paddle",  icon: "paddle", label: "Row" },
  StandUpPaddling:    { kind: "paddle",  icon: "paddle", label: "SUP" },
  Surfing:            { kind: "paddle",  icon: "paddle", label: "Surf" },
  Kitesurf:           { kind: "paddle",  icon: "paddle", label: "Kitesurf" },
  Windsurf:           { kind: "paddle",  icon: "paddle", label: "Windsurf" },
  Sail:               { kind: "paddle",  icon: "paddle", label: "Sail" },

  // Strength / gym
  Workout:            { kind: "strength", icon: "dumb", label: "Workout" },
  WeightTraining:     { kind: "strength", icon: "dumb", label: "Strength" },
  Crossfit:           { kind: "strength", icon: "dumb", label: "Crossfit" },
  StairStepper:       { kind: "strength", icon: "dumb", label: "StairStepper" },
  Elliptical:         { kind: "strength", icon: "dumb", label: "Elliptical" },

  // Yoga / mobility
  Yoga:               { kind: "yoga",    icon: "yoga",  label: "Yoga" },
  Pilates:            { kind: "yoga",    icon: "yoga",  label: "Pilates" },

  // Climbing
  RockClimbing:       { kind: "climb",   icon: "climb", label: "Climbing" },

  // Skate
  InlineSkate:        { kind: "other",   icon: "bolt",  label: "Inline skate" },
  Skateboard:         { kind: "other",   icon: "bolt",  label: "Skateboard" },
};

export function sportInfo(sportType) {
  if (!sportType) return { kind: "other", icon: "bolt", label: "Activity" };
  return SPORT_MAP[sportType] || { kind: "other", icon: "bolt", label: sportType };
}

// Activity-kind specific defaults for displaying / auto-ticking sessions.
export const KIND_TO_PLAN_TYPE = {
  cycle:    "ride",
  run:      "run",
  hike:     "run",       // closest plan-type analog
  yoga:     "yoga",
  strength: "strength",
  // swim/ski/paddle/climb/other → no auto-tick; user can manually attach.
};
