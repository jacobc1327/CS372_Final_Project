#!/usr/bin/env python3
"""
Ordinary least squares (multivariate) fit for four simulation targets.
Trained labels come from the legacy `calculateMetrics` via export_training.ts.

Usage (from repo root):
  npx tsx evaluation/export_training.ts
  python3 evaluation/fit_ridge.py
"""
from __future__ import annotations

import csv
import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "evaluation" / "data" / "training.csv"
WEIGHTS_OUT = ROOT / "lib" / "ai" / "weights.json"


def main() -> None:
    if not CSV_PATH.is_file():
        raise SystemExit(f"Missing {CSV_PATH}; run export_training.ts first.")

    rows: list[list[float]] = []
    with CSV_PATH.open(newline="") as f:
        reader = csv.reader(f)
        header = next(reader)
        feature_names = header[:-4]
        for row in reader:
            rows.append([float(x) for x in row])

    mat = np.asarray(rows, dtype=np.float64)
    X = mat[:, :-4]
    Y = mat[:, -4:]
    ones = np.ones((len(X), 1))
    X_aug = np.hstack([X, ones])

    theta, *_ = np.linalg.lstsq(X_aug, Y, rcond=None)
    # theta shape: (n_features + 1, 4) — each column is one target

    target_keys = [
        "fatigueScore",
        "progressScore",
        "plateauRisk",
        "adherenceDifficulty",
    ]

    targets: dict = {}
    for j, key in enumerate(target_keys):
        col = theta[:, j]
        coef = col[:-1].tolist()
        intercept = float(col[-1])
        targets[key] = {"coef": coef, "intercept": intercept}

    doc = {
        "featureNames": feature_names,
        "targets": targets,
        "meta": {
            "fit": "numpy.linalg.lstsq on legacy simulator labels",
            "n_samples": len(rows),
        },
    }

    WEIGHTS_OUT.parent.mkdir(parents=True, exist_ok=True)
    WEIGHTS_OUT.write_text(json.dumps(doc, indent=2), encoding="utf-8")
    print(f"Wrote {WEIGHTS_OUT}")


if __name__ == "__main__":
    main()
