# RepSense: Phase 2 Implementation Plan
### More exercises + stronger machine learning (6 steps)

> Read this first, then we build it step by step. Each step starts in plan mode, like the 8 days did.
> Status: **not started.** Written on 11 Nov 2026. Updated 11 Nov 2026: Teach a rep moved to Step 2, and gym machines are now camera-first instead of log-only.

---

## Do I need to train the 1D-CNN on real clips first?

**No. You can do Steps 1, 2, 3, 5 and 6 now, and train on real clips later.**

| Step | Needs real clips? | Why |
|---|---|---|
| 1. Movement families | ❌ No | Rep counting and form rules use joint angles, not the trained model |
| 2. Teach a rep | ❌ No | Works from the user's own 3 reps, live, with no training |
| 3. Full exercise library | ❌ No | Library data, family presets, Teach a rep and manual logging; no model involved |
| 4. Real clips + training | ✅ This *is* the real-clips step | Yours, whenever friends can record |
| 5. Few-shot model + ST-GCN | ⚠️ Code: no. **Real results: yes** | Built and tested on synthetic data now; real numbers once Step 4 happens |
| 6. Rhythm counter + ML form | ⚠️ Code: no. **Real results: yes** | Same: build now, measure on real clips later |

What changes until you train on real clips:
- **Auto-detect keeps recognising only the original 6 exercises** (plus idle), with the "Preview" badge. New exercises are picked by hand or taught, which works fine.
- **Reports stay honest:** anything measured on synthetic data goes in `*_synthetic.md` files, never in the README or resume.

**Tip:** do Step 4 *after* Step 1, so your friends record the new exercises too. More classes, same effort.

---

## The big picture

```
 Step 1  Movement families ──► Step 2  Teach a rep ──► Step 3  Full library (150+)
                                                       (machines: family preset
                                                        or "tap to teach")
              │
 Step 4  Real clips (you, anytime) ──► real numbers for Steps 5 and 6
              │
 Step 5  Few-shot "fingerprint" model + ST-GCN comparison
              │
 Step 6  Rhythm counter + ML form vs rules
```

**Rules that don't change:**
- Calories and macros never come from AI.
- Video never leaves the device.
- No invented results.
- Every step ships with tests.

---

## Step 1: Movement families (data-driven exercises)

**Goal:** adding an exercise = filling in data, not writing code. Ship about **40 camera-tracked exercises**.
**Effort:** 2–3 days.

### Design
- **9 families**, each written once in `web/lib/exercises/families/`:
  squat · hinge · lunge · push (forward) · push (overhead) · pull (rows) · pull (from above) · single-joint · hold.
- **Each family defines:**
  - how to measure (which joint angle, and on which side);
  - the counter (the existing `createRepCounter`, or the hold timer);
  - which form rules it may use, from a shared rule library.
- **Each exercise becomes data:**
  ```ts
  { id: "bulgarian-split-squat", name: "Bulgarian split squat", family: "lunge",
    thresholds: { downBelow: 100, upAbove: 155 }, view: "side",
    rules: ["torso-upright", "knee-over-toe"], equipment: ["bench"],
    tracking: "camera" }
  ```
- **The rule library** (`web/lib/exercises/rules/`) keeps today's rules (hip sag/pike, knees caving, torso lean, knee past toes) and adds:
  - back angle (hinges)
  - elbow flare (push-ups)
  - full range (curls)
  - shoulder shrug (raises)
  - lockout (presses)
- **The 6 existing exercises are rewritten as data.** Their behaviour must not change: today's replay regression tests guard this.

### Changes elsewhere
- **Exercise ids** become a string from the catalog, not a fixed list of 6. Affected:
  - the files that use `ExerciseId`: `equipment.ts`, `calories.ts`, `suggest.ts`, `checkin.ts`, `summary.ts`, the workout picker / flow / camera / logger, and `auto-detect.ts`.
- **Database:** migration `0003_exercise_catalog.sql` replaces the fixed list of 6 exercise names with a length check. The app validates names against the catalog.
- **Equipment list** adds barbell, cable machine, machines, EZ bar and a pull-up assist band. Onboarding presets are updated.
- **Calories:** MET values per family instead of per exercise (Compendium of Physical Activities).

### Exercises in this step (~40, all camera-tracked)
| Family | Exercises |
|---|---|
| Squat | Squat, goblet squat, sumo squat, jump squat, box squat, pistol (assisted), wall sit* |
| Hinge | Romanian deadlift, deadlift, good morning, glute bridge, hip thrust, kettlebell swing |
| Lunge | Lunge, reverse lunge, walking lunge, Bulgarian split squat, step-up, lateral lunge |
| Push (forward) | Push-up, knee push-up, incline push-up, decline push-up, diamond push-up, dip, bench dip |
| Push (overhead) | Pike push-up, overhead press, Arnold press |
| Pull (rows) | Inverted row, dumbbell row, band row |
| Pull (from above) | Pull-up, chin-up, negative pull-up |
| Single joint | Bicep curl, hammer curl, lateral raise, front raise, tricep extension, calf raise |
| Hold | Plank, side plank, hollow hold, L-sit, dead hang, wall sit* |

