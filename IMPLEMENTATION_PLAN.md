# RepSense — AI Calisthenics Tracking System
### 8-Day Implementation Plan (for building with Claude Code)

> Working name: **RepSense**. Rename it if you like.
> Pace: about 6–8 focused hours a day. Each day has **one learning block (~1 hr)** where you understand the core idea yourself, and the rest is building with Claude Code.

---

## The strategy: what we keep and what we cut

To finish in 8 days and still stand out, the plan keeps the parts recruiters notice and cuts everything else.

**Kept (the resume-worthy core)**
- Pose estimation **running in the browser**: real-time, works on phone and laptop, and video never leaves the device.
- Rep counting with **smoothing + state machines** for all 6 exercises in the synopsis.
- Real-time **form feedback** (visual + voice).
- **Your own trained ML model** (exercise auto-detection) running in the browser.
- A polished landing page + workout history dashboard, **deployed live**.

**Cut or simplified**
- **No separate Python API server.** Supabase gives you auth + PostgreSQL directly from the frontend. Python is used where it matters: ML training.
- **One ML model, not two.** You train the exercise classifier; form checking stays rule-based (and that comparison is a good talking point).
- **Dropped:** offline video upload analysis, PWA, Web Workers, pricing page, stretch features. These are listed at the end as "future work", which also looks good in your report.

**The trick that makes Day 6 possible:** from Day 2 onwards, the app has a **"record landmarks" button** that saves body-landmark sequences (numbers only, no video) with an exercise label. Every time you test, you're also building your ML dataset.

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 (App Router) + TypeScript, Tailwind CSS, shadcn/ui, Framer Motion, Recharts |
| Computer vision | @mediapipe/tasks-vision (PoseLandmarker), Canvas 2D |
| Browser ML | onnxruntime-web |
| Auth + database | Supabase (Auth + PostgreSQL + Row Level Security) |
| ML training | Python, NumPy, Pandas, OpenCV, MediaPipe, scikit-learn, PyTorch, Jupyter |
| Deploy | Vercel (web), GitHub Actions (lint + tests) |

## Repository structure

```
repsense/
├── CLAUDE.md
├── IMPLEMENTATION_PLAN.md
├── DESIGN.md                 # UI spec: tokens, components, screens
├── docs/
│   ├── devlog.md             # 3–5 lines per day: built / learned / broke
│   └── design-reference/     # reference screenshots
├── web/
│   └── app/
│       ├── (marketing)/      # short landing page
│       ├── (app)/today|week|coach|history|profile|workout|onboarding
│       └── login/
├── web/
│   ├── components/{ui,marketing,onboarding,workout,history}/
│   ├── lib/
│   │   ├── pose/             # landmarker, geometry.ts, filters.ts
│   │   ├── exercises/        # one file per exercise: config + state machine + form rules
│   │   ├── ml/               # ONNX loading + inference
│   │   └── supabase/
│   └── public/models/        # pose_landmarker .task + your classifier .onnx
└── ml/
    ├── data/                 # recorded landmark JSON/CSV (+ any public dataset)
    ├── notebooks/
    ├── src/                  # prepare.py, train.py, export.py
    └── reports/              # metrics, confusion matrix, rep-count accuracy
```

---

## Day 1: Setup + design system + app shell + onboarding

The UI is a **mobile-first app** (dark, amber-yellow accent, glass cards). The full spec is in `DESIGN.md`, with reference screenshots in `docs/design-reference/`.

**Learn (1 hr):** how Next.js App Router works (layouts, route groups, server vs client components); Tailwind basics; CSS variables for design tokens.

**Build**
- Monorepo folders, git repo, Next.js + TypeScript + Tailwind + shadcn/ui, lucide-react, Framer Motion.
- **Design tokens** from DESIGN.md §2 as CSS variables + Tailwind theme.
- **Core components** from DESIGN.md §3: AppShell (with glows), TopBar (incl. progress variant), BottomTabBar (Today · Week · Coach · History · Profile), PrimaryButton, SecondaryButton, SelectTile, SegmentChip, OptionCard, Sheet. Build a `/dev/components` page that shows them all, so you can check the look in one place.
- **Onboarding flow** (goal → level → equipment grid with presets → body stats → camera tip), saved to localStorage for now (moved to Supabase on Day 5). Equipment decides which exercises are offered.
- Empty placeholder pages for each tab.
- **Short landing page** at `/`: hero with a phone mockup, 3 feature blocks, privacy note, "Open the app" CTA.
- **Deploy to Vercel today.**

