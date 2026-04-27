#!/usr/bin/env python3
"""
Evaluation script for ridge-style linear heads.

What it does:
- loads `evaluation/data/training.csv` produced by `export_training.ts`
- creates train/val/test split
- tunes ridge lambda over multiple configs (hyperparameter sweep)
- reports multiple metrics (MAE, RMSE, R^2) per target
- writes a JSON report to `evaluation/data/report.json`

Usage:
  npm run eval:export
  python3 evaluation/eval_ridge.py
"""

from __future__ import annotations

import csv
import json
import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
CSV_PATH = ROOT / "evaluation" / "data" / "training.csv"
REPORT_OUT = ROOT / "evaluation" / "data" / "report.json"
WEIGHTS_OUT = ROOT / "lib" / "ai" / "weights.json"

TARGET_KEYS = [
    "fatigueScore",
    "progressScore",
    "plateauRisk",
    "adherenceDifficulty",
]


def split_indices(n: int, seed: int = 372) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    idx = np.arange(n)
    rng.shuffle(idx)
    n_train = int(0.8 * n)
    n_val = int(0.1 * n)
    train = idx[:n_train]
    val = idx[n_train : n_train + n_val]
    test = idx[n_train + n_val :]
    return train, val, test


def ridge_fit(X: np.ndarray, Y: np.ndarray, lam: float) -> tuple[np.ndarray, np.ndarray]:
    """
    Closed-form ridge for multi-output:
      minimize ||Xb + 1*c - Y||^2 + lam * ||b||^2
    (intercept not regularized)
    """
    n, d = X.shape
    ones = np.ones((n, 1))
    X_aug = np.hstack([X, ones])  # (n, d+1)

    # Regularize weights but not intercept
    I = np.eye(d + 1)
    I[-1, -1] = 0.0
    A = X_aug.T @ X_aug + lam * I
    B = X_aug.T @ Y
    theta = np.linalg.solve(A, B)  # (d+1, k)
    coef = theta[:-1, :]
    intercept = theta[-1, :]
    return coef, intercept


def predict(X: np.ndarray, coef: np.ndarray, intercept: np.ndarray) -> np.ndarray:
    return X @ coef + intercept


def mae(y: np.ndarray, yhat: np.ndarray) -> float:
    return float(np.mean(np.abs(y - yhat)))


def rmse(y: np.ndarray, yhat: np.ndarray) -> float:
    return float(math.sqrt(np.mean((y - yhat) ** 2)))


def r2(y: np.ndarray, yhat: np.ndarray) -> float:
    ss_res = float(np.sum((y - yhat) ** 2))
    ss_tot = float(np.sum((y - float(np.mean(y))) ** 2))
    return 0.0 if ss_tot == 0 else 1.0 - ss_res / ss_tot


@dataclass
class Metrics:
    mae: float
    rmse: float
    r2: float


def eval_split(Y: np.ndarray, Yhat: np.ndarray) -> list[Metrics]:
    out: list[Metrics] = []
    for j in range(Y.shape[1]):
        y = Y[:, j]
        yh = Yhat[:, j]
        out.append(Metrics(mae=mae(y, yh), rmse=rmse(y, yh), r2=r2(y, yh)))
    return out


def baseline_mean(Y_train: np.ndarray, Y_eval: np.ndarray) -> np.ndarray:
    mu = np.mean(Y_train, axis=0, keepdims=True)
    return np.repeat(mu, repeats=Y_eval.shape[0], axis=0)


def main() -> None:
    if not CSV_PATH.is_file():
        raise SystemExit(f"Missing {CSV_PATH}; run `npm run eval:export` first.")

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

    train_idx, val_idx, test_idx = split_indices(len(X))
    X_train, Y_train = X[train_idx], Y[train_idx]
    X_val, Y_val = X[val_idx], Y[val_idx]
    X_test, Y_test = X[test_idx], Y[test_idx]

    # Hyperparameter sweep (document at least 3 configs)
    lambdas = [0.0, 0.1, 1.0, 10.0]
    sweep = []
    best = None
    best_score = float("inf")

    for lam in lambdas:
        coef, intercept = ridge_fit(X_train, Y_train, lam)
        val_hat = predict(X_val, coef, intercept)
        # pick by mean RMSE across targets
        rmses = [m.rmse for m in eval_split(Y_val, val_hat)]
        score = float(np.mean(rmses))
        sweep.append({"lambda": lam, "val_mean_rmse": score, "val_rmse": rmses})
        if score < best_score:
            best_score = score
            best = (lam, coef, intercept)

    assert best is not None
    best_lam, best_coef, best_intercept = best

    test_hat = predict(X_test, best_coef, best_intercept)
    test_metrics = eval_split(Y_test, test_hat)

    base_hat = baseline_mean(Y_train, Y_test)
    base_metrics = eval_split(Y_test, base_hat)

    report = {
        "split": {"train": len(train_idx), "val": len(val_idx), "test": len(test_idx)},
        "hyperparam_sweep": sweep,
        "selected_lambda": best_lam,
        "targets": {
            key: {
                "baseline": vars(base_metrics[j]),
                "ridge": vars(test_metrics[j]),
            }
            for j, key in enumerate(TARGET_KEYS)
        },
    }

    REPORT_OUT.parent.mkdir(parents=True, exist_ok=True)
    REPORT_OUT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Wrote {REPORT_OUT}")

    # Also write weights.json for runtime use
    targets = {}
    for j, key in enumerate(TARGET_KEYS):
        targets[key] = {"coef": best_coef[:, j].tolist(), "intercept": float(best_intercept[j])}

    doc = {
        "featureNames": feature_names,
        "targets": targets,
        "meta": {
            "fit": "closed-form ridge with train/val/test + lambda sweep",
            "selected_lambda": best_lam,
            "split": report["split"],
        },
    }
    WEIGHTS_OUT.parent.mkdir(parents=True, exist_ok=True)
    WEIGHTS_OUT.write_text(json.dumps(doc, indent=2), encoding="utf-8")
    print(f"Wrote {WEIGHTS_OUT}")


if __name__ == "__main__":
    main()

