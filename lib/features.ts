/**
 * Program feature extraction for ML / analytics (CS372 — Adaptive Training Program Studio).
 *
 * This module encodes domain-informed numeric features from a `Program`, UI modifiers,
 * and the recovery sandbox. Feature definitions were developed with AI-assisted iteration
 * (brainstorming, naming, and sanity checks); engineering and validation remain the course
 * team's responsibility. Keep in sync with evaluation exports if you retrain downstream models.
 */

import type { MuscleGroup, Program, SandboxState, WorkoutDay } from "@/lib/mock-data";
import { dayStress, weeklyStressSeries } from "@/lib/mock-data";

const WEEKDAYS: WorkoutDay["dayOfWeek"][] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Global load modifiers from the simulator / workspace (percentages). */
export interface ProgramModifiers {
  volume: number;
  intensity: number;
  frequency: number;
}

/** Flat feature bundle for models, dashboards, and API responses. */
export interface ProgramFeatureVector {
  daysPerWeek: number;
  durationWeeks: number;
  totalWeeklySets: number;
  totalWeeklyRepsEstimate: number;
  averageIntensity: number;
  intensityVariance: number;
  volumeByMuscleGroup: Record<MuscleGroup, number>;
  upperLowerBalance: number;
  pushPullBalance: number;
  squatHingeBalance: number;
  weeklyStressMean: number;
  weeklyStressVariance: number;
  stressMonotony: number;
  deloadWeeks: number;
  goalAlignment: number;
  recoveryAdjustedLoad: number;
}

const MUSCLE_GROUPS: MuscleGroup[] = [
  "quads",
  "hamstrings",
  "glutes",
  "chest",
  "back",
  "shoulders",
  "arms",
  "core",
  "conditioning",
];

function emptyMuscleRecord(): Record<MuscleGroup, number> {
  return Object.fromEntries(MUSCLE_GROUPS.map((g) => [g, 0])) as Record<MuscleGroup, number>;
}

/** First numeric token in a rep string; ranges like "6-8" use the midpoint when two numbers found. */
export function estimateRepsFromString(reps: string): number {
  const nums = reps.match(/\d+/g);
  if (!nums?.length) return 5;
  if (nums.length >= 2) {
    const a = parseInt(nums[0]!, 10);
    const b = parseInt(nums[1]!, 10);
    return (a + b) / 2;
  }
  return parseInt(nums[0]!, 10) || 5;
}

export function effectiveTrainingDaysPerWeek(program: Program, modifiers: ProgramModifiers): number {
  return Math.max(1, Math.min(7, Math.round(program.daysPerWeek * (modifiers.frequency / 100))));
}

function scaledSets(sets: number, volumePct: number): number {
  return Math.max(1, Math.round(sets * (volumePct / 100)));
}

