import type { Program, WorkoutDay } from "@/lib/mock-data";
import type { ProgramFeatureVector, ProgramModifiers } from "@/lib/features";
import type { SandboxState } from "@/lib/mock-data";
import { extractProgramFeatures } from "@/lib/features";
import { predictProgramBaseline } from "@/lib/predictor";
import { retrieveRelevantKnowledge } from "@/lib/retrieval";

import type { PlanChange, PlanObjective } from "@/lib/plan-doctor-types";

export interface PlanPatchResult {
  objective: PlanObjective;
  title: string;
  summary: string;
  changes: PlanChange[];
  evidence: ReturnType<typeof retrieveRelevantKnowledge>;
  before: ReturnType<typeof predictProgramBaseline>;
  after: ReturnType<typeof predictProgramBaseline>;
  patchedProgram: Program;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function isAccessory(ex: { intensity: number }): boolean {
  // In this project, intensity==0 is used for accessories / unloaded slots.
  return ex.intensity <= 0;
}

function applyChanges(program: Program, changes: PlanChange[]): Program {
  let out: Program = program;

  for (const ch of changes) {
    if (ch.kind === "toggle_deload") {
      out = {
        ...out,
        weeks: out.weeks.map((w) =>
          w.weekNumber === ch.weekNumber ? { ...w, deload: ch.deload } : w,
        ),
      };
      continue;
    }
    if (ch.kind === "sets_delta") {
      out = {
        ...out,
        weeks: out.weeks.map((w) => ({
          ...w,
          days: w.days.map((d) => ({
            ...d,
            exercises: d.exercises.map((e) => {
              if (ch.where === "accessories" && !isAccessory(e)) return e;
              const nextSets = clamp(e.sets + ch.delta, 1, 12);
              return nextSets === e.sets ? e : { ...e, sets: nextSets };
            }),
          })),
        })),
      };
      continue;
    }
    if (ch.kind === "intensity_delta") {
      out = {
        ...out,
        weeks: out.weeks.map((w) => ({
          ...w,
          days: w.days.map((d) => ({
            ...d,
            exercises: d.exercises.map((e) => {
              if (e.intensity <= 0) return e;
              const next = clamp(e.intensity + ch.deltaPct1RM, ch.min, ch.max);
              return next === e.intensity ? e : { ...e, intensity: next };
            }),
          })),
        })),
      };
      continue;
    }
  }

  return out;
}

function pickDeloadWeek(program: Program, f: ProgramFeatureVector): number | null {
  // If there is already a deload, avoid stacking.
  if (program.weeks.some((w) => !!w.deload)) return null;
  if (program.weeks.length < 4) return null;

  // Simple heuristic: deload in week 4, else middle.
  const week4 = program.weeks.find((w) => w.weekNumber === 4);
  if (week4) return 4;
  const mid = program.weeks[Math.floor(program.weeks.length / 2)]?.weekNumber ?? null;
  if (!mid) return null;
  return mid;
}

function objectivePlan(
  objective: PlanObjective,
  program: Program,
  f: ProgramFeatureVector,
  pred: ReturnType<typeof predictProgramBaseline>,
): { title: string; summary: string; changes: PlanChange[]; query: string } {
  const highFatigue = pred.fatigueScore >= 70;
  const highPlateau = pred.plateauRisk >= 60;
  const highAdherence = pred.adherenceDifficulty >= 70;

  if (objective === "reduce_fatigue") {
    const changes: PlanChange[] = [];
    const deloadWeek = pickDeloadWeek(program, f);
    if (highFatigue && deloadWeek) changes.push({ kind: "toggle_deload", weekNumber: deloadWeek, deload: true });
    // Trim accessories first: keeps “main story” intact.
    changes.push({ kind: "sets_delta", where: "accessories", delta: -1 });
    return {
      title: "Reduce fatigue without rewriting the program",
      summary:
        "Adds recovery margin by trimming accessory volume (and inserting a deload when appropriate) while keeping main lift structure intact.",
      changes,
      query: "reduce fatigue deload volume trim accessories recovery manage stress",
    };
  }

  if (objective === "break_plateau") {
    const changes: PlanChange[] = [];
    // Small intensity wave: bump %1RM for main lifts, keep sets stable.
    changes.push({ kind: "intensity_delta", deltaPct1RM: +3, min: 40, max: 115 });
    // If monotony is high, add a deload week as “pattern break”.
    const deloadWeek = pickDeloadWeek(program, f);
    if ((highPlateau || f.stressMonotony > 6) && deloadWeek) {
      changes.push({ kind: "toggle_deload", weekNumber: deloadWeek, deload: true });
    }
    return {
      title: "Break plateau with minimal structural change",
      summary:
        "Introduces a small intensity wave on main lifts (and optionally a deload week) to disrupt staleness without changing your split.",
      changes,
      query: "plateau intensity wave variation deload monotony progressive overload",
    };
  }

  // improve_adherence
  {
    const changes: PlanChange[] = [];
    // If adherence is already high, focus on trimming time-costly accessories.
    if (highAdherence) changes.push({ kind: "sets_delta", where: "accessories", delta: -1 });
    // Backstop: if still heavy, trim all sets slightly.
    if (pred.fatigueScore > 75 && highAdherence) {
      changes.push({ kind: "sets_delta", where: "all", delta: -1 });
    }
    return {
      title: "Make the plan easier to stick to",
      summary:
        "Reduces time and soreness cost primarily by trimming accessory sets, aiming to preserve the main work while lowering adherence load.",
      changes,
      query: "adherence simplify sessions reduce volume accessories time management",
    };
  }
}

function dayNameList(week: { days: WorkoutDay[] }): string {
  return week.days.map((d) => d.name).join(" · ");
}

export function generatePlanPatch(input: {
  program: Program;
  modifiers: ProgramModifiers;
  sandbox: SandboxState;
  objective: PlanObjective;
}): PlanPatchResult {
  const { program, modifiers, sandbox, objective } = input;
  const f0 = extractProgramFeatures(program, modifiers, sandbox);
  const before = predictProgramBaseline({ program, features: f0, modifiers, sandbox });

  const plan = objectivePlan(objective, program, f0, before);
  const patchedProgram = applyChanges(program, plan.changes);
  const f1 = extractProgramFeatures(patchedProgram, modifiers, sandbox);
  const after = predictProgramBaseline({ program: patchedProgram, features: f1, modifiers, sandbox });

  const query = [
    program.name,
    program.category,
    sandbox.goal,
    sandbox.recentProgress,
    dayNameList(program.weeks[0] ?? { days: [] }),
    plan.query,
  ].join(" ");
  const evidence = retrieveRelevantKnowledge(query, 6, { method: "hybrid" });

  return {
    objective,
    title: plan.title,
    summary: plan.summary,
    changes: plan.changes,
    evidence,
    before,
    after,
    patchedProgram,
  };
}

