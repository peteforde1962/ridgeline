// Static training content for searchable libraries. Significantly expanded.
// Each item carries `tags` so the SearchableList can filter on muscle / body part / phase / etc.

// ============================================================
// STRENGTH — 50+ exercises across 6 workouts
// ============================================================
export const STRENGTH_EXERCISES = [
  // ---- Lower-body Power ----
  { id: "sq-goblet",         name: "Goblet squat",            workout: "Lower-body Power", sets: "4 × 8",       note: "Pause 1 sec at bottom",                tags: ["legs","quads","glutes","squat","beginner"] },
  { id: "sq-back",           name: "Back squat",              workout: "Lower-body Power", sets: "4 × 5",       note: "Drive through heels, knees track toes", tags: ["legs","quads","glutes","squat","barbell","advanced"] },
  { id: "sq-front",          name: "Front squat",             workout: "Lower-body Power", sets: "4 × 6",       note: "Elbows up, torso vertical",            tags: ["legs","quads","squat","barbell","core"] },
  { id: "rdl",               name: "Romanian deadlift",       workout: "Lower-body Power", sets: "4 × 8",       note: "Hinge, feel hamstrings",               tags: ["hamstrings","glutes","posterior","hinge"] },
  { id: "dl-conv",           name: "Conventional deadlift",   workout: "Lower-body Power", sets: "3 × 5",       note: "Brace, sweep bar to hips",             tags: ["posterior","hamstrings","back","barbell","advanced"] },
  { id: "lunge-walk",        name: "Walking lunge",           workout: "Lower-body Power", sets: "3 × 12/leg",  note: "Front knee tracks toe",                tags: ["legs","quads","glutes","unilateral"] },
  { id: "lunge-rev",         name: "Reverse lunge",           workout: "Lower-body Power", sets: "3 × 10/leg",  note: "Easier on knees than forward lunges",  tags: ["legs","quads","glutes","unilateral","beginner"] },
  { id: "bulg-split",        name: "Bulgarian split squat",   workout: "Lower-body Power", sets: "3 × 10/leg",  note: "Tempo 3-0-1, back foot elevated",      tags: ["legs","quads","glutes","unilateral","balance"] },
  { id: "calf-sl",           name: "Single-leg calf raise",   workout: "Lower-body Power", sets: "3 × 15/leg",  note: "Slow down phase",                       tags: ["calves","ankle"] },

  // ---- Upper + Core ----
  { id: "pushup",            name: "Push-up",                 workout: "Upper + Core",     sets: "4 × 10",       note: "Shoulders away from ears",            tags: ["chest","triceps","shoulders","push","beginner"] },
  { id: "pushup-decline",    name: "Decline push-up",         workout: "Upper + Core",     sets: "3 × 10",       note: "Feet elevated, more shoulder load",   tags: ["shoulders","chest","push","intermediate"] },
  { id: "bench-press",       name: "Bench press",             workout: "Upper + Core",     sets: "4 × 6",        note: "Tuck elbows ~45°",                     tags: ["chest","triceps","push","barbell"] },
  { id: "pullup",            name: "Pull-up",                 workout: "Upper + Core",     sets: "4 × max",      note: "Stop 1 rep before failure",           tags: ["back","biceps","pull","gymnastics"] },
  { id: "row-inverted",      name: "Inverted row",            workout: "Upper + Core",     sets: "4 × 10",       note: "Pull chest to bar, body straight",    tags: ["back","pull","gymnastics","beginner"] },
  { id: "row-1arm",          name: "Single-arm DB row",       workout: "Upper + Core",     sets: "3 × 10/side",  note: "Squeeze shoulder blade",              tags: ["back","pull","unilateral","dumbbell"] },
  { id: "ohp",               name: "Overhead press",          workout: "Upper + Core",     sets: "3 × 8",        note: "Brace core, ribs down",               tags: ["shoulders","push","barbell"] },
  { id: "lateral-raise",     name: "Lateral raise",           workout: "Upper + Core",     sets: "3 × 12",       note: "Lighter than you think",              tags: ["shoulders","dumbbell"] },
  { id: "facepull",          name: "Face pull",               workout: "Upper + Core",     sets: "3 × 15",       note: "Rear delts + rotator cuff",           tags: ["shoulders","rear-delts","cable","rehab"] },
  { id: "plank",             name: "Plank",                   workout: "Upper + Core",     sets: "3 × 45 sec",   note: "Glutes squeezed, no hip sag",         tags: ["core","plank","beginner"] },
  { id: "plank-tap",         name: "Plank w/ shoulder taps",  workout: "Upper + Core",     sets: "3 × 30 sec",   note: "No hip wiggle",                       tags: ["core","plank","shoulders"] },
  { id: "deadbug",           name: "Dead bug",                workout: "Upper + Core",     sets: "3 × 10/side",  note: "Low back stays glued",                tags: ["core","anti-extension"] },
  { id: "pallof",            name: "Pallof press",            workout: "Upper + Core",     sets: "3 × 10/side",  note: "Anti-rotation core",                  tags: ["core","anti-rotation","cable"] },

  // ---- Cycling Endurance ----
  { id: "kb-swing",          name: "KB swing",                workout: "Cycling Endurance", sets: "4 × 15",      note: "Snap hips, not arms",                 tags: ["glutes","hinge","power","kettlebell"] },
  { id: "kb-goblet-carry",   name: "KB goblet carry",         workout: "Cycling Endurance", sets: "3 × 40m",     note: "Anti-flexion core under fatigue",     tags: ["core","grip","kettlebell"] },
  { id: "step-up",           name: "Step-up to knee drive",   workout: "Cycling Endurance", sets: "3 × 8/leg",   note: "Explosive up, slow down",             tags: ["legs","glutes","power","unilateral"] },
  { id: "lateral-step",      name: "Lateral step-up",         workout: "Cycling Endurance", sets: "3 × 8/leg",   note: "Hits glute medius — riding stability", tags: ["glutes","hips","unilateral"] },
  { id: "hollow",            name: "Hollow-body hold",        workout: "Cycling Endurance", sets: "3 × 30 sec",  note: "Lower back pressed down",             tags: ["core","gymnastics"] },
  { id: "sidep-reach",       name: "Side plank w/ reach",     workout: "Cycling Endurance", sets: "3 × 8/side",  note: "Hips high",                            tags: ["core","obliques","plank"] },
  { id: "farmer",            name: "Farmer's carry",          workout: "Cycling Endurance", sets: "3 × 40m",     note: "Tall posture, ribs down",             tags: ["core","grip","trapezius"] },
  { id: "suitcase",          name: "Suitcase carry",          workout: "Cycling Endurance", sets: "3 × 30m/side", note: "Don't list — anti-lateral core",     tags: ["core","anti-rotation","grip"] },

  // ---- Stability / Skills ----
  { id: "single-leg-rdl",    name: "Single-leg RDL",          workout: "Stability",         sets: "3 × 8/leg",   note: "Hinge, eyes on floor, slow",          tags: ["balance","hamstrings","glutes","unilateral"] },
  { id: "copen-side",        name: "Copenhagen plank",        workout: "Stability",         sets: "3 × 20 sec/side", note: "Adductor strength — start gentle", tags: ["core","adductors","unilateral"] },
  { id: "tib-raise",         name: "Tibialis raise",          workout: "Stability",         sets: "3 × 20",      note: "Shin strength — prevents calf cramps", tags: ["shins","ankle","rehab"] },
  { id: "ankle-mob",         name: "Ankle dorsiflexion drill", workout: "Stability",        sets: "3 × 10/side", note: "Knee tracks over toe",                tags: ["ankle","mobility","warmup"] },
  { id: "wrist-mob",         name: "Wrist mobility series",   workout: "Stability",         sets: "1 round",     note: "Vital for descending pumped-arm relief", tags: ["wrists","mobility"] },

  // ---- Power / Plyo ----
  { id: "box-jump",          name: "Box jump",                workout: "Power",             sets: "5 × 5",       note: "Step down — knees love that",         tags: ["plyo","power","quick"] },
  { id: "broad-jump",        name: "Broad jump",              workout: "Power",             sets: "5 × 3",       note: "Stick the landing",                    tags: ["plyo","power","explosive"] },
  { id: "skater",            name: "Skater jump",             workout: "Power",             sets: "3 × 10/side", note: "Lateral plyometric",                  tags: ["plyo","lateral","balance"] },
  { id: "pogo",              name: "Pogo hop",                workout: "Power",             sets: "3 × 20",      note: "Ankle stiffness drill",               tags: ["plyo","ankle","reactive"] },
  { id: "kb-clean",          name: "KB clean",                workout: "Power",             sets: "4 × 5/side",  note: "Hips drive, then catch",              tags: ["power","kettlebell","explosive"] },

  // ---- Posterior Chain ----
  { id: "good-morning",      name: "Good morning",            workout: "Posterior",         sets: "3 × 8",       note: "Soft bend in knees — feel hams",      tags: ["hamstrings","low-back","barbell"] },
  { id: "hip-thrust",        name: "Barbell hip thrust",      workout: "Posterior",         sets: "4 × 8",       note: "Chin tucked, ribs down",              tags: ["glutes","barbell","posterior"] },
  { id: "glute-bridge-sl",   name: "Single-leg glute bridge", workout: "Posterior",         sets: "3 × 12/side", note: "Drive through heel",                  tags: ["glutes","unilateral","beginner"] },
  { id: "nordic-curl",       name: "Nordic curl",             workout: "Posterior",         sets: "3 × 5",       note: "Eccentric only at first — protect knees", tags: ["hamstrings","eccentric","advanced"] },
  { id: "back-extension",    name: "Back extension",          workout: "Posterior",         sets: "3 × 12",      note: "Squeeze glutes at top, not low back", tags: ["low-back","glutes","hamstrings"] },
];

