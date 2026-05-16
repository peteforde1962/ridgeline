// Static training content. Lifted from the prototype.
// Single source of truth for strength workouts, yoga poses, run sessions, flow rope drills, skills.

export const STRENGTH_WORKOUTS = [
  {
    name: "Lower-body Power (Day A)",
    blocks: [
      { name: "Goblet squat",          sets: "4 × 8",       note: "Pause 1 sec at bottom" },
      { name: "Romanian deadlift",     sets: "4 × 8",       note: "Hinge, not squat. Feel hamstrings." },
      { name: "Walking lunge",         sets: "3 × 12/leg",  note: "Front knee tracks toe" },
      { name: "Single-leg calf raise", sets: "3 × 15/leg",  note: "Slow down phase" },
      { name: "Pallof press",          sets: "3 × 10/side", note: "Anti-rotation core" },
    ],
  },
  {
    name: "Upper + Core (Day B)",
    blocks: [
      { name: "Push-up (or bench)",     sets: "4 × 10",      note: "Shoulders away from ears" },
      { name: "Pull-up / inverted row", sets: "4 × max",     note: "Stop 1 rep before failure" },
      { name: "Single-arm row",         sets: "3 × 10/side", note: "Squeeze shoulder blade" },
      { name: "Plank w/ shoulder taps", sets: "3 × 30 sec",  note: "No hip wiggle" },
      { name: "Dead bug",               sets: "3 × 10/side", note: "Low back stays glued" },
    ],
  },
  {
    name: "Cycling-Specific Endurance",
    blocks: [
      { name: "Bulgarian split squat",  sets: "3 × 10/leg",  note: "Tempo 3-0-1" },
      { name: "KB swing",               sets: "4 × 15",      note: "Snap hips, not arms" },
      { name: "Step-up to knee drive",  sets: "3 × 8/leg",   note: "Explosive up, slow down" },
      { name: "Hollow-body hold",       sets: "3 × 30 sec",  note: "Lower back pressed down" },
      { name: "Side plank w/ reach",    sets: "3 × 8/side",  note: "Hips high" },
    ],
  },
];

export const YOGA_WARMUP = [
  { name: "Cat-Cow",                    reps: "8 cycles",   why: "Spinal mobility, wakes up the back" },
  { name: "Seated Twists",              reps: "5/side",     why: "Rotational range for cornering" },
  { name: "Low Lunge w/ Twist",         reps: "5/side",     why: "Hip flexors + thoracic" },
  { name: "Reverse Tabletop",           reps: "30 sec × 2", why: "Opens hips, fires glutes & shoulders" },
  { name: "Modified Upward-Facing Dog", reps: "5 breaths",  why: "Counters bent-over riding posture" },
  { name: "Anahatasana (Heart-Opener)", reps: "5 breaths",  why: "Chest & shoulders from gripping bars" },
  { name: "Navasana (Boat Pose)",       reps: "3 × 20 sec", why: "Core engagement for bike control" },
];

export const YOGA_RECOVERY = [
  { name: "Anahatasana Hold",            reps: "2 min",        why: "Deep shoulder & chest release" },
  { name: "Quadriceps Stretch (couch)",  reps: "90 sec/leg",   why: "Pedaling fatigue" },
  { name: "Prone Chest Stretch",         reps: "60 sec/side",  why: "Counter rounded riding posture" },
  { name: "Hamstring Stretch w/ Strap",  reps: "90 sec/leg",   why: "Prevent tight legs & low-back pain" },
  { name: "Supta Baddha Konasana",       reps: "3–5 min",      why: "Restorative — nervous system reset" },
  { name: "Legs-Up-the-Wall",            reps: "5 min",        why: "Drains legs, calms HR" },
];

export const RUN_SESSIONS = [
  { name: "Easy aerobic run",         time: "30–40 min",                 note: "Nasal-breathing pace. Recover, don't tax." },
  { name: "Trail jog",                time: "20–30 min",                 note: "Soft surface. Easier on knees than road." },
  { name: "Stride intervals",         time: "20 min + 6×30 sec strides", note: "Form work. Not a workout." },
  { name: "Hill repeats (post-base)", time: "5×60 sec uphill",           note: "Walk down. Builds glute/hamstring power." },
];

export const FLOW_ROPE_DRILLS = [
  { name: "Figure-8 weave",       focus: "Coordination + grip relaxation", time: "2 min" },
  { name: "Side-to-side wraps",   focus: "Thoracic rotation under load",   time: "2 min" },
  { name: "Vertical halo",        focus: "Shoulder mobility & control",    time: "1 min" },
  { name: "Step-through pass",    focus: "Lower-body / upper-body sync",   time: "2 min" },
  { name: "Around-the-body",      focus: "Active range of motion",         time: "2 min" },
  { name: "Free-flow practice",   focus: "String it all together",         time: "5 min" },
];

export const SKILLS = [
  { key: "endurance", label: "Endurance",        desc: "Long days in the saddle" },
  { key: "power",     label: "Power",            desc: "Punchy climbs & sprints" },
  { key: "cornering", label: "Cornering",        desc: "Speed & body position" },
  { key: "drops",     label: "Drops & Jumps",    desc: "Air confidence" },
  { key: "climbs",    label: "Technical Climbs", desc: "Tractor up rocks & roots" },
  { key: "descents",  label: "Descents",         desc: "Reading lines at speed" },
  { key: "mobility",  label: "Mobility",         desc: "Range of motion" },
  { key: "strength",  label: "Strength",         desc: "Force production" },
];
