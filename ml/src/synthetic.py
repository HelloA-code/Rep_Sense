"""Procedural stick figures performing each exercise, in the real recording format.

Purpose: prove the pipeline end to end and provide regression fixtures with known rep
counts. It is NOT training data for a real product: these bodies move far more
cleanly than people do, so any metric measured on them says nothing about real
accuracy and must never be reported as a result.
"""

import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .features import L_ANKLE, L_ELBOW, L_HIP, L_KNEE, L_SHOULDER, L_WRIST, LABELS, NOSE
from .features import R_ANKLE, R_ELBOW, R_HIP, R_KNEE, R_SHOULDER, R_WRIST

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data" / "synthetic"

SUBJECTS = 6
CLIPS_PER_CLASS = 2

# x = the person's left, y = up, z = forward, in metres.
UP = np.array([0.0, 1.0, 0.0])
FORWARD = np.array([0.0, 0.0, 1.0])
LEFT = np.array([1.0, 0.0, 0.0])


@dataclass
class Body:
    torso: float
    thigh: float
    shin: float
    upper_arm: float
    forearm: float
    shoulders: float
    hips: float
    head: float


def random_body(rng: np.random.Generator) -> Body:
    h = rng.uniform(1.55, 1.95)
    build = rng.uniform(0.9, 1.15)
    return Body(
        torso=0.29 * h,
        thigh=0.245 * h,
        shin=0.245 * h,
        upper_arm=0.17 * h,
        forearm=0.15 * h,
        shoulders=0.23 * h * build,
        hips=0.13 * h * build,
        head=0.13 * h,
    )


def ik(a: np.ndarray, c: np.ndarray, l1: float, l2: float, bend: np.ndarray) -> np.ndarray:
    """Middle joint of a two-link limb from a to c, bending towards `bend`."""
    d_vec = c - a
    d = np.linalg.norm(d_vec)
    d = np.clip(d, abs(l1 - l2) + 1e-4, l1 + l2 - 1e-4)
    axis = d_vec / max(np.linalg.norm(d_vec), 1e-6)
    along = (l1**2 - l2**2 + d**2) / (2 * d)
    out = bend - np.dot(bend, axis) * axis
    out = out / max(np.linalg.norm(out), 1e-6)
    return a + axis * along + out * np.sqrt(max(l1**2 - along**2, 0.0))


def limb_end(a: np.ndarray, l1: float, l2: float, elbow_deg: float, direction: np.ndarray) -> float:
    """Distance from a to the limb's end for a given middle-joint angle."""
    r = np.radians(elbow_deg)
    return float(np.sqrt(l1**2 + l2**2 - 2 * l1 * l2 * np.cos(r)))


def skeleton(b: Body, hip: np.ndarray, shoulder: np.ndarray, l_ankle, r_ankle, l_wrist, r_wrist, knee_bend, elbow_bend):
    """Named 3D joints from the key points; knees and elbows come from IK."""
    side = LEFT
    l_hip, r_hip = hip + side * b.hips / 2, hip - side * b.hips / 2
    l_sh, r_sh = shoulder + side * b.shoulders / 2, shoulder - side * b.shoulders / 2
    j = {
        L_HIP: l_hip, R_HIP: r_hip, L_SHOULDER: l_sh, R_SHOULDER: r_sh,
        L_ANKLE: l_ankle, R_ANKLE: r_ankle, L_WRIST: l_wrist, R_WRIST: r_wrist,
        L_KNEE: ik(l_hip, l_ankle, b.thigh, b.shin, knee_bend),
        R_KNEE: ik(r_hip, r_ankle, b.thigh, b.shin, knee_bend),
        L_ELBOW: ik(l_sh, l_wrist, b.upper_arm, b.forearm, elbow_bend[0]),
        R_ELBOW: ik(r_sh, r_wrist, b.upper_arm, b.forearm, elbow_bend[1]),
    }
    return j


