// Static training content for libraries.
// Each item has tags so the search/filter can find by keyword.

// ============================================================
// STRENGTH — flattened to a list of individual exercises with workout grouping
// ============================================================
export const STRENGTH_EXERCISES = [
  // Lower-body Power
  { id: "sq-goblet",     name: "Goblet squat",          workout: "Lower-body Power", sets: "4 × 8",       note: "Pause 1 sec at bottom",                      tags: ["legs","quads","glutes","squat"] },
  { id: "sq-back",       name: "Back squat",            workout: "Lower-body Power", sets: "4 × 5",       note: "Drive through heels, knees track toes",       tags: ["legs","quads","glutes","squat","barbell"] },
  { id: "rdl",           name: "Romanian deadlift",     workout: "Lower-body Power", sets: "4 × 8",       note: "Hinge, feel hamstrings",                      tags: ["legs","hamstrings","glutes","posterior"] },
  { id: "lunge-walk",    name: "Walking lunge",         workout: "Lower-body Power", sets: "3 × 12/leg",  note: "Front knee tracks toe",                       tags: ["legs","quads","glutes","unilateral"] },
  { id: "bulg-split",    name: "Bulgarian split squat", workout: "Lower-body Power", sets: "3 × 10/leg",  note: "Tempo 3-0-1, back foot elevated",             tags: ["legs","quads","glutes","unilateral","balance"] },
  { id: "calf-sl",       name: "Single-leg calf raise", workout: "Lower-body Power", sets: "3 × 15/leg",  note: "Slow down phase",                              tags: ["calves","ankle"] },

  // Upper + Core
  { id: "pushup",        name: "Push-up (or bench)",    workout: "Upper + Core",     sets: "4 × 10",      note: "Shoulders away from ears",                    tags: ["chest","triceps","shoulders","push"] },
  { id: "pullup",        name: "Pull-up / inverted row", workout: "Upper + Core",    sets: "4 × max",     note: "Stop 1 rep before failure",                   tags: ["back","biceps","pull"] },
  { id: "row-1arm",      name: "Single-arm row",        workout: "Upper + Core",     sets: "3 × 10/side", note: "Squeeze shoulder blade",                       tags: ["back","pull","unilateral"] },
  { id: "ohp",           name: "Overhead press",        workout: "Upper + Core",     sets: "3 × 8",       note: "Brace core, ribs down",                        tags: ["shoulders","push","barbell"] },
  { id: "plank-tap",     name: "Plank w/ shoulder taps", workout: "Upper + Core",    sets: "3 × 30 sec",  note: "No hip wiggle",                                tags: ["core","plank","shoulders"] },
  { id: "deadbug",       name: "Dead bug",              workout: "Upper + Core",     sets: "3 × 10/side", note: "Low back stays glued",                         tags: ["core","anti-extension"] },
  { id: "pallof",        name: "Pallof press",          workout: "Upper + Core",     sets: "3 × 10/side", note: "Anti-rotation core",                           tags: ["core","anti-rotation"] },

  // Cycling-Specific Endurance
  { id: "kb-swing",      name: "KB swing",              workout: "Cycling Endurance", sets: "4 × 15",     note: "Snap hips, not arms",                          tags: ["glutes","hinge","power","kettlebell"] },
  { id: "step-up",       name: "Step-up to knee drive", workout: "Cycling Endurance", sets: "3 × 8/leg",  note: "Explosive up, slow down",                      tags: ["legs","glutes","power","unilateral"] },
  { id: "hollow",        name: "Hollow-body hold",      workout: "Cycling Endurance", sets: "3 × 30 sec", note: "Lower back pressed down",                      tags: ["core","gymnastics"] },
  { id: "sidep-reach",   name: "Side plank w/ reach",   workout: "Cycling Endurance", sets: "3 × 8/side", note: "Hips high",                                    tags: ["core","obliques","plank"] },
  { id: "farmer",        name: "Farmer's carry",        workout: "Cycling Endurance", sets: "3 × 30m",    note: "Tall posture, ribs down",                      tags: ["core","grip","trapezius"] },

  // Skills / Stability
  { id: "single-leg-rdl", name: "Single-leg RDL",       workout: "Stability",         sets: "3 × 8/leg",  note: "Hinge, eyes on floor, slow",                   tags: ["balance","hamstrings","glutes","unilateral"] },
  { id: "copen-side",    name: "Copenhagen plank",      workout: "Stability",         sets: "3 × 20 sec/side", note: "Adductor strength — be gentle starting",  tags: ["core","adductors","unilateral"] },
];

