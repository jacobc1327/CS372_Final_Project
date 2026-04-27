import type { CoachProfile } from "@/lib/coach-profile";

export type CoachObjective =
  | "reduce_fatigue"
  | "break_plateau"
  | "improve_adherence"
  | "maximize_hypertrophy";

export interface CoachIntakePayload {
  profile: CoachProfile;
  objective: CoachObjective;
}

export interface CoachFollowUpQuestion {
  id: string;
  prompt: string;
  type: "select" | "number" | "text";
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
}

export type CoachResponse =
  | { kind: "followup"; questions: CoachFollowUpQuestion[] }
  | { kind: "result"; plan: AdjustedPlan; patchedProgram: unknown };

export interface CoachAnalysisStage {
  label: string;
  pct: number;
}

export interface AdjustedPlanDay {
  dayOfWeek: string;
  title: string;
  focus: string;
  estimatedMinutes: number;
  main: { name: string; sets: number; reps: string; intensityPct1RM?: number | null }[];
  accessories: { name: string; sets: number; reps: string }[];
}

export interface AdjustedPlan {
  headline: string;
  whatChanged: { title: string; detail: string; evidence?: { title: string; snippet: string }[] }[];
  /** Optional: evidence linked to specific plan changes (for UI explainability). */
  evidenceLinks?: {
    changeTitle: string;
    changeDetail: string;
    evidence: { title: string; snippet: string }[];
  }[];
  weekPreview: AdjustedPlanDay[];
  progressionRules: { title: string; detail: string }[];
  warnings: string[];
}