// ============================================================
// YOGA — 45 poses
// ============================================================
export const YOGA_POSES = [
  // ---- Pre-ride dynamic ----
  { id: "cat-cow",           name: "Cat-Cow",                    type: "Warm-up",  reps: "8 cycles",       why: "Spinal mobility, wakes up the back",          tags: ["spine","mobility","dynamic"] },
  { id: "seated-twist",      name: "Seated Twists",              type: "Warm-up",  reps: "5/side",         why: "Rotational range for cornering",              tags: ["spine","twist","cornering"] },
  { id: "low-lunge-twist",   name: "Low Lunge w/ Twist",         type: "Warm-up",  reps: "5/side",         why: "Hip flexors + thoracic rotation",             tags: ["hips","spine","twist","dynamic"] },
  { id: "high-lunge",        name: "High Lunge",                 type: "Warm-up",  reps: "5 breaths/side", why: "Opens hip flexors deeply",                    tags: ["hips","quads","dynamic"] },
  { id: "warrior-2",         name: "Warrior II",                 type: "Warm-up",  reps: "30 sec/side",    why: "Hips + shoulders + grounding",                tags: ["hips","shoulders","balance"] },
  { id: "reverse-tab",       name: "Reverse Tabletop",           type: "Warm-up",  reps: "30 sec × 2",     why: "Opens hips, fires glutes & shoulders",        tags: ["hips","shoulders","glutes"] },
  { id: "upward-dog-mod",    name: "Modified Upward Dog",        type: "Warm-up",  reps: "5 breaths",      why: "Counters bent-over riding posture",           tags: ["chest","shoulders","spine"] },
  { id: "heart-opener",      name: "Anahatasana (Heart-Opener)", type: "Warm-up",  reps: "5 breaths",      why: "Chest & shoulders from gripping bars",        tags: ["chest","shoulders","static"] },
  { id: "boat",              name: "Navasana (Boat Pose)",       type: "Warm-up",  reps: "3 × 20 sec",     why: "Core engagement for bike control",            tags: ["core"] },
  { id: "sun-a",             name: "Sun Salutation A",           type: "Warm-up",  reps: "3 rounds",       why: "Full-body wake-up flow",                      tags: ["dynamic","full-body","spine"] },
  { id: "sun-b",             name: "Sun Salutation B",           type: "Warm-up",  reps: "3 rounds",       why: "Adds Warrior 1 & Chair — more legs",          tags: ["dynamic","full-body","legs"] },
  { id: "wide-fold",         name: "Wide-legged forward fold",   type: "Warm-up",  reps: "5 breaths",      why: "Hamstring + adductor opener",                 tags: ["hamstrings","adductors"] },
  { id: "downward-dog",      name: "Downward-Facing Dog",        type: "Warm-up",  reps: "10 breaths",     why: "Hamstrings + shoulders + decompresses spine", tags: ["hamstrings","shoulders","spine"] },
  { id: "thread-needle-d",   name: "Thread the Needle (dynamic)", type: "Warm-up", reps: "8 cycles",       why: "Thoracic rotation prep for the trail",         tags: ["spine","shoulders","dynamic"] },
  { id: "hip-circles",       name: "Standing Hip Circles",       type: "Warm-up",  reps: "5/each direction", why: "Hip joint mobility warm-up",                tags: ["hips","mobility","dynamic"] },

  // ---- Post-ride restorative ----
  { id: "anahatasana-hold",  name: "Anahatasana Hold",           type: "Recovery", reps: "2 min",          why: "Deep shoulder & chest release",               tags: ["chest","shoulders","static"] },
  { id: "quad-couch",        name: "Quadriceps Stretch (couch)", type: "Recovery", reps: "90 sec/leg",     why: "Pedaling fatigue",                            tags: ["quads","hip-flexors","static"] },
  { id: "prone-chest",       name: "Prone Chest Stretch",        type: "Recovery", reps: "60 sec/side",    why: "Counter rounded riding posture",              tags: ["chest","shoulders","static"] },
  { id: "ham-strap",         name: "Hamstring Stretch w/ Strap", type: "Recovery", reps: "90 sec/leg",     why: "Prevent tight legs & low-back pain",          tags: ["hamstrings","static"] },
  { id: "supta-baddha",      name: "Supta Baddha Konasana",      type: "Recovery", reps: "3–5 min",        why: "Restorative — nervous system reset",          tags: ["hips","restorative"] },
  { id: "legs-up-wall",      name: "Legs-Up-the-Wall",           type: "Recovery", reps: "5 min",          why: "Drains legs, calms HR",                       tags: ["restorative","circulation","legs"] },
  { id: "pigeon",            name: "Pigeon Pose",                type: "Recovery", reps: "2 min/side",     why: "Hip rotators & glute release",                tags: ["hips","glutes","static"] },
  { id: "sleeping-pigeon",   name: "Sleeping Pigeon",            type: "Recovery", reps: "2 min/side",     why: "Deeper pigeon — fold over front leg",         tags: ["hips","glutes","static","deep"] },
  { id: "figure-4",          name: "Figure-4 Stretch (supine)",  type: "Recovery", reps: "90 sec/side",    why: "Pigeon's gentler cousin — IT band & glutes",  tags: ["hips","glutes","static","beginner"] },
  { id: "childs",            name: "Child's Pose",               type: "Recovery", reps: "2 min",          why: "Spine decompression, breath reset",           tags: ["spine","restorative"] },
  { id: "thread",            name: "Thread the Needle",          type: "Recovery", reps: "90 sec/side",    why: "Thoracic spine + shoulder release",           tags: ["spine","shoulders","twist"] },
  { id: "lizard",            name: "Lizard Lunge",               type: "Recovery", reps: "90 sec/side",    why: "Deep hip flexor + hamstring opener",          tags: ["hips","hamstrings","static"] },
  { id: "happy-baby",        name: "Happy Baby",                 type: "Recovery", reps: "2 min",          why: "Low back & inner thigh release",              tags: ["low-back","hips","restorative"] },
  { id: "savasana",          name: "Savasana",                   type: "Recovery", reps: "5–10 min",       why: "Complete recovery — nervous system + breath", tags: ["restorative","breath"] },
  { id: "frog",              name: "Frog Pose",                  type: "Recovery", reps: "2–3 min",        why: "Hip openers — go slow",                       tags: ["hips","adductors","static","deep"] },
  { id: "puppy",             name: "Puppy Pose",                 type: "Recovery", reps: "90 sec",         why: "Shoulders + spine — gentler than dog",        tags: ["shoulders","spine","restorative"] },
  { id: "seated-fold",       name: "Seated Forward Fold",        type: "Recovery", reps: "2 min",          why: "Hamstrings + spine",                          tags: ["hamstrings","spine","static"] },
  { id: "butterfly",         name: "Butterfly",                  type: "Recovery", reps: "2 min",          why: "Inner thighs & hips",                         tags: ["hips","adductors","static"] },
  { id: "shoelace",          name: "Shoelace (yin)",             type: "Recovery", reps: "3 min/side",     why: "Outer hips & IT band — yin style",            tags: ["hips","IT-band","yin","static","deep"] },
  { id: "neck-rolls",        name: "Gentle neck rolls",          type: "Recovery", reps: "5 each way",     why: "Releases tension from helmet & body position",  tags: ["neck","mobility","static"] },
  { id: "wrist-stretch",     name: "Wrist flexor/extensor stretch", type: "Recovery", reps: "60 sec/each", why: "Counter the gripping",                       tags: ["wrists","forearms","static"] },
];

