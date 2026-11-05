# RepSense: project report

## 1. Problem

Bodyweight training needs no equipment, but it's easy to train with poor form and hard to track progress without a coach. Existing camera-based tools usually send video to a server, which raises privacy and cost concerns.

RepSense explores a different approach: run all of the computer vision on the user's own device, in a web browser, so no install is needed and video never leaves the phone.

## 2. Objectives

1. Track six calisthenics exercises in real time in the browser.
2. Count reps reliably despite noisy pose estimates.
3. Give live form feedback, visually and by voice.
4. Train an exercise classifier and run it on-device.
5. Ship a complete product: accounts, history, analytics and a public deployment.

## 3. System design

The system has three parts.

**On-device pipeline (TypeScript, browser).** MediaPipe PoseLandmarker estimates 33 body landmarks per frame. A One-Euro filter smooths them. A per-exercise state machine counts reps from joint angles, and rule-based checks score form. ONNX Runtime Web runs the exercise classifier on a rolling window.

**Data layer (Supabase).** Authentication and PostgreSQL, with no custom backend. Row Level Security on every table enforces per-user access in the database itself. Only numbers are stored. Workouts go to a local outbox first and upload as idempotent upserts, so a lost connection doesn't lose a set.

**Training pipeline (Python).** Offline dataset preparation, model training and ONNX export.

The per-frame logic lives in one pure function with no browser dependency (`web/lib/workout/set-engine.ts`). The live camera, saved-clip replay and regression tests all drive that same code.

## 4. Methods

**Rep counting.** Joint angles come from the arccosine of the normalised dot product of two bone vectors. State machines use hysteresis (separate down and up thresholds) to prevent double counting, a minimum rep time to reject tracking glitches, and a halfway line that turns incomplete reps into feedback.

**Form analysis.** Rules are pure functions of the pose. Each declares the camera views where it's valid, since some faults can't be seen from some angles. The view is estimated from the ratio of shoulder width to torso length. An issue has to persist for 300 ms to count. Each rep starts at 100 and loses 35 for a major issue or 15 for a minor one.

**Exercise classification.** Clips are resampled to 15 Hz, normalised (centred on the hips, scaled by body size) and cut into 2-second windows of 34 features per frame. Augmentation (mirroring, small rotations, scaling, noise) is applied to training folds only. A Random Forest on window statistics is the baseline for a small 1D-CNN. Evaluation is by person, because overlapping windows from one person would otherwise appear on both sides of a split and inflate the score.

**Adaptive sessions.** A pre-workout check-in maps sleep, energy and soreness to a recommendation through simple rules, then reduces the session's sets.

## 5. Results

> Only real measurements belong in this section. Fill it in from `ml/reports/`.

| Measurement | Result | Source |
|---|---|---|
| Classifier macro-F1, Random Forest | ___ | `ml/reports/RESULTS.md` |
| Classifier macro-F1, 1D-CNN | ___ | `ml/reports/RESULTS.md` |
| Rep-count accuracy | ___ | `ml/reports/rep_counting.md` |
| FPS with pose and model, on a phone | ___ | Camera debug panel |
| Model inference on a phone | ___ | Camera debug panel |

**Measured so far (development laptop):**

- Lighthouse, mobile preset, local production build: landing page 96 / 100 / 100 / 100 (performance, accessibility, best practices, SEO); onboarding 94 / 100 / 100 / 100; login 95 / 100 / 100 / 100.
- The ONNX model in the browser matches Python to within 2e-11, with a median inference of 0.6 ms on this laptop.
- Row Level Security: 25 checks pass against a local Postgres with a stand-in auth schema, including one user being unable to read another's rows or attach a set to their session.

The currently deployed classifier was trained on synthetic stick figures to validate the pipeline. Its scores (`ml/reports/RESULTS_synthetic.md`) are not evidence of real-world accuracy.

## 6. Testing

- **Unit tests** cover geometry, filters, state machines, form rules, scoring, statistics and the upload queue.
- **Regression tests** replay clips with known rep counts through every exercise.
- **Parity tests** compare the Python and TypeScript features number by number.
- **ML tests** check that no person appears in both train and test, that windows never cross a tracking gap, and that mirroring is correct.
- **Label-scramble check:** with labels randomised, accuracy falls to chance, showing the evaluation has no leakage.
- **CI** runs lint, tests and a production build on every push.

## 7. Challenges

- **Two implementations of one feature definition.** Training in Python and inference in TypeScript can drift silently, so a golden fixture ties them together.
- **Variable frame rates.** Phones run at different speeds, so windows are built by time, not frame count.
- **Mid-upload races.** An early version of the outbox could overwrite a set logged during an upload. It now removes only rows it has confirmed sent.
- **Page weight.** The first Lighthouse run scored 72–76 for performance, because the landing page prefetched app bundles. Lazy loading raised it to 94–96.

## 8. Limitations

- Pose estimation accuracy limits everything downstream, especially for occluded limbs in side views.
- Thresholds were chosen from biomechanics and need tuning against real measurements.
- Form rules are heuristics, not medical or professional coaching advice.
- The calorie figure is a rough MET-based estimate.

## 9. Future work

Compare a form-quality ML model against the rules · offline video analysis · progressive workout programs · a coach chat that answers from the user's own stats · more skills, such as handstands and L-sits.