def pose_squat(b: Body, p: float, depth: float):
    knee = 178 - p * (178 - depth)
    legs = b.thigh + b.shin
    drop = np.sqrt(max(b.thigh**2 + b.shin**2 - 2 * b.thigh * b.shin * np.cos(np.radians(knee)), 0.0))
    hip = UP * drop - FORWARD * (0.22 * p) + UP * (legs * 0.01)
    lean = np.radians(8 + 32 * p)
    shoulder = hip + (UP * np.cos(lean) + FORWARD * np.sin(lean)) * b.torso
    reach = FORWARD * (0.15 + 0.3 * p) + UP * (-0.3 + 0.2 * p)
    l_ankle, r_ankle = LEFT * 0.16, -LEFT * 0.16
    return skeleton(
        b, hip, shoulder, l_ankle, r_ankle,
        shoulder + LEFT * b.shoulders / 2 + reach, shoulder - LEFT * b.shoulders / 2 + reach,
        FORWARD + LEFT * 0.0, (-FORWARD, -FORWARD),
    )


def horizontal_body(b: Body, height_at_shoulder: float, sag: float = 0.0):
    length = b.torso + b.thigh + b.shin
    pitch = np.arcsin(np.clip(height_at_shoulder / length, 0, 0.9))
    along = FORWARD * np.cos(pitch) + UP * np.sin(pitch)
    ankle_mid = UP * 0.06
    hip = ankle_mid + along * (b.thigh + b.shin) - UP * sag
    shoulder = ankle_mid + along * length
    return ankle_mid, hip, shoulder


def pose_pushup(b: Body, p: float, depth: float):
    elbow = 170 - p * (170 - depth)
    reach = limb_end(np.zeros(3), b.upper_arm, b.forearm, elbow, UP)
    ankle_mid, hip, shoulder = horizontal_body(b, reach)
    wrists = [shoulder + s * LEFT * b.shoulders / 2 - UP * shoulder[1] for s in (1, -1)]
    l_ankle, r_ankle = ankle_mid + LEFT * 0.1, ankle_mid - LEFT * 0.1
    return skeleton(b, hip, shoulder, l_ankle, r_ankle, wrists[0], wrists[1], UP, (-FORWARD, -FORWARD))


def pose_plank(b: Body, p: float, depth: float):
    arm = (b.upper_arm + b.forearm) * 0.98
    ankle_mid, hip, shoulder = horizontal_body(b, arm + 0.01 * p, sag=0.01 * np.sin(p * 6))
    wrists = [shoulder + s * LEFT * b.shoulders / 2 - UP * shoulder[1] for s in (1, -1)]
    l_ankle, r_ankle = ankle_mid + LEFT * 0.1, ankle_mid - LEFT * 0.1
    return skeleton(b, hip, shoulder, l_ankle, r_ankle, wrists[0], wrists[1], UP, (-FORWARD, -FORWARD))


def pose_pullup(b: Body, p: float, depth: float):
    grip = b.shoulders / 2 + 0.2
    bar = UP * 2.2
    elbow = 170 - p * (170 - depth)
    reach = limb_end(np.zeros(3), b.upper_arm, b.forearm, elbow, UP)
    across = grip - b.shoulders / 2
    shoulder = bar - UP * np.sqrt(max(reach**2 - across**2, 0.0))
    hip = shoulder - UP * b.torso
    l_ankle = hip + LEFT * 0.08 - UP * (b.thigh + b.shin) * 0.97 - FORWARD * 0.05
    r_ankle = hip - LEFT * 0.08 - UP * (b.thigh + b.shin) * 0.97 - FORWARD * 0.05
    return skeleton(
        b, hip, shoulder, l_ankle, r_ankle, bar + LEFT * grip, bar - LEFT * grip, FORWARD,
        (LEFT - UP * 0.2, -LEFT - UP * 0.2),
    )


