/**
 * Browser localStorage persistence for workspace state (CS372).
 * Client-only; never import from Server Components that read `window`.
 */

import type { Program, SandboxState } from "@/lib/mock-data";
import { defaultSandbox } from "@/lib/mock-data";

/** Same fields as `Modifiers` in workspace-provider (avoid circular import). */
export interface PersistedModifiers {
  volume: number;
  intensity: number;
  frequency: number;
}

export const WORKSPACE_STORAGE_KEY = "atps-workspace-v1";

const PERSIST_VERSION = 1;

export interface PersistedWorkspaceV1 {
  version: number;
  workingPrograms: Record<string, Program>;
  modsMap: Record<string, PersistedModifiers>;
  sandbox: SandboxState;
  customMap: Record<string, Program>;
  draftIds: string[];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function looksLikeProgram(v: unknown): v is Program {
  if (!isPlainObject(v)) return false;
  return typeof v.id === "string" && Array.isArray(v.weeks);
}

function looksLikeSandbox(v: unknown): v is SandboxState {
  if (!isPlainObject(v)) return false;
  return (
    typeof v.sleep === "number" &&
    typeof v.soreness === "number" &&
    typeof v.recovery === "number" &&
    typeof v.recentProgress === "string" &&
    typeof v.goal === "string"
  );
}

function looksLikeModifiers(v: unknown): v is PersistedModifiers {
  if (!isPlainObject(v)) return false;
  return (
    typeof v.volume === "number" &&
    typeof v.intensity === "number" &&
    typeof v.frequency === "number"
  );
}

function sanitizeProgramRecord(input: unknown): Record<string, Program> {
  if (!isPlainObject(input)) return {};
  const out: Record<string, Program> = {};
  for (const [k, val] of Object.entries(input)) {
    if (looksLikeProgram(val)) out[k] = val;
  }
  return out;
}

function sanitizeModsRecord(input: unknown): Record<string, PersistedModifiers> {
  if (!isPlainObject(input)) return {};
  const out: Record<string, PersistedModifiers> = {};
  for (const [k, val] of Object.entries(input)) {
    if (looksLikeModifiers(val)) out[k] = val;
  }
  return out;
}

/**
 * Read and validate persisted workspace. Returns null on missing/corrupt data.
 */
export function loadPersistedWorkspace(): Partial<PersistedWorkspaceV1> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) return null;
    if (parsed.version !== PERSIST_VERSION) return null;

    const workingPrograms = sanitizeProgramRecord(parsed.workingPrograms);
    const modsMap = sanitizeModsRecord(parsed.modsMap);
    const customMap = sanitizeProgramRecord(parsed.customMap);

    let sandbox: SandboxState | undefined;
    if (parsed.sandbox !== undefined && looksLikeSandbox(parsed.sandbox)) {
      sandbox = { ...defaultSandbox, ...parsed.sandbox };
    }

    let draftIds: string[] | undefined;
    if (Array.isArray(parsed.draftIds) && parsed.draftIds.every((x) => typeof x === "string")) {
      draftIds = parsed.draftIds as string[];
    }

    return { workingPrograms, modsMap, sandbox, customMap, draftIds };
  } catch {
    return null;
  }
}

export function savePersistedWorkspace(payload: {
  workingPrograms: Record<string, Program>;
  modsMap: Record<string, PersistedModifiers>;
  sandbox: SandboxState;
  customMap: Record<string, Program>;
  draftIds: string[];
}): void {
  if (typeof window === "undefined") return;
  try {
    const doc: PersistedWorkspaceV1 = {
      version: PERSIST_VERSION,
      workingPrograms: payload.workingPrograms,
      modsMap: payload.modsMap,
      sandbox: payload.sandbox,
      customMap: payload.customMap,
      draftIds: payload.draftIds,
    };
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(doc));
  } catch {
    // Quota, private mode, or stringify failure — keep in-memory state only.
  }
}
