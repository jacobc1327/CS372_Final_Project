/**
 * Program readiness for simulator / analytics — structural checks only (CS372).
 */

import type { Program, WorkoutDay } from "@/lib/mock-data";

export type CompletenessSeverity = "error" | "warning";

export interface CompletenessIssue {
  severity: CompletenessSeverity;
  message: string;
}

export interface ProgramCompletenessResult {
  /** No error-level issues; warnings may still exist. */
  ready: boolean;
  issues: CompletenessIssue[];
}

function dayTrainingLoad(d: WorkoutDay): number {
  return d.exercises.length;
}

export function assessProgramCompleteness(program: Program): ProgramCompletenessResult {
  const issues: CompletenessIssue[] = [];

  if (!program.weeks?.length) {
    issues.push({
      severity: "error",
      message: "Add at least one week to the program.",
    });
    return { ready: false, issues };
  }

  const w0 = program.weeks[0]!;
  const totalExWeek0 = w0.days.reduce((s, d) => s + d.exercises.length, 0);
  if (totalExWeek0 === 0) {
    issues.push({
      severity: "error",
      message: "Week 1 has no exercises — add lifts to at least one training day.",
    });
  }

  const daysWithWork = w0.days.filter((d) => dayTrainingLoad(d) > 0).length;
  if (daysWithWork > 0 && daysWithWork < program.daysPerWeek) {
    issues.push({
      severity: "warning",
      message: `Program is set to ${program.daysPerWeek} days/week but week 1 only has ${daysWithWork} day(s) with exercises.`,
    });
  }

  if (program.weeks.length !== program.duration) {
    issues.push({
      severity: "warning",
      message: `Week count (${program.weeks.length}) does not match duration (${program.duration} weeks) — stress curves may look off.`,
    });
  }

  for (const day of w0.days) {
    for (const ex of day.exercises) {
      if (!ex.name.trim()) {
        issues.push({
          severity: "error",
          message: `Unnamed exercise on ${day.dayOfWeek} (${day.name}) — add a name.`,
        });
      }
      if (!ex.reps?.trim()) {
        issues.push({
          severity: "error",
          message: `"${ex.name || "Exercise"}" on ${day.dayOfWeek} needs a rep prescription (e.g. 5 or 8-12).`,
        });
      }
      if (ex.sets < 1) {
        issues.push({
          severity: "error",
          message: `"${ex.name || "Exercise"}" on ${day.dayOfWeek} needs at least 1 set.`,
        });
      }
    }
  }

  const hasError = issues.some((i) => i.severity === "error");
  return { ready: !hasError, issues };
}
