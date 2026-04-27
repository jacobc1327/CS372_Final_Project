import type { CoachIntakePayload, AdjustedPlan } from "@/lib/coach-types";
import type { Program } from "@/lib/mock-data";

export const COACH_HISTORY_KEY = "atps-coach-history-v1";

export interface CoachRunEntry {
  id: string;
  programId: string;
  createdAt: string;
  objective: CoachIntakePayload["objective"];
  headline: string;
  whatChangedTitles: string[];
  /** Optional user-saved scenario label. If absent, this is an auto-saved run. */
  label?: string;
  intake: CoachIntakePayload;
  plan: AdjustedPlan;
  patchedProgram: Program;
}

function safeParse(raw: string | null): CoachRunEntry[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter(
      (x): x is CoachRunEntry =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as CoachRunEntry).id === "string" &&
        typeof (x as CoachRunEntry).programId === "string" &&
        typeof (x as CoachRunEntry).createdAt === "string" &&
        typeof (x as CoachRunEntry).intake === "object" &&
        typeof (x as CoachRunEntry).plan === "object" &&
        typeof (x as CoachRunEntry).patchedProgram === "object",
    );
  } catch {
    return [];
  }
}

export function loadCoachHistory(): CoachRunEntry[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(COACH_HISTORY_KEY));
}

export function saveCoachHistory(entries: CoachRunEntry[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(COACH_HISTORY_KEY, JSON.stringify(entries));
}

export function getCoachRunsForProgram(programId: string): CoachRunEntry[] {
  return loadCoachHistory()
    .filter((e) => e.programId === programId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export function appendCoachRun(params: {
  programId: string;
  intake: CoachIntakePayload;
  plan: AdjustedPlan;
  patchedProgram: Program;
  label?: string;
}): CoachRunEntry {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `coach-${Date.now()}`;
  const entry: CoachRunEntry = {
    id,
    programId: params.programId,
    createdAt: new Date().toISOString(),
    objective: params.intake.objective,
    headline: params.plan.headline,
    whatChangedTitles: params.plan.whatChanged.map((x) => x.title).slice(0, 4),
    label: params.label,
    intake: params.intake,
    plan: params.plan,
    patchedProgram: params.patchedProgram,
  };

  const all = loadCoachHistory();
  all.unshift(entry);
  saveCoachHistory(all.slice(0, 30));
  return entry;
}

export function setCoachRunLabel(id: string, label: string | null): void {
  const next = loadCoachHistory().map((e) =>
    e.id === id ? { ...e, label: label?.trim() || undefined } : e,
  );
  saveCoachHistory(next);
}

export function getScenariosForProgram(programId: string): CoachRunEntry[] {
  return getCoachRunsForProgram(programId).filter((e) => !!e.label);
}

