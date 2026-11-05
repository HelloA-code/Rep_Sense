"""Train and evaluate both models. Usage: python -m src.train [--synthetic]

Random Forest = baseline: fast, and it can't see time order, only summary statistics.
1D-CNN = slides small filters along time, so it can learn the shape of a movement.
Every score comes from people (or clips) the model did not train on.
"""

import argparse
import json
import time
from datetime import date
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import torch
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score
from torch import nn

from .features import FEATURE_VERSION, LABELS, NUM_FEATURES, RESAMPLE_HZ, WINDOW
from .prepare import PROCESSED_DIR, augment, dataset_name
from .split import MIN_PEOPLE, make_folds

ROOT = Path(__file__).resolve().parents[1]
REPORTS = ROOT / "reports"
MODELS = ROOT / "models"

EPOCHS = 20
BATCH = 64
SEED = 6


class ExerciseCNN(nn.Module):
    """Input (batch, frames, features) → class scores.

    Normalisation lives inside the model as saved buffers, so the exported ONNX file
    is self-contained and the browser can't apply the wrong statistics.
    """

    def __init__(self, mean: np.ndarray, std: np.ndarray):
        super().__init__()
        self.register_buffer("mean", torch.as_tensor(mean, dtype=torch.float32))
        self.register_buffer("std", torch.as_tensor(std, dtype=torch.float32))
        self.net = nn.Sequential(
            nn.Conv1d(NUM_FEATURES, 32, 5, padding=2),
            nn.ReLU(),
            nn.MaxPool1d(2),
            nn.Conv1d(32, 64, 5, padding=2),
            nn.ReLU(),
            nn.MaxPool1d(2),
            nn.Conv1d(64, 64, 3, padding=1),
            nn.ReLU(),
            nn.AdaptiveAvgPool1d(1),
            nn.Flatten(),
            nn.Dropout(0.3),
            nn.Linear(64, len(LABELS)),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = (x - self.mean) / self.std
        return self.net(x.transpose(1, 2))


def fit_cnn(X: np.ndarray, y: np.ndarray) -> ExerciseCNN:
    torch.manual_seed(SEED)
    mean = X.mean(axis=(0, 1))
    std = X.std(axis=(0, 1)) + 1e-6
    model = ExerciseCNN(mean, std)

    # Rare classes count for more, so the model can't win by ignoring them.
    counts = np.bincount(y, minlength=len(LABELS)).astype(np.float32)
    weights = counts.sum() / np.maximum(counts, 1) / len(LABELS)
    loss_fn = nn.CrossEntropyLoss(weight=torch.as_tensor(weights))
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3, weight_decay=1e-4)

    xs, ys = torch.as_tensor(X), torch.as_tensor(y)
    model.train()
    for _ in range(EPOCHS):
        order = torch.randperm(len(xs))
        for start in range(0, len(xs), BATCH):
            batch = order[start : start + BATCH]
            optimizer.zero_grad()
            loss_fn(model(xs[batch]), ys[batch]).backward()
            optimizer.step()
    return model.eval()


@torch.no_grad()
def predict_cnn(model: ExerciseCNN, X: np.ndarray) -> np.ndarray:
    return torch.cat([model(torch.as_tensor(X[i : i + 512])).argmax(1) for i in range(0, len(X), 512)]).numpy()


def rf_features(X: np.ndarray) -> np.ndarray:
    """Mean, spread, min and max of each feature over the window."""
    return np.concatenate([X.mean(1), X.std(1), X.min(1), X.max(1)], axis=1)


def fit_rf(X: np.ndarray, y: np.ndarray) -> RandomForestClassifier:
    rf = RandomForestClassifier(n_estimators=200, class_weight="balanced", n_jobs=-1, random_state=SEED)
    return rf.fit(rf_features(X), y)