\*Wall sit is a hold.

### Tests
- Every family passes a synthetic replay test: N reps in, N counted.
- The 6 original exercises still pass their existing regression tests unchanged.
- Data validation: every exercise has a valid family, thresholds (down < up), view and rules.

**Done when:** 40 exercises can be picked, counted and form-checked; old workouts and history still display; all tests pass.

---

## Step 2: Teach a rep (custom exercises + gym machines)

**Goal:** the app learns any repetitive exercise from 3 reps, with no coding and no training. This is also **how most gym machines get camera tracking**, which is why it comes before the library.
**Effort:** 1–2 days.

### How it works
1. The user taps **"Teach a new exercise"** (or **"Tap to teach"** on a library exercise in Step 3) and does **3 reps** on camera (a few seconds).
2. The app tracks **10 signals** through the recording:
   - **8 joint angles:** elbows, shoulders, hips and knees, on both sides;
   - **2 spreads:** the wrist-to-wrist and knee-to-knee distance, divided by shoulder width so it doesn't depend on camera distance. These cover machines where the joints barely bend but the limbs open and close (pec deck, cable crossover, hip abductor / adductor).
3. It picks **the signal that moves the most, in a clean up-down rhythm** (largest range, and repeats about 3 times). For a curl, that's the elbow; for a pec deck, the wrist spread.
4. It sets thresholds from that signal's own range: down near the bottom 30%, up near the top 25%, with a margin so jitter can't double-count.
5. It saves it as a **custom exercise** (name, signal, thresholds, view) in Supabase. From then on it counts like any built-in one.

### Lost-tracking fallback (all camera exercises, not just taught ones)
- Machines, benches and other people can hide joints. If the tracked joints are **not visible for about 2 seconds**, the set switches to a **manual rep counter** (big + / − buttons) with a short "Camera lost you, counting by hand" note.
- Reps counted before the switch are kept; the set is marked "partly manual", so History never shows a wrong number as camera-counted.
- If tracking keeps failing on an exercise, the app suggests "Log this one by hand next time".

### Pieces
- `web/lib/exercises/teach.ts` (pure): signal traces → best signal, range and thresholds, plus a "confidence".
- `web/lib/pose/visibility.ts` (pure): decides when tracking is lost or back, with a short delay so a single bad frame doesn't trigger it.
- **It refuses with a helpful message** when nothing repeats clearly ("Try 3 slow, full reps").
- **Database:** migration `0004` adds `custom_exercises` (RLS, owner-only).
- **UI:** a teach flow (placement tip → record → preview of the detected joint on the skeleton → name it → save).

### Tests
- Synthetic recordings for curl, squat, lateral raise and pec deck (spread): the right signal is picked and thresholds are sensible.
- Noise and no-movement recordings are rejected.
- Taught thresholds count the same synthetic reps correctly.
- Visibility: hidden joints for 2 s switch to manual; one bad frame doesn't; counted reps are kept.

**Done when:** you can teach a bicep curl in under 30 seconds and it counts correctly, and a set falls back to manual counting when the joints are hidden.

---

## Step 3: Full exercise library (150+ exercises)

**Goal:** a complete gym + calisthenics app. Machines are **camera first, manual log as fallback.**
**Effort:** 1–2 days.

