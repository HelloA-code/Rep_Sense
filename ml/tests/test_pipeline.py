import numpy as np
import pytest

from src.features import (
    ANGLES,
    JOINTS,
    L_ELBOW,
    L_HIP,
    L_KNEE,
    L_SHOULDER,
    L_WRIST,
    LABELS,
    NUM_FEATURES,
    R_HIP,
    R_SHOULDER,
    STRIDE,
    WINDOW,
    clip_windows,
    frame_features,
    mirror_order,
    resample,
)
from src.prepare import augment, build_dataset, jitter, mirror, read_clips
from src.split import make_folds
from src.synthetic import POSES, make_clip, random_body


def pose(shift=(0.0, 0.0), zoom=1.0) -> np.ndarray:
    rng = np.random.default_rng(1)
    lm = rng.uniform(0.3, 0.7, (33, 4))
    lm[L_SHOULDER, :2] = [0.45, 0.3]
    lm[R_SHOULDER, :2] = [0.55, 0.3]
    lm[L_HIP, :2] = [0.47, 0.6]
    lm[R_HIP, :2] = [0.53, 0.6]
    lm[:, :2] = (lm[:, :2] - 0.5) * zoom + 0.5 + np.array(shift)
    return lm


def test_features_ignore_where_the_person_stands_and_how_close():
    base = frame_features(pose(), 1280, 720)
    assert base.shape == (NUM_FEATURES,)
    assert np.allclose(base, frame_features(pose(shift=(0.1, -0.05)), 1280, 720))
    assert np.allclose(base, frame_features(pose(zoom=0.6), 1280, 720))


def test_hips_are_the_origin():
    f = frame_features(pose(), 1280, 720)
    i, j = 2 * JOINTS.index(L_HIP), 2 * JOINTS.index(R_HIP)
    assert np.allclose(f[[i, j]], -f[[j, i]])


def test_angles_are_measured_in_pixels():
    lm = pose()
    lm[L_SHOULDER, :2] = [0.5, 0.2]
    lm[L_ELBOW, :2] = [0.5, 0.5]
    # 0.1 of the width equals 0.3 of the height on a 3:1 frame: 45° only in pixels.
    lm[L_WRIST, :2] = [0.6, 0.2]
    angles = frame_features(lm, 300, 100)[2 * len(JOINTS) :]
    assert angles[ANGLES.index((L_SHOULDER, L_ELBOW, L_WRIST))] == pytest.approx(0.25)


def test_degenerate_pose_doesnt_produce_nan():
    assert np.isfinite(frame_features(np.zeros((33, 4)), 1280, 720)).all()


def test_resample_holds_the_latest_frame_at_a_fixed_rate():
    runs = resample(np.arange(0, 1000, 33.0))
    assert len(runs) == 1
    assert len(runs[0]) == 15
    assert runs[0][:3] == [0, 2, 4]


def test_resample_is_independent_of_camera_fps():
    assert len(resample(np.arange(0, 2000, 33.0))[0]) == len(resample(np.arange(0, 2000, 66.0))[0])


def test_resample_splits_at_tracking_gaps():
    times = np.concatenate([np.arange(0, 1000, 33.0), np.arange(3000, 4000, 33.0)])
    runs = resample(times)
    assert len(runs) == 2
    assert all(times[a[-1]] < 1000 or times[a[0]] >= 3000 for a in runs)


def test_windows_never_cross_a_gap():
    t = np.concatenate([np.arange(0, 1500, 33.0), np.arange(5000, 6500, 33.0)])
    frames = np.stack([pose() for _ in t])
    assert len(clip_windows(frames, t, 1280, 720)) == 0  # each side is under 2 s


def test_window_shape_and_stride():
    t = np.arange(0, 3100, 33.0)
    w = clip_windows(np.stack([pose() for _ in t]), t, 1280, 720)
    assert w.shape[1:] == (WINDOW, NUM_FEATURES)
    assert len(w) == (46 - WINDOW) // STRIDE + 1