// ============================================================
// YOGA — 30+ poses, flagged as warmup, recovery, or both
// ============================================================
export const YOGA_POSES = [
  // Pre-ride dynamic
  { id: "cat-cow",          name: "Cat-Cow",                    type: "Warm-up",  reps: "8 cycles",      why: "Spinal mobility, wakes up the back",            tags: ["spine","mobility","dynamic"] },
  { id: "seated-twist",     name: "Seated Twists",              type: "Warm-up",  reps: "5/side",        why: "Rotational range for cornering",                tags: ["spine","twist","cornering"] },
  { id: "low-lunge-twist",  name: "Low Lunge w/ Twist",         type: "Warm-up",  reps: "5/side",        why: "Hip flexors + thoracic rotation",               tags: ["hips","spine","twist","dynamic"] },
  { id: "reverse-tab",      name: "Reverse Tabletop",           type: "Warm-up",  reps: "30 sec × 2",    why: "Opens hips, fires glutes & shoulders",          tags: ["hips","shoulders","glutes"] },
  { id: "upward-dog-mod",   name: "Modified Upward-Facing Dog", type: "Warm-up",  reps: "5 breaths",     why: "Counters bent-over riding posture",             tags: ["chest","shoulders","spine"] },
  { id: "heart-opener",     name: "Anahatasana (Heart-Opener)", type: "Warm-up",  reps: "5 breaths",     why: "Chest & shoulders from gripping bars",          tags: ["chest","shoulders"] },
  { id: "boat",             name: "Navasana (Boat Pose)",       type: "Warm-up",  reps: "3 × 20 sec",    why: "Core engagement for bike control",              tags: ["core"] },
  { id: "sun-a",            name: "Sun Salutation A",           type: "Warm-up",  reps: "3 rounds",      why: "Full-body wake-up flow",                        tags: ["dynamic","full-body","spine"] },
  { id: "wide-fold",        name: "Wide-legged forward fold",   type: "Warm-up",  reps: "5 breaths",     why: "Hamstring + adductor opener",                   tags: ["hamstrings","adductors"] },

  // Post-ride restorative
  { id: "anahatasana-hold", name: "Anahatasana Hold",           type: "Recovery", reps: "2 min",         why: "Deep shoulder & chest release",                 tags: ["chest","shoulders","static"] },
  { id: "quad-couch",       name: "Quadriceps Stretch (couch)", type: "Recovery", reps: "90 sec/leg",    why: "Pedaling fatigue",                              tags: ["quads","hip-flexors","static"] },
  { id: "prone-chest",      name: "Prone Chest Stretch",        type: "Recovery", reps: "60 sec/side",   why: "Counter rounded riding posture",                tags: ["chest","shoulders","static"] },
  { id: "ham-strap",        name: "Hamstring Stretch w/ Strap", type: "Recovery", reps: "90 sec/leg",    why: "Prevent tight legs & low-back pain",            tags: ["hamstrings","static"] },
  { id: "supta-baddha",     name: "Supta Baddha Konasana",      type: "Recovery", reps: "3–5 min",       why: "Restorative — nervous system reset",            tags: ["hips","restorative"] },
  { id: "legs-up-wall",     name: "Legs-Up-the-Wall",           type: "Recovery", reps: "5 min",         why: "Drains legs, calms HR",                         tags: ["restorative","circulation","legs"] },
  { id: "pigeon",           name: "Pigeon Pose",                type: "Recovery", reps: "2 min/side",    why: "Hip rotators & glute release",                  tags: ["hips","glutes","static"] },
  { id: "figure-4",         name: "Figure-4 Stretch (supine)",  type: "Recovery", reps: "90 sec/side",   why: "Pigeon's gentler cousin — IT band & glutes",    tags: ["hips","glutes","static"] },
  { id: "childs",           name: "Child's Pose",               type: "Recovery", reps: "2 min",         why: "Spine decompression, breath reset",             tags: ["spine","restorative"] },
  { id: "thread",           name: "Thread the Needle",          type: "Recovery", reps: "90 sec/side",   why: "Thoracic spine + shoulder release",             tags: ["spine","shoulders","twist"] },
  { id: "lizard",           name: "Lizard Lunge",               type: "Recovery", reps: "90 sec/side",   why: "Deep hip flexor + hamstring opener",            tags: ["hips","hamstrings","static"] },
  { id: "happy-baby",       name: "Happy Baby",                 type: "Recovery", reps: "2 min",         why: "Low back & inner thigh release",                tags: ["low-back","hips","restorative"] },
  { id: "savasana",         name: "Savasana",                   type: "Recovery", reps: "5–10 min",      why: "Complete recovery — nervous system + breath",   tags: ["restorative","breath"] },
];

