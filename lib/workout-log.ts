/**
 * Local session log (browser only) — CS372 demo persistence.
 */

export const WORKOUT_LOG_STORAGE_KEY = "atps-workout-log-v1";

export interface WorkoutLogEntry {
  id: string;
  programId: string;
  programName: string;
  weekNumber: number;
  dayId: string;
  dayName: string;
  dayOfWeek: string;
  completedAt: string;
  note?: string;
}

function safeParse(raw: string | null): WorkoutLogEntry[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter(
      (x): x is WorkoutLogEntry =>
        typeof x === "object" &&
        x !== null &&
        typeof (x as WorkoutLogEntry).id === "string" &&
        typeof (x as WorkoutLogEntry).programId === "string",
    );
  } catch {
    return [];
  }
}

export function loadWorkoutLog(): WorkoutLogEntry[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(WORKOUT_LOG_STORAGE_KEY));
}

export function saveWorkoutLog(entries: WorkoutLogEntry[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(WORKOUT_LOG_STORAGE_KEY, JSON.stringify(entries));
}

export function getLogForProgram(programId: string): WorkoutLogEntry[] {
  return loadWorkoutLog()
    .filter((e) => e.programId === programId)
    .sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1));
}

export function appendWorkoutLog(entry: WorkoutLogEntry): void {
  const all = loadWorkoutLog();
  all.unshift(entry);
  saveWorkoutLog(all.slice(0, 200));
}

export function removeWorkoutLogEntry(id: string): void {
  saveWorkoutLog(loadWorkoutLog().filter((e) => e.id !== id));
}
