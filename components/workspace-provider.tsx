"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  type Program,
  type ProgramBasics,
  type SandboxState,
  defaultSandbox,
  programs as presetPrograms,
  createEmptyProgram,
} from "@/lib/mock-data";
import { loadPersistedWorkspace, savePersistedWorkspace } from "@/lib/workspace-persistence";

export interface Modifiers {
  volume: number;
  intensity: number;
  frequency: number;
}

const DEFAULT_MODS: Modifiers = { volume: 100, intensity: 100, frequency: 100 };

export interface ResolvedProgram {
  program: Program;
  isCustom: boolean;
  isDraft: boolean;
}

interface WorkspaceContextValue {
  // Per-program edited overlay (preset programs)
  getWorkingProgram: (id: string) => Program | null;
  setWorkingProgram: (id: string, program: Program) => void;
  resetWorkingProgram: (id: string) => void;
  hasChanges: (id: string) => boolean;

  // Per-program slider modifiers
  getModifiers: (id: string) => Modifiers;
  setModifiers: (id: string, m: Modifiers) => void;

  // Global sandbox state (shared across simulate page)
  sandbox: SandboxState;
  setSandbox: (s: SandboxState) => void;

  // Custom programs
  customPrograms: Program[];
  isCustom: (id: string) => boolean;
  isDraft: (id: string) => boolean;
  getCustomProgram: (id: string) => Program | null;
  createCustomProgram: (basics: ProgramBasics) => string;
  updateCustomProgram: (id: string, program: Program) => void;
  deleteCustomProgram: (id: string) => void;
  publishCustomProgram: (id: string) => void;

  // Universal resolver (preset overlay or custom)
  resolveProgram: (id: string) => ResolvedProgram | null;

  // Unified commit edit (routes correctly for preset vs custom)
  commitEdit: (id: string, program: Program) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workingPrograms, setWP] = useState<Record<string, Program>>({});
  const [modsMap, setModsMap] = useState<Record<string, Modifiers>>({});
  const [sandbox, setSandbox] = useState<SandboxState>(defaultSandbox);
  const [customMap, setCustomMap] = useState<Record<string, Program>>({});
  const [draftSet, setDraftSet] = useState<Set<string>>(new Set());
  /** After true, localStorage has been read once (client-only). */
  const [hydrated, setHydrated] = useState(false);
  const skipNextSave = useRef(false);

  useEffect(() => {
    const data = loadPersistedWorkspace();
    skipNextSave.current = true;
    if (data) {
      if (data.workingPrograms !== undefined) setWP(data.workingPrograms);
      if (data.modsMap !== undefined) setModsMap(data.modsMap);
      if (data.sandbox !== undefined) setSandbox(data.sandbox);
      if (data.customMap !== undefined) setCustomMap(data.customMap);
      if (data.draftIds !== undefined) setDraftSet(new Set(data.draftIds));
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      savePersistedWorkspace({
        workingPrograms,
        modsMap,
        sandbox,
        customMap,
        draftIds: [...draftSet].sort(),
      });
    }, 450);
    return () => window.clearTimeout(t);
  }, [hydrated, workingPrograms, modsMap, sandbox, customMap, draftSet]);

  const getWorkingProgram = useCallback(
    (id: string) => workingPrograms[id] ?? null,
    [workingPrograms],
  );

  const setWorkingProgram = useCallback((id: string, program: Program) => {
    setWP((prev) => ({ ...prev, [id]: program }));
  }, []);

  const resetWorkingProgram = useCallback((id: string) => {
    setWP((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setModsMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const isCustom = useCallback((id: string) => id in customMap, [customMap]);
  const isDraft = useCallback((id: string) => draftSet.has(id), [draftSet]);

  const hasChanges = useCallback(
    (id: string) => {
      // Custom programs auto-save; never "dirty"
      if (id in customMap) return false;
      if (id in workingPrograms) return true;
      const m = modsMap[id];
      if (!m) return false;
      return m.volume !== 100 || m.intensity !== 100 || m.frequency !== 100;
    },
    [workingPrograms, modsMap, customMap],
  );

  const getModifiers = useCallback(
    (id: string) => modsMap[id] ?? DEFAULT_MODS,
    [modsMap],
  );

  const setModifiers = useCallback((id: string, m: Modifiers) => {
    setModsMap((prev) => ({ ...prev, [id]: m }));
  }, []);

  // Custom program CRUD
  const getCustomProgram = useCallback(
    (id: string) => customMap[id] ?? null,
    [customMap],
  );

  const createCustomProgram = useCallback((basics: ProgramBasics) => {
    const id = `custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const program = createEmptyProgram(id, basics);
    setCustomMap((prev) => ({ ...prev, [id]: program }));
    setDraftSet((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    return id;
  }, []);

  const updateCustomProgram = useCallback((id: string, program: Program) => {
    setCustomMap((prev) => ({ ...prev, [id]: program }));
  }, []);

  const deleteCustomProgram = useCallback((id: string) => {
    setCustomMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setDraftSet((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setModsMap((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const publishCustomProgram = useCallback((id: string) => {
    setDraftSet((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const customPrograms = useMemo(() => Object.values(customMap), [customMap]);

  const resolveProgram = useCallback(
    (id: string): ResolvedProgram | null => {
      // Custom takes precedence
      if (id in customMap) {
        return {
          program: customMap[id],
          isCustom: true,
          isDraft: draftSet.has(id),
        };
      }
      // Preset
      const preset = presetPrograms.find((p) => p.id === id);
      if (!preset) return null;
      return {
        program: workingPrograms[id] ?? preset,
        isCustom: false,
        isDraft: false,
      };
    },
    [customMap, draftSet, workingPrograms],
  );

  const commitEdit = useCallback(
    (id: string, program: Program) => {
      if (id in customMap) {
        setCustomMap((prev) => ({ ...prev, [id]: program }));
      } else {
        setWP((prev) => ({ ...prev, [id]: program }));
      }
    },
    [customMap],
  );

  return (
    <WorkspaceContext.Provider
      value={{
        getWorkingProgram,
        setWorkingProgram,
        resetWorkingProgram,
        hasChanges,
        getModifiers,
        setModifiers,
        sandbox,
        setSandbox,
        customPrograms,
        isCustom,
        isDraft,
        getCustomProgram,
        createCustomProgram,
        updateCustomProgram,
        deleteCustomProgram,
        publishCustomProgram,
        resolveProgram,
        commitEdit,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside WorkspaceProvider");
  return ctx;
}
