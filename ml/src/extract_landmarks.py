"""Videos → landmark clips in the recorder's JSON format.

Usage: put videos in data/raw/, named <label>_<view>_<subject>_<anything>.mp4, e.g.
squat_side_priya_01.mp4, then run: python -m src.extract_landmarks
Needs requirements-video.txt. Videos never leave your machine and are gitignored.
Uses the same pose model as the web app, so landmarks look the same to the classifier.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODEL = ROOT.parent / "web" / "public" / "models" / "pose_landmarker_lite.task"
VIDEO_TYPES = {".mp4", ".mov", ".webm", ".avi"}


def parse_name(path: Path) -> tuple[str, str, str] | None:
    parts = path.stem.split("_")
    if len(parts) < 3 or parts[1] not in ("front", "side"):
        return None
    return parts[0], parts[1], parts[2]


def video_to_clip(path: Path, label: str, view: str, subject: str) -> dict | None:
    import cv2
    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions
    from mediapipe.tasks.python.vision import PoseLandmarker, PoseLandmarkerOptions, RunningMode

    video = cv2.VideoCapture(str(path))
    if not video.isOpened():
        print(f"can't open {path.name}")
        return None
    fps = video.get(cv2.CAP_PROP_FPS) or 30.0
    width = int(video.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(video.get(cv2.CAP_PROP_FRAME_HEIGHT))

    options = PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=str(MODEL)),
        running_mode=RunningMode.VIDEO,
        num_poses=1,
    )
    frames = []
    with PoseLandmarker.create_from_options(options) as landmarker:
        index = 0
        while True:
            ok, bgr = video.read()
            if not ok:
                break
            t = int(index * 1000 / fps)
            index += 1
            image = mp.Image(image_format=mp.ImageFormat.SRGB, data=cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
            result = landmarker.detect_for_video(image, t)
            if not result.pose_landmarks:
                continue  # like the web recorder, only frames with a pose are stored
            lm = [[round(p.x, 4), round(p.y, 4), round(p.z, 4), round(p.visibility, 4)] for p in result.pose_landmarks[0]]
            frames.append({"t": t, "lm": lm, "world": None})
    video.release()
    if not frames:
        print(f"no person found in {path.name}")
        return None
    return {
        "version": 1,
        "label": label,
        "subject": subject,
        "view": view,
        "createdAt": "1970-01-01T00:00:00.000Z",
        "durationMs": frames[-1]["t"],
        "frameCount": len(frames),
        "fpsAvg": round(fps, 1),
        "source": {"facing": "environment", "width": width, "height": height},
        "frames": frames,
    }


def convert_folder(raw: Path, out: Path) -> int:
    done = 0
    for path in sorted(raw.iterdir()):
        if path.suffix.lower() not in VIDEO_TYPES:
            continue
        target = out / f"{path.stem}.json"
        if target.exists():
            continue
        parsed = parse_name(path)
        if not parsed:
            print(f"skipping {path.name}: name it <label>_<front|side>_<subject>_<anything>{path.suffix}")
            continue
        clip = video_to_clip(path, *parsed)
        if clip:
            target.write_text(json.dumps(clip))
            done += 1
            print(f"{path.name}: {clip['frameCount']} frames")
    return done


if __name__ == "__main__":
    print(f"converted {convert_folder(ROOT / 'data' / 'raw', ROOT / 'data')} videos")