### Design
- **Source:** [free-exercise-db](https://github.com/yuhonas/free-exercise-db), about 800 exercises with instructions, target muscles, equipment and level. **Licence: Unlicense (public domain)**, checked 11 Nov 2026.
- **Build script `ml/src/build_exercises.py`**, like `build_foods.py`. It:
  - picks about 150 common exercises;
  - maps each to our ids, family (if any), equipment and tracking level;
  - writes `web/lib/exercises/library.json`.
- **Four tracking levels**, shown as a badge on every exercise:
  - **📷 Camera:** counted and form-checked by a Step 1 family.
  - **📷💡 Camera + tip:** works with good placement (deadlift and rows from the side, for example).
  - **🎯 Teach:** do 3 reps once ("Tap to teach", from Step 2), then it counts. Taught once per user, then remembered.
  - **📝 Log only:** you enter reps and weight yourself. Only for exercises the camera honestly can't see.
- **Manual logging** reuses the existing keypad set logger: reps + load. **Weight is always typed**, since the camera can't see it.

### Gym machines and cables
**📷 Family presets (no teaching needed: the same body movement as a Step 1 family)**
| Machine exercise | Family | Joint watched |
|---|---|---|
| Lat pulldown, assisted pull-up machine | Pull (from above) | Elbow |
| Seated cable row, T-bar row | Pull (rows) | Elbow |
| Chest press machine | Push (forward) | Elbow |
| Shoulder press machine | Push (overhead) | Elbow |
| Assisted dip machine | Push (forward) | Elbow |
| Tricep pushdown, cable curl, preacher curl machine | Single joint | Elbow |
| Hack squat, Smith machine squat | Squat | Knee |

**🎯 Tap to teach**
| Machine exercise | Signal | Camera tip |
|---|---|---|
| Leg extension, seated leg curl | Knee angle | Side view |
| Pec deck, cable crossover | Wrist spread | Front view |
| Face pull, straight-arm pulldown | Shoulder / elbow angle | Side view |
| Cable lateral raise | Shoulder angle | Front view |
| Glute kickback machine | Hip angle | Side view |
| Hip abductor / adductor machine | Knee spread | Front view |

**📝 Log only (the camera can't see them reliably)**
| Machine exercise | Why |
|---|---|
| Leg press | Reclined; the machine hides the legs |
| Lying leg curl | Lying face down; landmarks are unreliable |
| Seated calf raise | Tiny ankle movement, hidden by the pad |

Free-weight lying exercises (bench press, dumbbell press, fly, skull crusher) start as 📝 too. If testing shows a low side camera works, they move up to 🎯.

### Camera placement tips
- Every camera exercise gets a **placement tip** on its detail sheet and before the set: view (front / side), distance (about 2–3 m) and height (about hip height).
- **Gym note:** the pose model tracks one person, the largest and closest. The tip says "Stand closest to the camera".

### UI
- The exercise picker gets **search, family filters, equipment filters, and "camera-tracked only"** (includes taught exercises).
- An **exercise detail sheet:** instructions, target muscles, equipment, tracking badge, placement tip, and a **Tap to teach** button for 🎯 exercises.
- **History and summary** show manual and partly-manual sets alongside tracked ones.

### Tests
- The build script fails if any exercise lacks equipment or a tracking level, or if a 📷 exercise lacks a family.
- Picker search and filter logic is unit-tested.
- A 🎯 exercise opens the teach flow the first time and counts with the taught thresholds after.
- A log-only set saves and appears in History.

**Done when:** about 150 exercises are searchable and every one can be logged; family-preset machines count automatically; Tap-to-teach machines count after one teach; only a handful stay log-only.

---

## Step 4: Real clips + training (yours, any time)

**Goal:** real accuracy numbers. This is your saved task, now covering the new exercises.
**Effort:** about 1–2 hours of recording per person, plus 10 minutes of training.

### Recording guide
- **People:** 3 or more (5+ is better), with different heights and builds.
- **Per person:** about 12 key exercises × 2 clips (front + side), 20–30 s each, plus 3 Idle clips.
- **Key exercises:** squat, push-up, pull-up, dip, lunge, plank, Romanian deadlift, glute bridge, pike push-up, inverted row, bicep curl, lateral raise.
- Include some **sloppy reps** (you'll want them for Step 6).
- **Optional for Step 6:** use "Label reps" (added in Step 6) to mark reps good or bad.

### Then
```bash
cd ml
.venv/Scripts/python -m src.prepare
.venv/Scripts/python -m src.train
.venv/Scripts/python -m src.export
```
→ Real `ml/reports/RESULTS.md`, the Preview badge disappears, and the real numbers go into the README and your resume.

---

## Step 5: Few-shot "fingerprint" model + model comparison

**Goal:** recognise new exercises from about 5 example clips **without retraining**, and compare architectures properly.
**Effort:** 3–4 days.

### Part A: Fingerprint (embedding) model
- **Idea:** train a network to turn 2 seconds of movement into a **64-number fingerprint**, with the same exercise close together and different exercises far apart.
- **Training:** *prototypical networks*. Each training step picks a few exercises, averages a few examples of each into a "prototype", and learns to place new examples nearest their own prototype.
- **Recognition in the app:** the average fingerprint of each exercise's examples is stored. A live window is matched to the nearest prototype, with a distance threshold for "unknown / idle".
- **New exercise:** record about 5 clips → store their prototype → done. This pairs with **Teach a rep** (the same 3–5 reps give the prototype).
- **Evaluation:** classes held out of training. Can it recognise exercises it **never trained on**, from 5 examples? This is the key result.

### Part B: Fair model comparison
- **Models** (`ml/src/models/`):
  - Random Forest (baseline)
  - 1D-CNN (current)
  - GRU
  - small Transformer
  - **ST-GCN**: a spatial-temporal graph network, the standard for skeleton action recognition; joints are graph nodes, bones are edges.
- **Fairness:** same data, same person-wise folds, same augmentations, several random seeds.
- **Results:** accuracy, macro-F1, model size, and in-browser speed in one table.
- **Experiment tracking:** MLflow (local, free). Every run is logged with its settings and scores.
- **Model card** `ml/reports/MODEL_CARD.md`: data, intended use, limits, who's under-represented.

### Changes in the app
- The ONNX export carries the fingerprint model and the stored prototypes.
- **Auto-detect works for every exercise that has examples**, including taught ones.
- **Inference moves to a Web Worker**, so the camera stays smooth.

### Tests
- Python: episodic sampling, prototype maths, and the unseen-class split never leaks.
- Browser: Python/TypeScript parity on the fingerprint (golden test, like today's).
- Synthetic run: the pipeline works end to end. **Real numbers wait for Step 4.**

**Done when:** a taught exercise is auto-detected; the comparison table is filled from synthetic data now and real data after Step 4.

---

## Step 6: Rhythm counter + ML form quality vs rules

**Goal:** research-style results. Does ML beat hand-written rules?
**Effort:** 2–3 days.

### Part A: Rhythm-based counter
- Counts reps from **how often the movement repeats** (autocorrelation over a sliding window). It needs **no thresholds**, so it works for any exercise.
- **Compared** against the threshold state machines on your recorded clips: count error per exercise, and failure cases.
- Can act as a **safety net:** if the two counters disagree a lot, show a "check your count" hint.

### Part B: Learned form quality
- **Labels:** a **"Label reps"** mode in the clip viewer. Each rep is marked good / bad (plus the issue) while watching your own video.
- **Model:** small classifier per family on rep windows → good/bad + issue.
- **Evaluation:** the same person-wise split. **ML vs rules** on accuracy, false alarms and missed faults.
- **Report** `ml/reports/FORM_ML_VS_RULES.md`, with honest results. If the rules win, that's still a valid finding.

### Tests
- The rhythm counter on synthetic clips at different speeds and with pauses.
- Label storage and the rep segmentation used for labelling.
- The form model pipeline runs on synthetic data.

**Done when:** both comparisons have reports. Synthetic now, real after Step 4 + labelling.

---

## Database changes (all with RLS, like before)

| Migration | Adds |
|---|---|
| `0003_exercise_catalog.sql` | Allows any catalog exercise id (length check instead of 6 fixed names) |
| `0004_custom_exercises.sql` | `custom_exercises` (owner-only), prototype storage for few-shot |
| `0005_rep_labels.sql` | Good/bad rep labels for form ML (numbers only, owner-only) |

Each is tested with the PGlite security tests before you run it.

---

## Suggested order and timeline

| Order | Step | Effort | You'll have… |
|---|---|---|---|
| 1 | Movement families, 40 exercises | 2–3 days | A real multi-exercise tracker |
| 2 | Teach a rep + lost-tracking fallback | 1–2 days | An app that learns any exercise, including machines |
| 3 | Full library, 150+ | 1–2 days | A complete gym + calisthenics app |
| 4 | Real clips + training (yours) | Anytime after Step 1 | Real numbers |
| 5 | Few-shot + model comparison | 3–4 days | The strongest ML story |
| 6 | Rhythm counter + ML form | 2–3 days | Research-style findings |

**Total for Steps 1–3, 5 and 6:** about 9–14 days of build time.
**If time is short:** do 1 → 2 → 3, then 4. Steps 5 and 6 are the "extra marks".

---

## Risks and how we handle them

| Risk | Plan |
|---|---|
| Some exercises can't be tracked reliably by one camera | "Log only" level, honest tracking badges, and the lost-tracking fallback to manual counting |
| Machines and other gym-goers block the view | Placement tips per exercise; "stand closest to the camera"; manual fallback after 2 s of lost tracking |
| Thresholds wrong for some people | Teach a rep doubles as personal calibration |
| Few-shot results weak on small data | Report honestly; still a strong learning outcome |
| Public datasets with restrictive licences | Use only our own clips plus clearly licensed data; check every licence |
| Bigger app gets slower | Lazy-load the library, Web Worker for models, keep Lighthouse checks |

---

## Resume lines this unlocks (fill with real numbers later)
- "Designed a data-driven exercise engine covering **__ exercises** across 9 movement families, with on-device rep counting and form checks."
- "Built **one-shot exercise learning** ('teach a rep') that auto-selects the moving joint and calibrates thresholds from 3 user reps."
- "Trained a **few-shot skeleton embedding model** (prototypical networks) recognising unseen exercises from 5 examples with **__% accuracy**; compared against ST-GCN, GRU, Transformer and 1D-CNN baselines with person-wise validation."
- "Showed **learned form assessment vs rule-based checks**: __ vs __ macro-F1 on __ labelled reps."