// ============================================================
// RUNNING — 15 sessions across base / build / peak / recovery
// ============================================================
export const RUN_SESSIONS = [
  // Anytime
  { id: "walk-jog",       name: "Walk/jog intervals",   time: "20 min (1 min jog / 1 min walk)", phase: "Anytime", note: "Beginner-friendly. Build tendon resilience.",  tags: ["easy","beginner","intervals"] },
  { id: "easy",           name: "Easy aerobic run",     time: "30–40 min",                         phase: "Anytime", note: "Nasal-breathing pace. Recover, don't tax.",     tags: ["easy","aerobic","base"] },
  { id: "trail-jog",      name: "Trail jog",            time: "20–30 min",                         phase: "Anytime", note: "Soft surface. Easier on knees than road.",      tags: ["easy","trail"] },

  // Base
  { id: "long-base",      name: "Long aerobic",         time: "60 min easy",                       phase: "Base",    note: "Build endurance. Slower than you think.",        tags: ["long","base","endurance"] },
  { id: "long-base-2",    name: "Long aerobic (extended)", time: "75–90 min easy",                  phase: "Base",    note: "Once you're comfortable with 60.",               tags: ["long","base","endurance"] },
  { id: "strides",        name: "Stride intervals",     time: "20 min + 6×30 sec strides",         phase: "Base",    note: "Form work. Not a workout.",                      tags: ["form","strides","drills"] },
  { id: "drill-form",     name: "Form drill circuit",   time: "20 min (A-skip, B-skip, butt kicks)", phase: "Base",  note: "Improves running economy.",                       tags: ["form","drills","base"] },

  // Build
  { id: "hills",          name: "Short hill repeats",   time: "5×60 sec uphill",                   phase: "Build",   note: "Walk down. Builds glute/hamstring power.",       tags: ["hills","power","build"] },
  { id: "long-hills",     name: "Long hill repeats",    time: "4×3 min uphill at threshold",       phase: "Build",   note: "Sustained climb power.",                          tags: ["hills","threshold","build","strength"] },
  { id: "fartlek",        name: "Fartlek (mixed)",      time: "30 min mixed efforts",              phase: "Build",   note: "Pick landmarks. Surge between them. Repeat.",     tags: ["fartlek","mixed","build"] },
  { id: "tempo",          name: "Tempo run",            time: "20 min @ comfortably-hard",         phase: "Peak",    note: "Should feel sustainable but not chatty.",         tags: ["tempo","threshold","peak"] },
  { id: "tempo-long",     name: "Long tempo",           time: "2×15 min tempo, 5 min jog between", phase: "Peak",    note: "Mental focus + lactate clearance.",               tags: ["tempo","threshold","peak"] },

  // Peak / sharpening
  { id: "intervals-400",  name: "400m intervals",       time: "6×400m hard, 90 sec jog",           phase: "Peak",    note: "VO2 work. Find a track or measured loop.",       tags: ["intervals","VO2","peak"] },
  { id: "intervals-mile", name: "Mile repeats",         time: "3×1 mile (1.6km) hard, 3 min jog",   phase: "Peak",    note: "Mental toughness + threshold.",                  tags: ["intervals","threshold","peak"] },

  // Recovery
  { id: "recovery-jog",   name: "Recovery jog",         time: "20 min easy",                       phase: "Recovery", note: "Truly easy — let HR stay low.",                  tags: ["recovery","easy"] },
];