**Prompt**
```
Read CLAUDE.md, IMPLEMENTATION_PLAN.md and DESIGN.md, and look at every image in
docs/design-reference/. We're on Day 1. Set up web/, implement the design tokens
and the core components from DESIGN.md §3 with a /dev/components preview page,
then the app shell with bottom tabs, the onboarding flow (match
01-onboarding-equipment.png closely in feel), and a short landing page.
Keep explanations short.
```
**Done when:** onboarding feels like a native app on your phone (open the Vercel link on mobile) and the components match the screenshots' feel.

---

## Day 2: Camera + pose estimation + data recorder

**Learn (1 hr):** what a pose model outputs (33 landmarks: x, y, z, visibility); normalised vs pixel coordinates; image vs world landmarks; the frame loop (`requestAnimationFrame`); why the selfie camera needs mirroring.

**Build**
- `/workout` page: webcam via `getUserMedia`, front/back camera switch, permission and error states.
- MediaPipe PoseLandmarker (lite model, GPU delegate, VIDEO mode).
- Skeleton drawn on a canvas overlay **styled like `05-live-camera.png`**: full-bleed camera, yellow lines, circle joints, close/flip buttons, centre `● REC · 0 REPS` pill. FPS + latency debug panel (toggle).
- "Body in frame" warning when key landmarks have low visibility ("Step back, I can't see your feet").
- **Landmark recorder:** pick a label (exercise name), press Record, and the app saves frames as JSON (download button for now). Start recording yourself doing each exercise today: 2–3 clips each, different angles.

**Prompt**
```
Day 2. Build the camera + PoseLandmarker pipeline in web/lib/pose and
web/components/workout, with skeleton overlay, FPS panel, body-in-frame warning,
and a landmark recorder that exports labelled JSON. Explain the frame loop and
coordinate systems first, briefly.
```
**Done when:** ≥ 25 FPS on your laptop, smooth skeleton, and the recorder exports files.

---

## Day 3: Angles, smoothing + rep counting (all 6 exercises)

**Learn (1 hr), and write these two yourself:**
- `angle(a, b, c)` = arccos((BA·BC) / (|BA|·|BC|)), from synopsis section 8.3.
- The squat state machine: `STANDING → DOWN → STANDING` with **hysteresis** (enter "down" below 90°, exit only above 160°) so jitter can't double-count.

**Build**
- `geometry.ts` (angle, distance, body-line deviation) + unit tests (Vitest).
- `filters.ts`: **One-Euro filter** on landmarks; show raw vs smoothed angle as a live mini-graph in the debug panel (great README screenshot).
- A generic `ExerciseStateMachine`; each exercise file only provides config (joints, thresholds, preferred camera view).
- All 6: squat (knee), push-up (elbow), pull-up (elbow + chin vs wrist height), dip (elbow), lunge (front knee), plank (timer that pauses when form breaks).
- Auto-pick left or right side by landmark visibility.
- Big animated rep counter, set timer, phase indicator.

**Prompt**
```
Day 3. I wrote angle() in geometry.ts and the squat state machine. Review both
and add Vitest tests. Then implement the One-Euro filter (explain min_cutoff and
beta), generalise my state machine, and add configs for the other 5 exercises.
```
**Done when:** squats and push-ups count correctly in your tests; all 6 exercises work. Keep recording landmark clips while testing.

---

## Day 4: Form analysis + feedback + workout flow

**Learn (1 hr):** turning coaching cues into rules; why camera angle changes which rules are valid.

**Build**
- Form rules per exercise (from synopsis 8.6), each returning `{ message, severity, joints }`:
  - push-up: hip sag/pike, shallow depth
  - squat: depth, knees caving, torso lean
  - lunge: front knee past ankle, torso upright
  - plank: hips sagging/raised
  - pull-up: full extension, chin over bar
  - dip: depth
