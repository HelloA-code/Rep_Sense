"""The feature definition shared by training and the browser.

web/lib/ml/features.ts must match this exactly: a model only works on inputs built the
way its training data was. A golden test in Vitest compares the two number by number
(fixture written by `python -m src.write_fixtures`). Change both together and bump
FEATURE_VERSION.
"""

import numpy as np

FEATURE_VERSION = 1

LABELS = ["idle", "squat", "pushup", "pullup", "dip", "lunge", "plank"]

# 15 Hz, 30 frames = 2 s, enough to hold most of a rep. Resampling by time, not by frame
# count, keeps windows comparable whether the phone runs at 15 or 30 FPS.
RESAMPLE_HZ = 15
WINDOW = 30
STRIDE = 5
# Frames further apart than this mean the person was lost: don't window across the gap.
MAX_GAP_MS = 250

NOSE, L_SHOULDER, R_SHOULDER, L_ELBOW, R_ELBOW, L_WRIST, R_WRIST = 0, 11, 12, 13, 14, 15, 16
L_HIP, R_HIP, L_KNEE, R_KNEE, L_ANKLE, R_ANKLE = 23, 24, 25, 26, 27, 28

# Left/right pairs stay adjacent so mirroring is a simple swap.
JOINTS = [
    NOSE,
    L_SHOULDER, R_SHOULDER,
    L_ELBOW, R_ELBOW,
    L_WRIST, R_WRIST,
    L_HIP, R_HIP,
    L_KNEE, R_KNEE,
    L_ANKLE, R_ANKLE,
]
ANGLES = [
    (L_SHOULDER, L_ELBOW, L_WRIST), (R_SHOULDER, R_ELBOW, R_WRIST),  # elbows
    (L_ELBOW, L_SHOULDER, L_HIP), (R_ELBOW, R_SHOULDER, R_HIP),  # shoulders
    (L_SHOULDER, L_HIP, L_KNEE), (R_SHOULDER, R_HIP, R_KNEE),  # hips
    (L_HIP, L_KNEE, L_ANKLE), (R_HIP, R_KNEE, R_ANKLE),  # knees
]
NUM_FEATURES = 2 * len(JOINTS) + len(ANGLES)

COORD_LIMIT = 4.0


def frame_features(lm: np.ndarray, width: float, height: float) -> np.ndarray:
    """33×(x, y, …) normalised landmarks → one feature vector.

    Pixels first (x and y have different scales on a 16:9 frame), then centred on the
    hips and scaled by body size, so distance from the camera and position in the
    frame don't matter. Scale uses the larger of torso and shoulder width because the
    torso looks very short in a front-on push-up.
    """
    p = lm[:, :2] * np.array([width, height], dtype=np.float64)
    hips = (p[L_HIP] + p[R_HIP]) / 2
    shoulders = (p[L_SHOULDER] + p[R_SHOULDER]) / 2
    scale = max(np.linalg.norm(shoulders - hips), np.linalg.norm(p[L_SHOULDER] - p[R_SHOULDER]), 1e-6)
    coords = np.clip((p[JOINTS] - hips) / scale, -COORD_LIMIT, COORD_LIMIT)

    angles = []
    for a, b, c in ANGLES:
        ba, bc = p[a] - p[b], p[c] - p[b]
        lengths = np.linalg.norm(ba) * np.linalg.norm(bc)
        cos = 0.0 if lengths == 0 else np.clip(np.dot(ba, bc) / lengths, -1.0, 1.0)
        angles.append(np.arccos(cos) / np.pi)  # 0–1
    return np.concatenate([coords.ravel(), angles])


def resample(times: np.ndarray, step_ms: float = 1000 / RESAMPLE_HZ) -> list[list[int]]:
    """Frame indices at a fixed rate, split into runs wherever tracking was lost.

    Each tick takes the latest frame at or before it. Written frame by frame because
    that's how it works live: web/lib/ml/rolling-window.ts is the same loop.
    """
    runs: list[list[int]] = []
    run: list[int] = []
    tick = float(times[0])
    for i, t in enumerate(times):
        if i > 0 and t - times[i - 1] > MAX_GAP_MS:
            runs.append(run)
            run = []
            tick = float(t)
        while tick <= t:
            run.append(i if tick == t else i - 1)
            tick += step_ms
    runs.append(run)
    return [r for r in runs if r]


def clip_windows(frames: np.ndarray, times: np.ndarray, width: float, height: float) -> np.ndarray:
    """All overlapping windows in a clip: (n, WINDOW, NUM_FEATURES)."""
    if len(times) == 0:
        return np.zeros((0, WINDOW, NUM_FEATURES), dtype=np.float32)
    out = []
    for run in resample(times):
        if len(run) < WINDOW:
            continue
        features = np.stack([frame_features(frames[i], width, height) for i in run])
        for start in range(0, len(run) - WINDOW + 1, STRIDE):
            out.append(features[start : start + WINDOW])
    return np.array(out, dtype=np.float32).reshape(-1, WINDOW, NUM_FEATURES)


def mirror_order() -> tuple[np.ndarray, np.ndarray]:
    """Feature order after mirroring, and the sign to apply: left and right swap, x flips."""
    order = [0, 1]  # nose
    for i in range(1, len(JOINTS), 2):
        left, right = 2 * i, 2 * (i + 1)
        order += [right, right + 1, left, left + 1]
    first_angle = 2 * len(JOINTS)
    for i in range(0, len(ANGLES), 2):
        order += [first_angle + i + 1, first_angle + i]
    sign = np.ones(NUM_FEATURES, dtype=np.float32)
    sign[np.arange(0, 2 * len(JOINTS), 2)] = -1
    return np.array(order), sign
