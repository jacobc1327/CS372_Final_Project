import { z } from "zod";
import type { Program, SandboxState } from "@/lib/mock-data";
import { defaultSandbox } from "@/lib/mock-data";
import { ProgramSchema } from "@/lib/ai/validation";

const SandboxPartialSchema = z
  .object({
    sleep: z.number().optional(),
    soreness: z.number().optional(),
    recovery: z.number().optional(),
    recentProgress: z.enum(["stalled", "slow", "normal", "fast"]).optional(),
    goal: z.enum(["strength", "balanced", "hypertrophy"]).optional(),
  })
  .optional();

const ModifiersPartialFields = z.object({
  volume: z.number().optional(),
  intensity: z.number().optional(),
  frequency: z.number().optional(),
});

/** POST /api/predict — accepts partial sandbox/modifiers and applies safe defaults. */
export const PredictPostBodySchema = z.object({
  program: ProgramSchema,
  modifiers: ModifiersPartialFields.optional(),
  sandbox: SandboxPartialSchema,
});

export type PredictPostBody = z.infer<typeof PredictPostBodySchema>;

function clampPct(n: number | undefined, fallback: number): number {
  if (typeof n !== "number" || Number.isNaN(n)) return fallback;
  return Math.min(200, Math.max(20, n));
}

function clampSandbox(s: Partial<SandboxState> | undefined): SandboxState {
  const d = defaultSandbox;
  const r = s ?? {};
  return {
    sleep: typeof r.sleep === "number" && !Number.isNaN(r.sleep) ? Math.min(12, Math.max(3, r.sleep)) : d.sleep,
    soreness:
      typeof r.soreness === "number" && !Number.isNaN(r.soreness)
        ? Math.min(10, Math.max(0, r.soreness))
        : d.soreness,
    recovery:
      typeof r.recovery === "number" && !Number.isNaN(r.recovery)
        ? Math.min(100, Math.max(0, r.recovery))
        : d.recovery,
    recentProgress: r.recentProgress ?? d.recentProgress,
    goal: r.goal ?? d.goal,
  };
}

export function normalizePredictBody(
  raw: PredictPostBody,
): { program: Program; modifiers: { volume: number; intensity: number; frequency: number }; sandbox: SandboxState } {
  const m = raw.modifiers ?? {};
  const s = raw.sandbox ?? {};
  return {
    program: raw.program,
    modifiers: {
      volume: clampPct(m.volume, 100),
      intensity: clampPct(m.intensity, 100),
      frequency: clampPct(m.frequency, 100),
    },
    sandbox: clampSandbox(s),
  };
}

export const AdaptPostBodySchema = PredictPostBodySchema.extend({
  currentModifiers: ModifiersPartialFields.optional(),
  retrievalContext: z.array(z.string()).optional(),
});

export type AdaptPostBody = z.infer<typeof AdaptPostBodySchema>;

export function normalizeAdaptPost(raw: AdaptPostBody): {
  program: Program;
  modifiers: { volume: number; intensity: number; frequency: number };
  sandbox: SandboxState;
  currentModifiers: { volume: number; intensity: number; frequency: number };
  retrievalContext: string[];
} {
  const core = normalizePredictBody(raw);
  const cm = raw.currentModifiers ?? {};
  return {
    ...core,
    currentModifiers: {
      volume: clampPct(cm.volume, core.modifiers.volume),
      intensity: clampPct(cm.intensity, core.modifiers.intensity),
      frequency: clampPct(cm.frequency, core.modifiers.frequency),
    },
    retrievalContext: raw.retrievalContext ?? [],
  };
}
