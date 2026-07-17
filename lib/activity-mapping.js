// Map an imported activity's kind → the plan session type it should tick.
// Used by Strava sync, Strava webhook, and Suunto sync so a strength workout
// gets attached to a strength plan slot instead of a ride slot.

const KIND_TO_TYPE = {
  cycle:    "ride",
  run:      "run",
  strength: "strength",
  yoga:     "yoga",
  // Everything else (hike, swim, ski, paddle, climb, other) falls through to
  // "ride" — MTB plans mostly plan rides, so an unknown cross-training
  // activity landing there is the least surprising default.
};

export function sessionTypeForActivityKind(kind) {
  return KIND_TO_TYPE[kind] || "ride";
}

// User-facing label when we add the activity as an "extra" on a day whose
// template has no matching slot.
const KIND_TO_RECORDED_LABEL = {
  cycle:    "Recorded ride",
  run:      "Recorded run",
  strength: "Recorded strength",
  yoga:     "Recorded yoga",
  rope:     "Recorded flow rope",
  hike:     "Recorded hike",
  swim:     "Recorded swim",
  ski:      "Recorded ski",
  paddle:   "Recorded paddle",
  climb:    "Recorded climb",
};

export function recordedActivityLabel(kind) {
  return KIND_TO_RECORDED_LABEL[kind] || "Recorded activity";
}
