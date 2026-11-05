"""Draws docs/one-euro.png for the README: why smoothing needs to adapt to speed.
Usage: python -m src.plot_one_euro

A simulated joint held still, then moved quickly, with camera-like noise. Same filter
and settings as web/lib/pose/filters.ts. It illustrates the idea; it isn't a measurement.
"""

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

OUT = Path(__file__).resolve().parents[2] / "docs" / "one-euro.png"
MIN_CUTOFF, BETA, D_CUTOFF = 1.0, 10.0, 1.0
FPS = 30


def alpha(cutoff: float, dt: float) -> float:
    tau = 1 / (2 * np.pi * cutoff)
    return 1 / (1 + tau / dt)


def one_euro(signal: np.ndarray) -> np.ndarray:
    dt = 1 / FPS
    out = np.zeros_like(signal)
    out[0] = signal[0]
    dx = 0.0
    for i in range(1, len(signal)):
        a_d = alpha(D_CUTOFF, dt)
        dx = a_d * (signal[i] - out[i - 1]) / dt + (1 - a_d) * dx
        a = alpha(MIN_CUTOFF + BETA * abs(dx), dt)
        out[i] = a * signal[i] + (1 - a) * out[i - 1]
    return out


def fixed_low_pass(signal: np.ndarray, cutoff: float) -> np.ndarray:
    out = np.zeros_like(signal)
    out[0] = signal[0]
    a = alpha(cutoff, 1 / FPS)
    for i in range(1, len(signal)):
        out[i] = a * signal[i] + (1 - a) * out[i - 1]
    return out


def main() -> None:
    t = np.arange(0, 5, 1 / FPS)
    truth = 0.5 + 0.25 * (0.5 - 0.5 * np.cos(np.pi * np.clip((t - 2) / 0.5, 0, 1)))
    noisy = truth + np.random.default_rng(3).normal(0, 0.006, len(t))

    fig, ax = plt.subplots(figsize=(8, 3.6), facecolor="#000")
    ax.set_facecolor("#000")
    ax.plot(t, noisy, color="#666", lw=1, label="Raw landmark (jitter)")
    ax.plot(t, fixed_low_pass(noisy, MIN_CUTOFF), color="#5aa9ff", lw=1.5, label="Fixed smoothing (lags on fast moves)")
    ax.plot(t, one_euro(noisy), color="#FFC53D", lw=2.2, label="One-Euro (steady when still, quick when moving)")
    ax.set_xlabel("Seconds", color="#aaa")
    ax.set_ylabel("Position", color="#aaa")
    ax.tick_params(colors="#888")
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_color("#444")
    legend = ax.legend(frameon=False, loc="upper left")
    for text in legend.get_texts():
        text.set_color("#ddd")
    fig.tight_layout()
    OUT.parent.mkdir(exist_ok=True)
    fig.savefig(OUT, dpi=140, facecolor="#000")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
