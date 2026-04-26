import type { SimulationMetrics } from "@/lib/mock-data";
import type { ProgramFeatureVector } from "./features";
import modelWeights from "./weights.json";

type TargetKey = keyof typeof modelWeights.targets;

function clipScore(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * Ridge-style linear heads trained offline against `calculateMetrics` labels
 * (see `evaluation/export_training.ts` + `evaluation/fit_ridge.py`).
 */
export function predictMetricsFromFeatures(f: ProgramFeatureVector): SimulationMetrics {
  const { vector } = f;
  const out: Partial<Record<TargetKey, number>> = {};
  for (const key of Object.keys(modelWeights.targets) as TargetKey[]) {
    const head = modelWeights.targets[key];
    let s = head.intercept;
    for (let i = 0; i < vector.length; i++) {
      s += (head.coef[i] ?? 0) * vector[i];
    }
    out[key] = clipScore(s);
  }
  return {
    fatigueScore: out.fatigueScore!,
    progressScore: out.progressScore!,
    plateauRisk: out.plateauRisk!,
    adherenceDifficulty: out.adherenceDifficulty!,
  };
}