def evaluate(X, y, subjects, clips):
    """Out-of-fold predictions: each window is predicted by a model that never saw its person."""
    folds, method = make_folds(subjects, clips)
    rf_pred, cnn_pred = np.zeros_like(y), np.zeros_like(y)
    rng = np.random.default_rng(SEED)
    for k, (train, test) in enumerate(folds):
        rf_pred[test] = fit_rf(X[train], y[train]).predict(rf_features(X[test]))
        ax, ay = augment(X[train], y[train], rng)
        cnn_pred[test] = predict_cnn(fit_cnn(ax, ay), X[test])
        print(f"fold {k + 1}/{len(folds)}: RF {accuracy_score(y[test], rf_pred[test]):.3f}  CNN {accuracy_score(y[test], cnn_pred[test]):.3f}")
    return rf_pred, cnn_pred, method, len(folds)


def latency_ms(run, sample, repeats=200) -> float:
    """Median time for one window on this CPU."""
    times = []
    for _ in range(repeats):
        t = time.perf_counter()
        run(sample)
        times.append(time.perf_counter() - t)
    return float(np.median(times) * 1000)


def metrics(y, pred) -> dict:
    labels = list(range(len(LABELS)))
    return {
        "accuracy": accuracy_score(y, pred),
        "macro_f1": f1_score(y, pred, labels=labels, average="macro", zero_division=0),
        "per_class": f1_score(y, pred, labels=labels, average=None, zero_division=0),
        "confusion": confusion_matrix(y, pred, labels=labels),
    }


def plot_confusion(cm: np.ndarray, title: str, path: Path) -> None:
    rates = cm / np.maximum(cm.sum(axis=1, keepdims=True), 1)
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.imshow(rates, cmap="YlOrBr", vmin=0, vmax=1)
    ax.set_xticks(range(len(LABELS)), LABELS, rotation=45, ha="right")
    ax.set_yticks(range(len(LABELS)), LABELS)
    ax.set_xlabel("Predicted")
    ax.set_ylabel("True")
    ax.set_title(title)
    for i in range(len(LABELS)):
        for j in range(len(LABELS)):
            if cm[i, j]:
                ax.text(j, i, cm[i, j], ha="center", va="center", color="white" if rates[i, j] > 0.6 else "black", fontsize=8)
    fig.tight_layout()
    fig.savefig(path, dpi=130)
    plt.close(fig)


def confusion_table(cm: np.ndarray) -> str:
    head = "| true \\ predicted | " + " | ".join(LABELS) + " |\n|" + "---|" * (len(LABELS) + 1)
    rows = [f"| **{LABELS[i]}** | " + " | ".join(str(v) for v in cm[i]) + " |" for i in range(len(LABELS))]
    return "\n".join([head, *rows])