// ============================================================
// RUNNING — extended sessions
// ============================================================
export const RUN_SESSIONS = [
  { id: "easy",       name: "Easy aerobic run",     time: "30–40 min",                 phase: "Anytime", note: "Nasal-breathing pace. Recover, don't tax.",            tags: ["easy","aerobic","base"] },
  { id: "trail-jog",  name: "Trail jog",            time: "20–30 min",                 phase: "Anytime", note: "Soft surface. Easier on knees than road.",             tags: ["easy","trail"] },
  { id: "strides",    name: "Stride intervals",     time: "20 min + 6×30 sec strides", phase: "Build",   note: "Form work. Not a workout.",                            tags: ["form","strides"] },
  { id: "hills",      name: "Hill repeats",         time: "5×60 sec uphill",           phase: "Build",   note: "Walk down. Builds glute/hamstring power.",             tags: ["hills","power","build"] },
  { id: "fartlek",    name: "Fartlek (mixed)",      time: "30 min mixed efforts",      phase: "Build",   note: "Pick landmarks. Surge between them. Repeat.",          tags: ["fartlek","mixed","build"] },
  { id: "tempo",      name: "Tempo run",            time: "20 min @ comfortably-hard", phase: "Peak",    note: "Should feel sustainable but not chatty.",              tags: ["tempo","threshold","peak"] },
  { id: "long",       name: "Long aerobic",         time: "60 min easy",               phase: "Base",    note: "Build endurance. Slow than you think.",                tags: ["long","base","endurance"] },
];

// ============================================================
// FLOW ROPE — extended drill list
// ============================================================
export const FLOW_ROPE_DRILLS = [
  { id: "fig-8",       name: "Figure-8 weave",         focus: "Coordination + grip relaxation",   time: "2 min",   tags: ["coordination","beginner"] },
  { id: "side-wraps",  name: "Side-to-side wraps",     focus: "Thoracic rotation under load",     time: "2 min",   tags: ["spine","rotation"] },
  { id: "vertical-halo", name: "Vertical halo",        focus: "Shoulder mobility & control",      time: "1 min",   tags: ["shoulders","mobility"] },
  { id: "step-through",name: "Step-through pass",      focus: "Lower-body / upper-body sync",     time: "2 min",   tags: ["coordination","intermediate"] },
  { id: "around-body", name: "Around-the-body",        focus: "Active range of motion",           time: "2 min",   tags: ["mobility","beginner"] },
  { id: "free-flow",   name: "Free-flow practice",     focus: "String it all together",           time: "5 min",   tags: ["flow","advanced"] },
  { id: "scoop",       name: "Scoop & toss",           focus: "Eye-hand timing",                  time: "2 min",   tags: ["coordination","timing"] },
  { id: "shoulder-circles", name: "Shoulder circles",  focus: "Warm shoulder joint deeply",       time: "1 min",   tags: ["shoulders","warmup"] },
];

// Aggregated workout headers for filtering
export const STRENGTH_WORKOUTS_LIST = [...new Set(STRENGTH_EXERCISES.map(e => e.workout))];

// SKILLS
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

// Legacy exports for back-compat (some components still import these)
export const STRENGTH_WORKOUTS = STRENGTH_WORKOUTS_LIST.map(w => ({
  name: w,
  blocks: STRENGTH_EXERCISES.filter(e => e.workout === w).map(e => ({
    name: e.name, sets: e.sets, note: e.note,
  })),
}));
export const YOGA_WARMUP   = YOGA_POSES.filter(p => p.type === "Warm-up");
export const YOGA_RECOVERY = YOGA_POSES.filter(p => p.type === "Recovery");
