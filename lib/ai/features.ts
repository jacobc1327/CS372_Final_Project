import type { Program, SandboxState } from "@/lib/mock-data";
import { dayStress } from "@/lib/mock-data";

/** Human-readable names aligned with `vector` indices (no bias column). */
export const PROGRAM_FEATURE_NAMES = [
  "days_per_week_norm",
  "duration_weeks_norm",
  "base_volume_norm",
  "base_intensity_norm",
  "volume_modifier",
  "intensity_modifier",
  "frequency_days_norm",
  "sleep_hours_norm",
  "soreness_norm",
  "recovery_norm",
  "recent_progress_norm",
  "goal_norm",
  "week1_total_stress_norm",
  "week1_mean_barbell_intensity",
  "compound_lift_share",
  "deload_week_share",
  "category_strength_bias",
] as const;

export type ProgramFeatureName = (typeof PROGRAM_FEATURE_NAMES)[number];

function progressToUnit(s: SandboxState["recentProgress"]): number {
  switch (s) {
    case "stalled":
      return 0;
    case "slow":
      return 0.33;
    case "normal":
      return 0.66;
    case "fast":
      return 1;
    default:
      return 0.66;
  }
}

function goalToUnit(g: SandboxState["goal"]): number {
  switch (g) {
    case "strength":
      return 0;
    case "balanced":
      return 0.5;
    case "hypertrophy":
      return 1;
    default:
      return 0.5;
  }
}

/** Maps program category to a scalar bias used by the linear head (not one-hot to keep eval notebooks small). */
function categoryStrengthBias(category: Program["category"]): number {
  const map: Record<Program["category"], number> = {
    powerlifting: 1,
    strength: 0.85,
    olympic: 0.8,
    hybrid: 0.55,
    hypertrophy: 0.35,
    beginner: 0.45,
    conditioning: 0.25,
  };
  return map[category] ?? 0.5;
}

function weekOneStats(program: Program, volumeMod: number, intensityMod: number) {
  const week = program.weeks[0];
  if (!week) {
    return { stress: 0, meanBarbellIntensity: 0, compoundShare: 0 };
  }
  let stress = 0;
  let intSum = 0;
  let intCount = 0;
  let compound = 0;
  let totalEx = 0;
  for (const d of week.days) {
    stress += dayStress(d, volumeMod, intensityMod);
    for (const e of d.exercises) {
      totalEx += 1;
      if (e.intensity > 0) {
        intSum += e.intensity * (intensityMod / 100);
        intCount += 1;
        compound += 1;
      }
    }
  }
  return {
    stress,
    meanBarbellIntensity: intCount > 0 ? intSum / intCount : 0,
    compoundShare: totalEx > 0 ? compound / totalEx : 0,
  };
}

export interface ProgramFeatureVector {
  names: readonly string[];
  vector: number[];
  /** Same values keyed by name for debugging / notebooks. */
  byName: Record<ProgramFeatureName, number>;
}

/**
 * Fixed-length feature vector for ML heads and evaluation export.
 * Values are roughly in [0, 1] where possible for stable ridge regression.
 */
export function extractProgramFeatures(
  program: Program,
  volumeMod: number,
  intensityMod: number,
  effectiveFrequencyDays: number,
  sandbox: SandboxState,
): ProgramFeatureVector {
  const w1 = weekOneStats(program, volumeMod, intensityMod);
  const deloadWeeks = program.weeks.filter((w) => w.deload).length;

  const vector: number[] = [
    program.daysPerWeek / 7,
    Math.min(1, program.duration / 16),
    program.baseVolume / 120,
    program.baseIntensity / 100,
    volumeMod / 100,
    intensityMod / 100,
    effectiveFrequencyDays / 7,
    (sandbox.sleep - 4) / 6,
    sandbox.soreness / 10,
    sandbox.recovery / 100,
    progressToUnit(sandbox.recentProgress),
    goalToUnit(sandbox.goal),
    Math.min(1, w1.stress / 800),
    w1.meanBarbellIntensity / 100,
    w1.compoundShare,
    program.duration > 0 ? deloadWeeks / program.duration : 0,
    categoryStrengthBias(program.category),
  ];

  const byName = Object.fromEntries(
    PROGRAM_FEATURE_NAMES.map((n, i) => [n, vector[i]]),
  ) as Record<ProgramFeatureName, number>;

  return {
    names: PROGRAM_FEATURE_NAMES,
    vector,
    byName,
  };
}
