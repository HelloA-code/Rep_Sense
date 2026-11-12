# ml/

Dataset preparation and training for the exercise classifier. Python 3.11+.

```
ml/
├── data/        # your clips (*.json) and raw videos; gitignored, they describe real people
├── src/         # features, prepare, train, export
├── tests/       # pytest
├── models/      # trained checkpoints (gitignored)
└── reports/     # metrics, confusion matrices, rep-count accuracy
```

## Quick start

```bash
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu
```

1. In the app, record clips and tap **Export all** (Profile → Recorded clips). Put the file in `ml/data/`.
   Aim for 3+ people, with several clips of every exercise and of `idle`.
2. Build the dataset, train both models and write `reports/RESULTS.md`:

```bash
.venv/Scripts/python -m src.prepare
.venv/Scripts/python -m src.train
```

3. Export to the web app (replaces the stand-in model):

```bash
.venv/Scripts/python -m src.export
```

Videos work too: `pip install -r requirements-video.txt`, then put them in `data/raw/` named
`<label>_<front|side>_<subject>_<anything>.mp4`. `prepare` converts them with the same pose model
as the app.

**Synthetic data:** `--synthetic` on each command uses generated stick figures. That only checks
that the pipeline runs: results go to `reports/RESULTS_synthetic.md`, never `RESULTS.md`, and
aren't real measurements.

Features are defined in `src/features.py` and mirrored in `web/lib/ml/features.ts`. Change both
together, bump `FEATURE_VERSION`, and regenerate the fixture with `python -m src.write_fixtures`.

## Landmark recording format (v1)

The web recorder (`/workout`, red button) downloads one JSON file per clip. Videos
converted with `extract_landmarks.py` must produce the **same** format. The source of
truth for the TypeScript side is `web/lib/recording/format.ts`; change both together
and bump `version` if the shape changes.

Clips are saved inside the app (IndexedDB, Profile → Recorded clips) after you watch
them back. Export one clip, or **Export all** to get a bundle file:

- Single clip: `repsense_<label>_<view>_<subject>_<YYYYMMDD-HHMMSS>.json` (UTC), shape below.
- Bundle: `repsense_clips_<YYYYMMDD-HHMMSS>.json` = `{ "version": 1, "exportedAt": "...", "clips": [<clip>, ...] }`.
  `prepare.py` should accept both (a top-level `clips` key means bundle).

```jsonc
{
  "version": 1,
  "label": "squat",            // any id from web/lib/exercises/catalog.ts, or idle (training uses LABELS in src/features.py; others are skipped)
  "subject": "aditya",         // who is in the clip; split train/test BY THIS (no person in both)
  "view": "side",              // front | side: camera angle relative to the person
  "createdAt": "2026-11-01T14:25:30.000Z",
  "durationMs": 18432,
  "frameCount": 547,
  "fpsAvg": 29.7,
  "source": { "facing": "user", "width": 1280, "height": 720 },
  "frames": [
    {
      "t": 0,                                  // ms since recording start
      "lm": [[0.5123, 0.2311, -0.4102, 0.9987], "... 33 rows"],
      "world": [[0.0213, -0.6011, -0.1532], "... 33 rows"]   // or null
    }
  ]
}
```

- **`lm`**: 33 × `[x, y, z, visibility]`, MediaPipe *image* landmarks. `x`, `y` are
  normalised 0–1 by frame width/height, origin top-left. `z` is relative depth on
  roughly the same scale as `x` (smaller = closer). Values can fall slightly outside
  0–1 when a joint is out of frame. Use `visibility` to filter those.
- **`world`**: 33 × `[x, y, z]` in metres with the origin between the hips. Independent
  of camera distance, so it's usually the better input for the classifier.
- **Not mirrored.** Coordinates are the raw camera image, even though the selfie
  view is mirrored on screen. To augment with mirroring, flip `x` (`1 - x` for `lm`,
  `-x` for `world`) **and** swap left/right landmark indices.
- **Only frames with a detected pose are stored.** Gaps in `t` mean the person was
  lost. Don't assume a constant frame rate; resample on `t` if you need one.
- Values are rounded to 4 decimals. Clips are capped at 60 s.

Landmark indices follow MediaPipe Pose (0 nose, 11/12 shoulders, 13/14 elbows,
15/16 wrists, 23/24 hips, 25/26 knees, 27/28 ankles, …). The full name list is
`LANDMARK_NAMES` in `web/lib/pose/landmarks.ts`. "Left" means the person's left.

## Recording tips

- 2–3 clips per exercise per person, from both front and side views where it makes sense.
- Record some `idle` too (standing, walking, resting between sets); the classifier needs a "not exercising" class.
- Put your name in the "Who" field every time. Ask friends to record with their own name.