// ============================================================
// FLOW ROPE — 18 drills
// ============================================================
export const FLOW_ROPE_DRILLS = [
  { id: "fig-8",            name: "Figure-8 weave",         focus: "Coordination + grip relaxation",      time: "2 min", tags: ["coordination","beginner"] },
  { id: "side-wraps",       name: "Side-to-side wraps",     focus: "Thoracic rotation under load",        time: "2 min", tags: ["spine","rotation"] },
  { id: "vertical-halo",    name: "Vertical halo",          focus: "Shoulder mobility & control",         time: "1 min", tags: ["shoulders","mobility"] },
  { id: "step-through",     name: "Step-through pass",      focus: "Lower-body / upper-body sync",        time: "2 min", tags: ["coordination","intermediate"] },
  { id: "around-body",      name: "Around-the-body",        focus: "Active range of motion",              time: "2 min", tags: ["mobility","beginner"] },
  { id: "free-flow",        name: "Free-flow practice",     focus: "String it all together",              time: "5 min", tags: ["flow","advanced"] },
  { id: "scoop",            name: "Scoop & toss",           focus: "Eye-hand timing",                     time: "2 min", tags: ["coordination","timing"] },
  { id: "shoulder-circles", name: "Shoulder circles",       focus: "Warm shoulder joint deeply",          time: "1 min", tags: ["shoulders","warmup"] },
  { id: "windmill",         name: "Windmill",               focus: "Shoulder + thoracic full rotation",   time: "2 min", tags: ["shoulders","spine","rotation"] },
  { id: "cross-over",       name: "Cross-over wrap",        focus: "Coordination, contralateral pattern", time: "2 min", tags: ["coordination","advanced"] },
  { id: "infinity",         name: "Infinity loop",          focus: "Smooth transitions",                  time: "3 min", tags: ["flow","intermediate"] },
  { id: "neck-isolation",   name: "Neck isolation",         focus: "Neck mobility — be GENTLE",           time: "1 min", tags: ["neck","mobility","gentle"] },
  { id: "hip-swing",        name: "Hip swing pass",         focus: "Hip rotation timing",                 time: "2 min", tags: ["hips","rotation","timing"] },
  { id: "low-loop",         name: "Low loop",               focus: "Glute activation while flowing",      time: "2 min", tags: ["glutes","balance"] },
  { id: "warrior-flow",     name: "Warrior flow",           focus: "Lunge transitions with rope",         time: "3 min", tags: ["legs","flow","advanced"] },
  { id: "balance-1leg",     name: "Single-leg balance flow", focus: "Static balance + rope control",      time: "2 min/leg", tags: ["balance","advanced","unilateral"] },
  { id: "speed-rounds",     name: "Speed rounds",           focus: "Cardio + coordination at pace",       time: "4 × 30 sec", tags: ["cardio","conditioning"] },
  { id: "cool-down-flow",   name: "Cool-down free flow",    focus: "Slow, mindful, breath-led",           time: "5 min", tags: ["flow","cooldown","breathing"] },
];

// Aggregated workout headers
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

// Legacy exports for back-compat
export const STRENGTH_WORKOUTS = STRENGTH_WORKOUTS_LIST.map(w => ({
  name: w,
  blocks: STRENGTH_EXERCISES.filter(e => e.workout === w).map(e => ({
    name: e.name, sets: e.sets, note: e.note,
  })),
}));
export const YOGA_WARMUP   = YOGA_POSES.filter(p => p.type === "Warm-up");
export const YOGA_RECOVERY = YOGA_POSES.filter(p => p.type === "Recovery");