function perWeekAggregates(
  program: Program,
  modifiers: ProgramModifiers,
): {
  weeklySets: number[];
  weeklyReps: number[];
  weeklyStressTotals: number[];
  weeklyMonotony: number[];
} {
  const stressSeries = weeklyStressSeries(program, modifiers.volume, modifiers.intensity);
  const weeklySets: number[] = [];
  const weeklyReps: number[] = [];
  const weeklyStressTotals: number[] = stressSeries.map((s) => s.stress);
  const weeklyMonotony: number[] = [];

  for (let wi = 0; wi < program.weeks.length; wi++) {
    const week = program.weeks[wi]!;
    let setsSum = 0;
    let repsSum = 0;
    const dailyStresses: number[] = [];

    for (const dow of WEEKDAYS) {
      const day = week.days.find((d) => d.dayOfWeek === dow);
      if (!day) {
        dailyStresses.push(0);
        continue;
      }
      const sDay = dayStress(day, modifiers.volume, modifiers.intensity);
      dailyStresses.push(sDay);
      for (const e of day.exercises) {
        const s = scaledSets(e.sets, modifiers.volume);
        setsSum += s;
        repsSum += s * estimateRepsFromString(e.reps);
      }
    }

    weeklySets.push(setsSum);
    weeklyReps.push(repsSum);

    const trainingLoads = dailyStresses.filter((x) => x > 1e-6);
    if (trainingLoads.length < 2) {
      weeklyMonotony.push(trainingLoads.length === 1 ? 10 : 0);
    } else {
      const m = mean(trainingLoads);
      const sd = stddevSample(trainingLoads);
      weeklyMonotony.push(m / (sd + 1e-6));
    }
  }

  return { weeklySets, weeklyReps, weeklyStressTotals, weeklyMonotony };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function varianceSample(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return values.reduce((s, x) => s + (x - m) ** 2, 0) / (values.length - 1);
}

function stddevSample(values: number[]): number {
  return Math.sqrt(varianceSample(values));
}

/** Intensity-weighted variance across exercises (one sample per exercise, weighted by scaled sets). */
function intensityVarianceAcrossExercises(program: Program, modifiers: ProgramModifiers): number {
  const vals: number[] = [];
  const wts: number[] = [];
  for (const week of program.weeks) {
    for (const day of week.days) {
      for (const e of day.exercises) {
        const w = scaledSets(e.sets, modifiers.volume);
        const inten = e.intensity > 0 ? e.intensity * (modifiers.intensity / 100) : 30 * (modifiers.intensity / 100);
        vals.push(inten);
        wts.push(w);
      }
    }
  }
  const tw = wts.reduce((a, b) => a + b, 0);
  if (tw < 1e-6) return 0;
  const mu = vals.reduce((s, v, i) => s + v * wts[i]!, 0) / tw;
  const v = vals.reduce((s, val, i) => s + wts[i]! * (val - mu) ** 2, 0) / tw;
  return v;
}

function averageIntensityWeighted(program: Program, modifiers: ProgramModifiers): number {
  let num = 0;
  let den = 0;
  for (const week of program.weeks) {
    for (const day of week.days) {
      for (const e of day.exercises) {
        const w = scaledSets(e.sets, modifiers.volume);
        const inten = e.intensity > 0 ? e.intensity * (modifiers.intensity / 100) : 30 * (modifiers.intensity / 100);
        num += inten * w;
        den += w;
      }
    }
  }
  return den > 0 ? num / den : 0;
}

/** Mean weekly `muscleGroupVolume`-style load (sets × intensity/100), averaged across weeks. */
function meanVolumeByMuscleGroup(program: Program, modifiers: ProgramModifiers): Record<MuscleGroup, number> {
  const acc = emptyMuscleRecord();
  let n = 0;
  for (let wi = 0; wi < program.weeks.length; wi++) {
    const week = program.weeks[wi]!;
    if (week.days.length === 0) continue;
    n += 1;
    for (const day of week.days) {
      for (const e of day.exercises) {
        const sets = scaledSets(e.sets, modifiers.volume);
        const intensity = e.intensity > 0 ? e.intensity * (modifiers.intensity / 100) : 30 * (modifiers.intensity / 100);
        acc[e.group] += sets * (intensity / 100);
      }
    }
  }
  if (n === 0) return acc;
  for (const g of MUSCLE_GROUPS) acc[g] /= n;
  return acc;
}

/**
 * Returns a score in [0, 1]: 1 when the two sides are equal, 0 when one side dominates.
 * `sideA` / `sideB` are non-negative load proxies (same units).
 */
export function balanceScore(sideA: number, sideB: number): number {
  const t = sideA + sideB + 1e-9;
  const r = sideA / t;
  return Math.max(0, 1 - Math.abs(r - 0.5) * 2);
}

function upperLowerFromVolume(v: Record<MuscleGroup, number>): { upper: number; lower: number } {
  const lower = v.quads + v.hamstrings + v.glutes + 0.15 * v.core;
  const upper = v.chest + v.back + v.shoulders + v.arms + 0.15 * v.core;
  return { upper, lower };
}

function pushPullFromVolume(v: Record<MuscleGroup, number>): { push: number; pull: number } {
  const push = v.chest + 0.55 * v.shoulders + 0.45 * v.arms;
  const pull = v.back + 0.45 * v.shoulders + 0.55 * v.arms;
  return { push, pull };
}

function squatHingeFromVolume(v: Record<MuscleGroup, number>): { squat: number; hinge: number } {
  const squat = v.quads + 0.45 * v.glutes;
  const hinge = v.hamstrings + 0.55 * v.glutes;
  return { squat, hinge };
}

function goalAlignmentScore(program: Program, sandbox: SandboxState): number {
  const cat = program.category;
  const g = sandbox.goal;
  let programBias = 0.5;
  if (cat === "powerlifting" || cat === "strength" || cat === "olympic") programBias = 0.85;
  else if (cat === "hypertrophy") programBias = 0.15;
  else if (cat === "beginner" || cat === "hybrid") programBias = 0.45;
  else if (cat === "conditioning") programBias = 0.25;

  let goalTarget = 0.5;
  if (g === "strength") goalTarget = 0.85;
  else if (g === "hypertrophy") goalTarget = 0.15;

  return Math.max(0, 1 - Math.abs(programBias - goalTarget) * 1.2);
}

/**
 * Perceived load multiplier from recovery sandbox (higher when sleep is short / soreness high / recovery low).
 */
export function recoveryStressMultiplier(sandbox: SandboxState): number {
  const sleepDeficit = Math.max(0, 8 - sandbox.sleep) / 8;
  const sore = sandbox.soreness / 10;
  const rec = (100 - sandbox.recovery) / 100;
  return 1 + 0.35 * rec + 0.25 * sore + 0.2 * sleepDeficit;
}

/**
 * Main entry: builds a `ProgramFeatureVector` from the live program graph, modifiers, and sandbox.
 */
export function extractProgramFeatures(
  program: Program,
  modifiers: ProgramModifiers,
  sandbox: SandboxState,
): ProgramFeatureVector {
  if (program.weeks.length === 0) {
    return {
      daysPerWeek: program.daysPerWeek,
      durationWeeks: program.duration,
      totalWeeklySets: 0,
      totalWeeklyRepsEstimate: 0,
      averageIntensity: 0,
      intensityVariance: 0,
      volumeByMuscleGroup: emptyMuscleRecord(),
      upperLowerBalance: 1,
      pushPullBalance: 1,
      squatHingeBalance: 1,
      weeklyStressMean: 0,
      weeklyStressVariance: 0,
      stressMonotony: 0,
      deloadWeeks: 0,
      goalAlignment: goalAlignmentScore(program, sandbox),
      recoveryAdjustedLoad: 0,
    };
  }

  const { weeklySets, weeklyReps, weeklyStressTotals, weeklyMonotony } = perWeekAggregates(
    program,
    modifiers,
  );

  const totalWeeklySets = mean(weeklySets);
  const totalWeeklyRepsEstimate = mean(weeklyReps);
  const weeklyStressMean = mean(weeklyStressTotals);
  const weeklyStressVariance =
    weeklyStressTotals.length >= 2 ? varianceSample(weeklyStressTotals) : 0;
  const stressMonotony = weeklyMonotony.length ? mean(weeklyMonotony) : 0;

  const volumeByMuscleGroup = meanVolumeByMuscleGroup(program, modifiers);
  const { upper, lower } = upperLowerFromVolume(volumeByMuscleGroup);
  const { push, pull } = pushPullFromVolume(volumeByMuscleGroup);
  const { squat, hinge } = squatHingeFromVolume(volumeByMuscleGroup);

  const deloadWeeks = program.weeks.filter((w) => w.deload).length;

  const recoveryAdjustedLoad = weeklyStressMean * recoveryStressMultiplier(sandbox);

  return {
    daysPerWeek: program.daysPerWeek,
    durationWeeks: program.duration,
    totalWeeklySets,
    totalWeeklyRepsEstimate,
    averageIntensity: averageIntensityWeighted(program, modifiers),
    intensityVariance: intensityVarianceAcrossExercises(program, modifiers),
    volumeByMuscleGroup,
    upperLowerBalance: balanceScore(lower, upper),
    pushPullBalance: balanceScore(push, pull),
    squatHingeBalance: balanceScore(squat, hinge),
    weeklyStressMean,
    weeklyStressVariance,
    stressMonotony,
    deloadWeeks,
    goalAlignment: goalAlignmentScore(program, sandbox),
    recoveryAdjustedLoad,
  };
}

/** Optional: stress trajectory already used internally; exposed for charts or APIs. */
export function weeklyStressProfile(program: Program, modifiers: ProgramModifiers) {
  return weeklyStressSeries(program, modifiers.volume, modifiers.intensity);
}
