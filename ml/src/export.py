"""Trained model → ONNX for the browser. Usage: python -m src.export [--synthetic]

ONNX is a portable model format: PyTorch stays here, and the browser only needs
ONNX Runtime. The export is checked against PyTorch on real windows before it's used.
Quantisation stores weights as 8-bit integers, shrinking the file; it's kept only if
the predictions survive.
"""

import argparse
import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch
from onnxruntime.quantization import QuantType, quantize_dynamic
from torch import nn

from .features import NUM_FEATURES, RESAMPLE_HZ, STRIDE, WINDOW
from .prepare import PROCESSED_DIR, dataset_name
from .train import MODELS, ExerciseCNN

ROOT = Path(__file__).resolve().parents[1]
WEB_MODELS = ROOT.parent / "web" / "public" / "models"
WEB_FIXTURES = ROOT.parent / "web" / "lib" / "ml" / "__fixtures__"
OUT = WEB_MODELS / "exercise_classifier.onnx"
META = WEB_MODELS / "exercise_classifier.json"

MAX_PROB_DIFF = 1e-3
MAX_QUANT_DIFF = 0.05


class WithSoftmax(nn.Module):
    """The browser wants probabilities, for the confidence bar."""

    def __init__(self, model: nn.Module):
        super().__init__()
        self.model = model

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return torch.softmax(self.model(x), dim=1)


def run_onnx(path: Path, windows: np.ndarray) -> np.ndarray:
    session = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    return np.concatenate([session.run(None, {"input": w[None]})[0] for w in windows])


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--synthetic", action="store_true")
    args = parser.parse_args()
    suffix = "_synthetic" if args.synthetic else ""

    checkpoint_path = MODELS / f"exercise_cnn{suffix}.pt"
    if not checkpoint_path.exists():
        raise SystemExit(f"{checkpoint_path} not found. Run prepare and train first.")
    if args.synthetic and META.exists() and json.loads(META.read_text())["provenance"] == "real":
        raise SystemExit("Refusing to replace a model trained on real clips with the synthetic stand-in.")

    checkpoint = torch.load(checkpoint_path, weights_only=False)
    model = ExerciseCNN(checkpoint["mean"], checkpoint["std"])
    model.load_state_dict(checkpoint["state"])
    wrapped = WithSoftmax(model.eval()).eval()

    WEB_MODELS.mkdir(exist_ok=True, parents=True)
    torch.onnx.export(
        wrapped,
        (torch.zeros(1, WINDOW, NUM_FEATURES),),
        str(OUT),
        input_names=["input"],
        output_names=["probabilities"],
        opset_version=18,
        dynamo=True,
        external_data=False,
        verbose=False,  # its progress log has emoji that crash a Windows console
    )
    OUT.with_suffix(".onnx.data").unlink(missing_ok=True)

    data = np.load(PROCESSED_DIR / f"{dataset_name(args.synthetic)}.npz")
    rng = np.random.default_rng(0)
    samples = data["X"][rng.choice(len(data["X"]), size=min(64, len(data["X"])), replace=False)]
    with torch.no_grad():
        expected = wrapped(torch.as_tensor(samples)).numpy()
    diff = float(np.abs(run_onnx(OUT, samples) - expected).max())
    if diff > MAX_PROB_DIFF:
        OUT.unlink()
        raise SystemExit(f"ONNX output differs from PyTorch by {diff}: export rejected.")
    print(f"ONNX matches PyTorch on {len(samples)} windows (max difference {diff:.2e})")

    quantised = False
    quant_path = OUT.with_name("exercise_classifier.quant.onnx")
    try:
        quantize_dynamic(str(OUT), str(quant_path), weight_type=QuantType.QUInt8, op_types_to_quantize=["MatMul", "Gemm"])
        q = run_onnx(quant_path, samples)
        same = (q.argmax(1) == expected.argmax(1)).mean() == 1.0 and np.abs(q - expected).max() <= MAX_QUANT_DIFF
        smaller = quant_path.stat().st_size < OUT.stat().st_size
        print(f"quantised: {quant_path.stat().st_size / 1024:.0f} KB, predictions unchanged: {same}")
        if same and smaller:
            quant_path.replace(OUT)
            quantised = True
    except Exception as err:  # keep the working float model
        print(f"quantisation skipped: {err}")
    finally:
        quant_path.unlink(missing_ok=True)

    META.write_text(
        json.dumps(
            {
                **checkpoint["meta"],
                "window": WINDOW,
                "numFeatures": NUM_FEATURES,
                "hz": RESAMPLE_HZ,
                "stride": STRIDE,
                "quantised": quantised,
            },
            indent=2,
        )
    )

    # The browser must produce the same numbers: web/lib/ml/classifier.golden.json.
    WEB_FIXTURES.mkdir(exist_ok=True, parents=True)
    first = samples[:1]
    (WEB_FIXTURES / "model_golden.json").write_text(
        json.dumps({"input": np.round(first[0], 5).ravel().tolist(), "probabilities": run_onnx(OUT, first)[0].round(5).tolist()})
    )
    print(f"{OUT.stat().st_size / 1024:.0f} KB -> {OUT} ({checkpoint['meta']['provenance']})")


if __name__ == "__main__":
    main()