- Feedback: **red ring** around the offending joint (as in `05-live-camera.png`), cue toast with cooldown, **voice cues** (Web Speech API) with mute.
- Per-rep form score (0–100).
- Flow: choose exercise (filtered by the user's equipment) → camera placement tip → 3-2-1 countdown → set → **set logging screen** like `06-set-logging-keypad.png` (page dots, `‹ Exercise ›`, "Set 2 of 3", huge number, Keypad, Done) to confirm reps and enter added load → **summary screen** (reps, good vs bad reps, avg score, duration, calories via MET × weight × time).
- **Test for your report:** record 5 short videos per exercise and compare app count vs manual count. Save results in `ml/reports/rep_counting.md`. This is a number for your resume.

**Prompt**
```
Day 4. Add form rules for all 6 exercises, red joint highlighting, cue toasts
with cooldown, voice feedback, per-rep form score, and the full workout flow
with a summary screen. Keep rules as pure functions with tests.
```
**Done when:** you can do a full workout end to end without login. **Record a 60-second demo now** (good for your review if it comes early).

---

## Day 5: Supabase auth + database + dashboard

**Learn (1 hr):** relational tables and foreign keys; how auth/JWT sessions work; what Row Level Security does (each user can only read their own rows).

**Build**
- Supabase project; email + Google login; protected `/workout` save and `/dashboard`.
- Tables: `profiles` (weight, height, goal), `workout_sessions`, `exercise_sets` (exercise, reps, duration, avg_form_score, calories, form_issues JSON). **Numbers only, never video.**
- RLS policies on every table.
- Add `checkins` table (sleep, energy, soreness) and move onboarding data (equipment, goal) into `profiles`.
- Save summary at the end of each set.
- **Today tab:** suggested session card, streak, "Start workout" button, mini weekly chart.
- **Pre-workout check-in** like `02-checkin-modal.png`: 3 quick questions, then simple rules suggest "Move day / Trim a third / Cut half (Recommended) / Keep full". The choice adjusts the session's sets.
- **Week + History tabs:** reps-per-day bar chart, form-score trend line, workout calendar, session list → session detail. Charts in accent yellow on dark.
- **Profile tab:** body stats, equipment (reopens grid), voice toggle, sign out.

**Prompt**
```
Day 5. Add Supabase auth (email + Google), the tables in the plan as a SQL
migration with RLS policies, and save workouts at set end. Then build the Today,
Week, History and Profile tabs and the pre-workout check-in sheet (see
02-checkin-modal.png and DESIGN.md §4). Explain RLS briefly.
```
**Done when:** workouts persist after logout/login and all tabs show real data.

---

## Day 6: Machine learning (train the exercise classifier)

**Learn (1.5 hrs, the most important learning block):** sliding windows over time-series; feature normalisation; train/test split **by person** (no data leakage); accuracy vs F1; reading a confusion matrix.

**Build** (in `ml/`, Python + Jupyter)
- **Data:** your recorded JSON clips (ask 2–3 friends to record too, for more body types), optionally topped up with a public workout video dataset from Kaggle (check the licence). For videos, `extract_landmarks.py` uses OpenCV + MediaPipe to convert them to the same landmark format.
- **Image processing / preprocessing:** normalise skeletons (centre on hips, scale by torso length), augment (mirror, small rotation, scale, jitter) to grow the dataset.
- Features: 30-frame windows of joint angles + normalised coordinates.
- **Model 1:** Random Forest (scikit-learn) as the baseline.
- **Model 2:** small 1D-CNN (PyTorch).
- Write `ml/reports/RESULTS.md`: accuracy, macro-F1, confusion matrix, inference time for both models.

**Prompt**
```
Day 6. In ml/, write prepare.py to load my recorded landmark JSON (and extract
landmarks from any videos in data/raw with OpenCV + MediaPipe), normalise and
augment, and build 30-frame windows. Then train a Random Forest baseline and a
small 1D-CNN with person-wise splits, and write RESULTS.md with metrics and
confusion matrices. Explain each step in 2–3 lines as you go.
```
**Done when:** you have a trained model with real metrics. Don't chase accuracy; 85%+ on your data is fine for 8 days.

---

## Day 7: ML in the browser + auto-detect

**Learn (1 hr):** what ONNX is; why running a model on-device helps privacy and latency; what quantisation does.

**Build**
- Export the better model to ONNX (`export.py`); check the output matches PyTorch on a few samples.
- `web/lib/ml/`: load with onnxruntime-web, run on the rolling 30-frame window every few frames.
- **"Just start moving" mode:** the app detects which exercise you're doing and switches the counter automatically; show the model's confidence bar.
- Measure in-browser inference time and FPS with the model on; add to RESULTS.md.
- Buffer day: fix anything left over from Days 1–6.
- **If time is left over** (in this order): Coach tab chat like `04-coach-chat.png` that answers questions from the user's stats with an LLM API (send numbers only) → simplified 2D pain map like `03-pain-map.png`. Otherwise, the Coach tab shows a styled "BETA, coming soon" empty state.

**Prompt**
```
Day 7. Export the best model to ONNX, verify outputs match, and run it in the
browser with onnxruntime-web on a rolling window. Add an auto-detect mode with a
confidence bar. Measure latency and FPS and add them to ml/reports/RESULTS.md.
```
**Done when:** auto-detect works live and pose + model together stay above ~20 FPS.

---

## Day 8: Polish, tests, deploy, README

**Build**
- Replace the hero placeholder with a real screen recording of the skeleton + rep counter.
- Regression test: replay a recorded landmark clip through each state machine and assert the rep count.
- GitHub Actions: lint + tests + build on every push.
- Mobile check, Lighthouse ≥ 90, SEO metadata + Open Graph image.
- **PWA manifest + icons** so it installs on a phone home screen and opens full-screen like a native app.
- **README (recruiters open this first):** hero GIF, live link, 90-second demo video, architecture diagram, "how it works" (angle formula, state machine, One-Euro plot), results table, privacy note, tech badges, setup steps.
- Update `docs/devlog.md` into a short project report for your college reviews.

**Prompt**
```
Day 8. Add replay-based regression tests for the state machines, a GitHub
Actions workflow, a Lighthouse/mobile polish pass, and write a strong README
using the numbers in ml/reports/. Include a Mermaid architecture diagram.
```
**Done when:** a stranger can open the link on their phone and count squats within 30 seconds.

---

## Future work (put in your report; build only if you return to this later)
Form-quality ML model vs rules comparison · offline video upload analysis (FastAPI + OpenCV) · PWA/mobile app · workout programs with progressive targets · AI weekly summary · handstand/L-sit skills.

---

## How to use Claude Code fast but still learn

1. Start every session with: *"Read CLAUDE.md and IMPLEMENTATION_PLAN.md. We're on Day N."*
2. Use **plan mode** at the start of each day, approve the plan, then let it build.
3. Do the learning block **before** building. Write `angle()` and the first state machine yourself (Day 3); everything else, let Claude Code write and you read.
4. Ask "why" when something isn't obvious, but don't rabbit-hole; note questions in the devlog for later.
5. Commit at the end of every day. Write 3–5 lines in `docs/devlog.md`.
6. If a day overruns, cut from that day's list rather than shifting everything. Day 7 has buffer.

---

## Resume bullets (fill in your real numbers)

- Built **RepSense**, a privacy-first AI calisthenics coach that tracks 6 exercises in real time **entirely in the browser** (MediaPipe + ONNX Runtime Web) at **~__ FPS**, with zero video upload.
- Implemented hysteresis-based **state-machine rep counters** with **One-Euro landmark smoothing**, reaching **__% rep-count accuracy** on __ test videos, plus rule-based form feedback with live voice cues.
- Trained a **1D-CNN exercise classifier** on __ landmark sequences with person-wise validation (**__% macro-F1** vs __% for a Random Forest baseline), deployed client-side with **__ ms** inference.
- Shipped a full-stack product (**Next.js, TypeScript, Supabase/PostgreSQL, GitHub Actions, Vercel**) with auth, workout history and an analytics dashboard.
