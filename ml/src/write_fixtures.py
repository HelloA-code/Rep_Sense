"""Fixtures that keep Python and TypeScript honest. Usage: python -m src.write_fixtures

- web/lib/ml/__fixtures__/features_golden.json: a clip and the exact windows this code
  computes for it. Vitest asserts web/lib/ml/features.ts produces the same numbers.
- web/lib/workout/__fixtures__/synthetic_<exercise>.json: short clips with a known rep
  count, replayed through the rep counters as a regression test.
"""

import json
from pathlib import Path

import numpy as np

from .features import FEATURE_VERSION, NUM_FEATURES, WINDOW, clip_windows
from .synthetic import PREFERRED_VIEW, make_clip, random_body

WEB = Path(__file__).resolve().parents[2] / "web" / "lib"
REP_SECONDS = 2.5
REGRESSION_REPS = 4


def main() -> None:
    rng = np.random.default_rng(42)
    body = random_body(rng)

    clip = make_clip("squat", rng, body, "golden", "side", 4.5, fps=20.0, noise=2.0, gaps=False)
    # A tracking gap in the middle, so both sides must split the same way.
    kept = [f for f in clip["frames"] if not 2600 <= f["t"] < 3000]
    frames = np.array([f["lm"] for f in kept], dtype=np.float64)
    times = np.array([f["t"] for f in kept], dtype=np.float64)
    width, height = clip["source"]["width"], clip["source"]["height"]
    windows = clip_windows(frames, times, width, height)
    out = WEB / "ml" / "__fixtures__"
    out.mkdir(exist_ok=True, parents=True)
    (out / "features_golden.json").write_text(
        json.dumps(
            {
                "featureVersion": FEATURE_VERSION,
                "width": width,
                "height": height,
                "times": times.tolist(),
                "frames": frames[:, :, :2].round(4).tolist(),
                "windows": np.round(windows, 5).reshape(len(windows), WINDOW * NUM_FEATURES).tolist(),
            }
        )
    )

    out = WEB / "workout" / "__fixtures__"
    out.mkdir(exist_ok=True, parents=True)
    for label, view in PREFERRED_VIEW.items():
        if label == "idle":
            continue
        rep_period = REP_SECONDS
        seconds = rep_period * REGRESSION_REPS + 0.6
        clip = make_clip(label, rng, body, "synthetic", view, seconds, fps=15.0, noise=1.0, period=rep_period, gaps=False)
        clip["expectedReps"] = 0 if label == "plank" else REGRESSION_REPS
        (out / f"synthetic_{label}.json").write_text(json.dumps(clip, separators=(",", ":")))
    print("wrote fixtures")


if __name__ == "__main__":
    main()
