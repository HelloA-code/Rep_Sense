"""Clips → windows. Usage: python -m src.prepare [--synthetic]

Reads every clip in data/ (one per file, or an "Export all" bundle), converts any videos
in data/raw/ first, and saves data/processed/<dataset>.npz. Augmentation happens in
train.py, on training folds only: augmenting before splitting would leak test data.
"""

import argparse
import json
from collections import Counter
from pathlib import Path

import numpy as np

from .features import LABELS, NUM_FEATURES, WINDOW, clip_windows, mirror_order

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
PROCESSED_DIR = DATA_DIR / "processed"


def read_clips(path: Path) -> list[dict]:
    """A file holds one clip, or a bundle: {"clips": [...]}."""
    data = json.loads(path.read_text(encoding="utf-8"))
    return data["clips"] if "clips" in data else [data]


def load_clips(folder: Path) -> list[dict]:
    clips = []
    for path in sorted(folder.glob("*.json")):
        try:
            clips += read_clips(path)
        except (json.JSONDecodeError, KeyError, UnicodeDecodeError) as err:
            print(f"skipping {path.name}: {err}")
    return clips


def build_dataset(clips: list[dict]) -> dict[str, np.ndarray]:
    xs, ys, subjects, clip_ids = [], [], [], []
    for clip_id, clip in enumerate(clips):
        if clip["label"] not in LABELS or not clip["frames"]:
            continue
        frames = np.array([f["lm"] for f in clip["frames"]], dtype=np.float64)
        times = np.array([f["t"] for f in clip["frames"]], dtype=np.float64)
        windows = clip_windows(frames, times, clip["source"]["width"], clip["source"]["height"])
        if len(windows) == 0:
            continue
        xs.append(windows)
        ys.append(np.full(len(windows), LABELS.index(clip["label"]), dtype=np.int64))
        # Names are typed by hand: "Aditya " and "aditya" must be the same person, or
        # they could land on both sides of the split.
        subjects += [clip["subject"].strip().lower() or "anonymous"] * len(windows)
        clip_ids.append(np.full(len(windows), clip_id, dtype=np.int64))
    if not xs:
        return {
            "X": np.zeros((0, WINDOW, NUM_FEATURES), dtype=np.float32),
            "y": np.zeros(0, dtype=np.int64),
            "subjects": np.array([], dtype=str),
            "clips": np.zeros(0, dtype=np.int64),
        }
    return {"X": np.concatenate(xs), "y": np.concatenate(ys), "subjects": np.array(subjects), "clips": np.concatenate(clip_ids)}


_ORDER, _SIGN = mirror_order()
_COORDS = 2 * 13


def mirror(X: np.ndarray) -> np.ndarray:
    """A left-handed person doing the same exercise: swap left and right, flip x."""
    return X[..., _ORDER] * _SIGN


def jitter(X: np.ndarray, rng: np.random.Generator) -> np.ndarray:
    """Small per-window rotation and scale, plus per-frame noise, on coordinates only."""
    out = X.copy()
    n = len(X)
    theta = rng.uniform(-0.17, 0.17, n)  # about ±10°
    scale = rng.uniform(0.9, 1.1, n)
    cos, sin = np.cos(theta) * scale, np.sin(theta) * scale
    x, y = out[..., 0:_COORDS:2].copy(), out[..., 1:_COORDS:2].copy()
    c, s = cos[:, None, None], sin[:, None, None]
    out[..., 0:_COORDS:2] = c * x - s * y
    out[..., 1:_COORDS:2] = s * x + c * y
    out[..., :_COORDS] += rng.normal(0, 0.015, out[..., :_COORDS].shape)
    return out.astype(np.float32)


def augment(X: np.ndarray, y: np.ndarray, rng: np.random.Generator) -> tuple[np.ndarray, np.ndarray]:
    """Originals + mirrored + jittered copies of both: 4× the windows."""
    both = np.concatenate([X, mirror(X)])
    return np.concatenate([both, jitter(both, rng)]), np.tile(y, 4)


def dataset_name(synthetic: bool) -> str:
    return "synthetic" if synthetic else "real"


def convert_videos() -> None:
    raw = DATA_DIR / "raw"
    if not any(p.suffix.lower() in {".mp4", ".mov", ".webm", ".avi"} for p in raw.glob("*")):
        return
    from .extract_landmarks import convert_folder

    convert_folder(raw, DATA_DIR)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--synthetic", action="store_true", help="use the generated stick figures in data/synthetic")
    args = parser.parse_args()

    if args.synthetic:
        from .synthetic import OUT_DIR, generate

        print(f"generated {generate()} synthetic clips")
        clips = load_clips(OUT_DIR)
    else:
        convert_videos()
        clips = load_clips(DATA_DIR)

    data = build_dataset(clips)
    if len(data["y"]) == 0:
        raise SystemExit("No usable clips found. Put exported .json clips in ml/data/ (each needs at least 2 s of tracking).")

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    path = PROCESSED_DIR / f"{dataset_name(args.synthetic)}.npz"
    np.savez_compressed(path, **data)

    print(f"{len(clips)} clips -> {len(data['y'])} windows -> {path}")
    for label, n in sorted(Counter(LABELS[i] for i in data["y"]).items()):
        print(f"  {label:7} {n}")
    print(f"people: {sorted(set(data['subjects'].tolist()))}")


if __name__ == "__main__":
    main()