def pose_dip(b: Body, p: float, depth: float):
    elbow = 172 - p * (172 - depth)
    bars = UP * 1.1
    reach = limb_end(np.zeros(3), b.upper_arm, b.forearm, elbow, UP)
    shoulder = bars + UP * reach
    hip = shoulder - UP * b.torso * 0.98 - FORWARD * 0.05
    l_ankle = hip + LEFT * 0.08 - UP * (b.thigh + b.shin) * 0.8 - FORWARD * 0.35
    r_ankle = hip - LEFT * 0.08 - UP * (b.thigh + b.shin) * 0.8 - FORWARD * 0.35
    wrists = [bars + s * LEFT * b.shoulders / 2 for s in (1, -1)]
    return skeleton(b, hip, shoulder, l_ankle, r_ankle, wrists[0], wrists[1], FORWARD, (-FORWARD, -FORWARD))


def pose_lunge(b: Body, p: float, depth: float):
    stride = 0.34
    front = LEFT * 0.1 + FORWARD * stride
    back = -LEFT * 0.1 - FORWARD * stride + UP * 0.07
    legs = b.thigh + b.shin
    top = np.sqrt(max((legs * 0.99) ** 2 - stride**2, 0.1))
    knee = 172 - p * (172 - depth)
    bottom = np.sqrt(max(b.thigh**2 + b.shin**2 - 2 * b.thigh * b.shin * np.cos(np.radians(knee)), 0.0))
    # The hip sits over the middle, so solve its height from the front knee's target angle.
    height = float(np.sqrt(max(bottom**2 - stride**2, 0.01)))
    hip = UP * min(top, height) + UP * 0.0
    shoulder = hip + UP * b.torso
    hands = -UP * 0.3 + FORWARD * 0.05
    return skeleton(
        b, hip, shoulder, front, back,
        shoulder + LEFT * b.shoulders / 2 + hands, shoulder - LEFT * b.shoulders / 2 + hands,
        FORWARD, (-FORWARD, -FORWARD),
    )


def pose_idle(b: Body, p: float, depth: float):
    legs = b.thigh + b.shin
    step = np.sin(p * 2 * np.pi)
    hip = UP * (legs * 0.985) + LEFT * 0.03 * step
    shoulder = hip + UP * b.torso
    l_ankle = LEFT * 0.12 + FORWARD * 0.12 * step
    r_ankle = -LEFT * 0.12 - FORWARD * 0.12 * step
    swing = FORWARD * 0.15 * step - UP * (b.upper_arm + b.forearm) * 0.97
    return skeleton(
        b, hip, shoulder, l_ankle, r_ankle,
        shoulder + LEFT * b.shoulders / 2 - swing * [-1, 1, 1], shoulder - LEFT * b.shoulders / 2 + swing,
        FORWARD, (-FORWARD, -FORWARD),
    )


POSES = {
    "squat": (pose_squat, (68, 86)),
    "pushup": (pose_pushup, (62, 84)),
    "pullup": (pose_pullup, (28, 38)),
    "dip": (pose_dip, (70, 88)),
    "lunge": (pose_lunge, (78, 96)),
    "plank": (pose_plank, (0, 0)),
    "idle": (pose_idle, (0, 0)),
}
PREFERRED_VIEW = {
    "squat": "side", "pushup": "side", "pullup": "front", "dip": "side", "lunge": "side", "plank": "side", "idle": "front",
}


def rep_phase(t: float, period: float) -> float:
    """0 at the top, 1 at the bottom, with a pause at each end like a real rep."""
    u = (t % period) / period
    return float(np.clip((1 - np.cos(2 * np.pi * u)) / 2 * 1.15 - 0.05, 0, 1))