def test_mirroring_twice_is_the_identity():
    x = np.random.default_rng(0).normal(size=(2, WINDOW, NUM_FEATURES)).astype(np.float32)
    assert np.allclose(mirror(mirror(x)), x)


def test_mirror_matches_actually_mirroring_the_pose():
    lm = pose()
    flipped = lm.copy()
    flipped[:, 0] = 1 - flipped[:, 0]
    # Swap every left/right landmark pair (odd/even indices from 11 on).
    for left in range(11, 33, 2):
        flipped[[left, left + 1]] = flipped[[left + 1, left]]
    direct = frame_features(flipped, 1280, 720)
    order, sign = mirror_order()
    assert np.allclose(frame_features(lm, 1280, 720)[order] * sign, direct, atol=1e-6)


def test_jitter_keeps_angles_and_shape():
    x = np.random.default_rng(0).normal(size=(4, WINDOW, NUM_FEATURES)).astype(np.float32)
    out = jitter(x, np.random.default_rng(1))
    assert out.shape == x.shape
    assert np.allclose(out[..., 26:], x[..., 26:])
    assert not np.allclose(out[..., :26], x[..., :26])


def test_augment_labels_line_up():
    x = np.zeros((3, WINDOW, NUM_FEATURES), dtype=np.float32)
    y = np.array([0, 1, 2])
    ax, ay = augment(x, y, np.random.default_rng(0))
    assert len(ax) == 12
    assert ay.tolist() == [0, 1, 2] * 4


def test_bundles_and_single_clips_both_load(tmp_path):
    path = tmp_path / "bundle.json"
    path.write_text('{"version": 1, "exportedAt": "", "clips": [{"label": "squat"}, {"label": "dip"}]}')
    assert [c["label"] for c in read_clips(path)] == ["squat", "dip"]
    path.write_text('{"label": "plank"}')
    assert read_clips(path)[0]["label"] == "plank"


def synthetic(label, subject, seed=0):
    rng = np.random.default_rng(seed)
    return make_clip(label, rng, random_body(rng), subject, "side", 5.0, gaps=False)


def test_subject_names_are_normalised_and_labels_kept():
    data = build_dataset([synthetic("squat", " Aditya "), synthetic("dip", "aditya")])
    assert set(data["subjects"].tolist()) == {"aditya"}
    assert set(data["y"].tolist()) == {LABELS.index("squat"), LABELS.index("dip")}
    assert data["X"].dtype == np.float32


def test_too_short_or_unknown_clips_are_skipped():
    clip = synthetic("squat", "a")
    assert len(build_dataset([{**clip, "label": "yoga"}])["y"]) == 0
    assert len(build_dataset([{**clip, "frames": clip["frames"][:10]}])["y"]) == 0


@pytest.mark.parametrize("label", list(POSES))
def test_every_synthetic_exercise_produces_finite_windows(label):
    data = build_dataset([synthetic(label, "a")])
    assert len(data["y"]) > 0
    assert np.isfinite(data["X"]).all()


def test_person_wise_folds_never_share_a_person():
    groups = np.array(["a", "a", "b", "b", "c", "c", "d", "d"])
    clips = np.arange(8)
    folds, method = make_folds(groups, clips)
    assert method == "person"
    assert len(folds) == 4
    for train, test in folds:
        assert not set(groups[train]) & set(groups[test])
    assert sorted(np.concatenate([t for _, t in folds]).tolist()) == list(range(8))


def test_too_few_people_falls_back_to_clips_and_says_so():
    groups = np.array(["a"] * 6 + ["b"] * 2)
    clips = np.array([0, 0, 1, 1, 2, 2, 3, 3])
    folds, method = make_folds(groups, clips)
    assert method == "clip"
    for train, test in folds:
        assert not set(clips[train]) & set(clips[test])


def test_one_clip_cant_be_evaluated():
    with pytest.raises(SystemExit):
        make_folds(np.array(["a", "a"]), np.array([0, 0]))
