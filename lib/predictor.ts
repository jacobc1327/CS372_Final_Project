/**
 * Baseline prediction model (CS372 — Adaptive Training Program Studio).
 *
 * Deterministic, feature-driven scores in [0, 100]. This module is structured so a future
 * trained model can implement the same `PredictorModel` interface without changing the API route.
 */

import type { Program, SandboxState } from "@/lib/mock-data";
import type { ProgramFeatureVector, ProgramModifiers } from "@/lib/features";
import { effectiveTrainingDaysPerWeek } from "@/lib/features";

export interface FeatureSummary {
  weeklyStressMean: number;
  totalWeeklySets: number;
  averageIntensity: number;
  recoveryAdjustedLoad: number;
  goalAlignment: number;
  stressMonotony: number;
  /** Short label for which modifier deviates most from 100% (interpretability). */
  dominantStressDriver: "volume" | "intensity" | "frequency" | "balanced";
}

export interface BaselinePredictionOutput {
  fatigueScore: number;
  progressScore: number;
  plateauRisk: number;
  adherenceDifficulty: number;
  featureSummary: FeatureSummary;
}

export interface PredictorInput {
  program: Program;
  features: ProgramFeatureVector;
  modifiers: ProgramModifiers;
  sandbox: SandboxState;
}

/** Contract for swapping baseline → trained weights later. */
export interface PredictorModel {
  predict(input: PredictorInput): BaselinePredictionOutput;
}

function clip100(x: number): number {
  return Math.min(100, Math.max(0, Math.round(x)));
}

function stressNorm(features: ProgramFeatureVector): number {
  return Math.min(1, features.weeklyStressMean / 420);
}

function loadNorm(features: ProgramFeatureVector): number {
  return Math.min(1, features.recoveryAdjustedLoad / 520);
}

function recentProgressMultiplier(s: SandboxState["recentProgress"]): number {
  switch (s) {
    case "stalled":
      return 0.42;
    case "slow":
      return 0.72;
    case "fast":
      return 1.22;
    default:
      return 1;
  }
}

function dominantDriver(mods: ProgramModifiers): FeatureSummary["dominantStressDriver"] {
  const dv = Math.abs(mods.volume - 100);
  const di = Math.abs(mods.intensity - 100);
  const df = Math.abs(mods.frequency - 100);
  const max = Math.max(dv, di, df);
  if (max < 4) return "balanced";
  if (dv >= di && dv >= df) return "volume";
  if (di >= dv && di >= df) return "intensity";
  return "frequency";
}

function buildFeatureSummary(
  features: ProgramFeatureVector,
  modifiers: ProgramModifiers,
): FeatureSummary {
  return {
    weeklyStressMean: Math.round(features.weeklyStressMean * 10) / 10,
    totalWeeklySets: Math.round(features.totalWeeklySets * 10) / 10,
    averageIntensity: Math.round(features.averageIntensity * 10) / 10,
    recoveryAdjustedLoad: Math.round(features.recoveryAdjustedLoad * 10) / 10,
    goalAlignment: Math.round(features.goalAlignment * 1000) / 1000,
    stressMonotony: Math.round(features.stressMonotony * 100) / 100,
    dominantStressDriver: dominantDriver(modifiers),
  };
}

/**
 * Hand-tuned linear-ish baseline: responds to extracted load, modifiers, and sandbox signals.
 */
function baselineScores(input: PredictorInput): Omit<BaselinePredictionOutput, "featureSummary"> {
  const { program, features, modifiers, sandbox } = input;
  const vol = modifiers.volume / 100;
  const inten = modifiers.intensity / 100;
  const freqDays = effectiveTrainingDaysPerWeek(program, modifiers);
  const freqN = freqDays / 7;

  const sN = stressNorm(features);
  const lN = loadNorm(features);
  const rec = sandbox.recovery / 100;
  const sleepGap = Math.max(0, 8 - sandbox.sleep);
  const progM = recentProgressMultiplier(sandbox.recentProgress);

  const fatigueRaw =
    16 +
    50 * sN +
    24 * lN +
    (1 - rec) * 36 +
    sandbox.soreness * 3.4 +
    sleepGap * 5.2 +
    (vol - 1) * 16 +
    (inten - 1) * 11 +
    (freqN - 0.32) * 24;

  const fatigueScore = clip100(fatigueRaw);

  const progressRaw =
    10 +
    50 * sN * vol * inten * progM * (0.52 + 0.48 * features.goalAlignment) +
    rec * 26 -
    fatigueScore * 0.11 +
    (sandbox.goal === "strength" && inten > 1.02 ? 6 : 0) +
    (sandbox.goal === "hypertrophy" && vol > 1.02 ? 6 : 0);

  const progressScore = clip100(progressRaw);

  let plateauRaw =
    24 +
    (sandbox.recentProgress === "stalled" ? 30 : sandbox.recentProgress === "slow" ? 14 : 0) +
    (vol < 0.94 ? 11 : 0) +
    (inten < 0.94 ? 9 : 0) +
    Math.min(22, features.stressMonotony * 2.4) +
    (1 - features.pushPullBalance) * 16 +
    fatigueScore * 0.07 +
    (1 - features.squatHingeBalance) * 8;

  plateauRaw += sandbox.recentProgress === "fast" ? -6 : 0;
  const plateauRisk = clip100(plateauRaw);

  const adherenceRaw =
    20 +
    Math.max(0, vol - 0.82) * 34 +
    freqDays * 5.2 +
    program.daysPerWeek * 2.9 +
    sandbox.soreness * 3.2 +
    (sandbox.sleep < 6.5 ? 15 : sandbox.sleep < 7 ? 8 : 0) +
    (1 - rec) * 14 +
    features.totalWeeklySets * 0.045;

  const adherenceDifficulty = clip100(adherenceRaw);

  return { fatigueScore, progressScore, plateauRisk, adherenceDifficulty };
}

/** Default production predictor until a trained head is wired in. */
export const baselinePredictor: PredictorModel = {
  predict(input: PredictorInput): BaselinePredictionOutput {
    const scores = baselineScores(input);
    return {
      ...scores,
      featureSummary: buildFeatureSummary(input.features, input.modifiers),
    };
  },
};

/** Convenience for API routes and tests. */
export function predictProgramBaseline(input: PredictorInput): BaselinePredictionOutput {
  return baselinePredictor.predict(input);
}
