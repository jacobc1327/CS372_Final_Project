export const COACH_PROFILE_KEY = "atps-coach-profile-v1";

export type CoachGoal = "strength" | "hypertrophy" | "balanced";
export type ExperienceLevel = "beginner" | "intermediate" | "advanced";
export type Equipment =
  | "full_gym"
  | "barbell_only"
  | "dumbbells_only"
  | "home_minimal";

export type Emphasis = "full_body" | "upper" | "lower" | "arms" | "conditioning";

export interface CoachProfile {
  goal: CoachGoal;
  daysPerWeek: number;
  minutesPerSession: number;
  experience: ExperienceLevel;
  equipment: Equipment;
  constraints?: string;
  preferences?: string;
  avoidMovements?: string;
  emphasis?: Emphasis;
  estimated1RM?: {
    squat?: number;
    bench?: number;
    deadlift?: number;
    overheadPress?: number;
  };
}

export function loadCoachProfile(): CoachProfile | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(COACH_PROFILE_KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (typeof v !== "object" || v === null) return null;
    return v as CoachProfile;
  } catch {
    return null;
  }
}

export function saveCoachProfile(p: CoachProfile): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COACH_PROFILE_KEY, JSON.stringify(p));
}