def write_report(path: Path, synthetic: bool, stats: dict, rf: dict, cnn: dict, rf_ms: float, cnn_ms: float, suffix: str) -> None:
    lines = [f"# {'Synthetic pipeline check' if synthetic else 'Exercise classifier results'}", ""]
    if synthetic:
        lines += [
            "> **Not a result.** These numbers come from generated stick figures, which move far more",
            "> cleanly than people. They only show that the pipeline runs. Don't quote them anywhere.",
            "",
        ]
    if stats["method"] != "person":
        lines += [
            f"> **Warning: fewer than {MIN_PEOPLE} people.** A person-wise split wasn't possible, so clips of the",
            "> same person are on both sides of the split and these scores are optimistic. Record more people.",
            "",
        ]
    lines += [
        f"Generated by `python -m src.train{' --synthetic' if synthetic else ''}` on {date.today().isoformat()}.",
        "",
        "## Dataset",
        "",
        f"- {stats['clips']} clips, {stats['windows']} windows, {stats['people']} people",
        f"- Windows: {WINDOW} frames at {RESAMPLE_HZ} Hz ({WINDOW / RESAMPLE_HZ:.0f} s), {NUM_FEATURES} features per frame",
        f"- Evaluation: {stats['folds']}-fold, split by {stats['method']}. Training folds are augmented; test folds never are.",
        "",
        "## Models",
        "",
        "| Model | Accuracy | Macro-F1 | Inference (one window, this CPU) |",
        "|---|---|---|---|",
        f"| Random Forest (baseline) | {rf['accuracy']:.3f} | {rf['macro_f1']:.3f} | {rf_ms:.2f} ms |",
        f"| 1D-CNN | {cnn['accuracy']:.3f} | {cnn['macro_f1']:.3f} | {cnn_ms:.2f} ms |",
        "",
        "## F1 per class",
        "",
        "| Class | Random Forest | 1D-CNN |",
        "|---|---|---|",
        *[f"| {LABELS[i]} | {rf['per_class'][i]:.3f} | {cnn['per_class'][i]:.3f} |" for i in range(len(LABELS))],
        "",
        "## Confusion matrix: 1D-CNN (windows)",
        "",
        f"![1D-CNN confusion matrix](confusion_cnn{suffix}.png)",
        "",
        confusion_table(cnn["confusion"]),
        "",
        "## Confusion matrix: Random Forest (windows)",
        "",
        f"![Random Forest confusion matrix](confusion_rf{suffix}.png)",
        "",
        confusion_table(rf["confusion"]),
        "",
        "## In the browser",
        "",
        "Measure on your phone with the camera debug panel (Auto on), then fill this in:",
        "",
        "| Device | Model inference | FPS with pose + model |",
        "|---|---|---|",
        "| | | |",
        "",
    ]
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--synthetic", action="store_true", help="use data/processed/synthetic.npz; reports are labelled as such")
    args = parser.parse_args()

    name = dataset_name(args.synthetic)
    path = PROCESSED_DIR / f"{name}.npz"
    if not path.exists():
        raise SystemExit(f"{path} not found. Run: python -m src.prepare{' --synthetic' if args.synthetic else ''}")
    data = np.load(path)
    X, y, subjects, clips = data["X"], data["y"], data["subjects"], data["clips"]
    missing = [LABELS[i] for i in range(len(LABELS)) if i not in y]
    if missing:
        print(f"WARNING: no clips for {missing}: the model can't learn these.")

    rf_pred, cnn_pred, method, folds = evaluate(X, y, subjects, clips)
    rf, cnn = metrics(y, rf_pred), metrics(y, cnn_pred)

    print("training the final model on all data...")
    ax, ay = augment(X, y, np.random.default_rng(SEED))
    model = fit_cnn(ax, ay)
    forest = fit_rf(X, y)

    sample = X[:1]
    cnn_ms = latency_ms(lambda s: predict_cnn(model, s), sample)
    forest.n_jobs = 1  # one window at a time, like the live app
    rf_ms = latency_ms(lambda s: forest.predict(rf_features(s)), sample, repeats=50)

    REPORTS.mkdir(exist_ok=True)
    suffix = "_synthetic" if args.synthetic else ""
    plot_confusion(cnn["confusion"], "1D-CNN", REPORTS / f"confusion_cnn{suffix}.png")
    plot_confusion(rf["confusion"], "Random Forest", REPORTS / f"confusion_rf{suffix}.png")
    stats = {
        "clips": len(np.unique(clips)),
        "windows": len(y),
        "people": len(np.unique(subjects)),
        "method": method,
        "folds": folds,
    }
    report = REPORTS / f"RESULTS{suffix}.md"
    write_report(report, args.synthetic, stats, rf, cnn, rf_ms, cnn_ms, suffix)

    MODELS.mkdir(exist_ok=True)
    torch.save(
        {
            "state": model.state_dict(),
            "mean": model.mean.numpy(),
            "std": model.std.numpy(),
            "meta": {
                "provenance": "synthetic" if args.synthetic else "real",
                "featureVersion": FEATURE_VERSION,
                "labels": LABELS,
                "macroF1": round(float(cnn["macro_f1"]), 3),
                "people": stats["people"],
                "split": method,
            },
        },
        MODELS / f"exercise_cnn{suffix}.pt",
    )
    print(json.dumps({"rf_macro_f1": round(rf["macro_f1"], 3), "cnn_macro_f1": round(cnn["macro_f1"], 3), "report": str(report)}))


if __name__ == "__main__":
    main()
