export const ACTIVE_PLAN_KEY = "atps-active-plan-v1";

type ActivePlanMap = Record<string, string>;

function loadMap(): ActivePlanMap {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(ACTIVE_PLAN_KEY);
  if (!raw) return {};
  try {
    const v = JSON.parse(raw) as unknown;
    if (typeof v !== "object" || v === null) return {};
    return v as ActivePlanMap;
  } catch {
    return {};
  }
}

function saveMap(m: ActivePlanMap): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACTIVE_PLAN_KEY, JSON.stringify(m));
}

export function getActivePlanId(programId: string): string | null {
  const m = loadMap();
  return m[programId] ?? null;
}

export function setActivePlanId(programId: string, planRunId: string): void {
  const m = loadMap();
  m[programId] = planRunId;
  saveMap(m);
}

export function clearActivePlanId(programId: string): void {
  const m = loadMap();
  delete m[programId];
  saveMap(m);
}