def project(joints: dict, yaw_deg: float, width: int, height: int, center: np.ndarray, zoom: float, rng, noise: float):
    """Camera view of the joints as 33 × [x, y, z, visibility], normalised like MediaPipe."""
    yaw = np.radians(yaw_deg)
    pts: dict[int, np.ndarray] = dict(joints)
    head = (joints[L_SHOULDER] + joints[R_SHOULDER]) / 2
    pts[NOSE] = head + UP * 0.2 + FORWARD * 0.05

    lm = np.zeros((33, 4))
    lm[:, 3] = 0.3
    near_is_left = np.sin(yaw) >= 0
    for i, q in pts.items():
        rel = q - center
        sx = rel[0] * np.cos(yaw) + rel[2] * np.sin(yaw)
        depth = -rel[0] * np.sin(yaw) + rel[2] * np.cos(yaw)
        lm[i, 0] = 0.5 + (sx * zoom + rng.normal(0, noise)) / width
        lm[i, 1] = 0.5 - (rel[1] * zoom + rng.normal(0, noise)) / height
        lm[i, 2] = -depth / 2
        is_left = i % 2 == 1
        hidden = abs(np.sin(yaw)) > 0.7 and is_left != near_is_left and i != NOSE
        lm[i, 3] = rng.uniform(0.25, 0.45) if hidden else rng.uniform(0.92, 0.99)
    return lm


def make_clip(label, rng, body, subject, view, seconds, width=1280, height=720, fps=30.0, noise=1.5, period=None, gaps=True):
    pose, depths = POSES[label]
    period = period if period is not None else float(rng.uniform(1.8, 3.4))
    depth = float(rng.uniform(*depths)) if depths[1] else 0.0
    yaw = (0.0 if view == "front" else rng.choice([-90.0, 90.0])) + rng.uniform(-10, 10)

    t_ms = 0.0
    frames = []
    pad = rng.uniform(0, 0.25) * period
    samples = [pose(body, rep_phase(i / 10, period) if label not in ("idle", "plank") else (i / 10 % period) / period, depth)
               for i in range(0, int(period * 10))]
    all_points = np.array([q for s in samples for q in s.values()])
    center = (all_points.min(axis=0) + all_points.max(axis=0)) / 2
    span = np.maximum(all_points.max(axis=0) - all_points.min(axis=0), 0.5)
    fit = min(0.75 * height / span[1], 0.8 * width / max(span[0], span[2]))
    gap_at = rng.uniform(0.3, 0.7) * seconds if gaps and rng.random() < 0.2 else None
    while t_ms / 1000 < seconds:
        t = t_ms / 1000 + pad
        p = rep_phase(t - pad, period) if label not in ("idle", "plank") else (t % period) / period
        if not (gap_at is not None and gap_at <= t_ms / 1000 < gap_at + 0.6):
            lm = project(pose(body, p, depth), yaw, width, height, center, fit, rng, noise)
            frames.append({"t": int(round(t_ms)), "lm": np.round(lm, 4).tolist(), "world": None})
        t_ms += 1000 / fps * float(rng.uniform(0.9, 1.1))

    return {
        "version": 1,
        "label": label,
        "subject": subject,
        "view": view,
        "createdAt": "2026-11-05T00:00:00.000Z",
        "durationMs": frames[-1]["t"],
        "frameCount": len(frames),
        "fpsAvg": fps,
        "source": {"facing": "environment", "width": width, "height": height},
        "frames": frames,
        "synthetic": True,
        "expectedReps": 0 if label in ("idle", "plank") else int((seconds - 0.01) // period),
    }


def generate(out_dir: Path = OUT_DIR, seed: int = 6) -> int:
    rng = np.random.default_rng(seed)
    out_dir.mkdir(parents=True, exist_ok=True)
    count = 0
    for s in range(SUBJECTS):
        body = random_body(rng)
        for label in LABELS:
            for c in range(CLIPS_PER_CLASS):
                view = PREFERRED_VIEW[label] if c == 0 else ("front" if PREFERRED_VIEW[label] == "side" else "side")
                landscape = rng.random() < 0.5
                clip = make_clip(
                    label, rng, body, f"synth-{s}", view, float(rng.uniform(10, 16)),
                    width=1280 if landscape else 720, height=720 if landscape else 1280,
                    fps=float(rng.choice([15.0, 24.0, 30.0])), noise=float(rng.uniform(1, 5)),
                )
                (out_dir / f"synth_{s}_{label}_{c}.json").write_text(json.dumps(clip))
                count += 1
    return count


if __name__ == "__main__":
    print(f"wrote {generate()} synthetic clips to {OUT_DIR}")
