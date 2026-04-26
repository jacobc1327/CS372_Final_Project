import type { SimulationMetrics, SandboxState } from "@/lib/mock-data";
import { simulateAdaptation } from "@/lib/mock-data";

const PRESERVATION_NOTES = [
  "Main-lift templates and weekly structure stay the same; only global volume %, intensity %, and frequency are tuned.",
  "No exercise substitutions or rep-scheme edits are applied automatically — those remain under your control in the editor.",
];

export interface AdaptationResult {
  volume: number;
  intensity: number;
  frequency: number;
  rationale: string;
  preservationNotes: string[];
}

/**
 * Program-preserving adaptation: delegates to rule-based `simulateAdaptation`,
 * optionally enriching rationale with retrieval-backed context.
 */
export function adaptProgramModifiers(
  metrics: SimulationMetrics,
  sandbox: SandboxState,
  current: { volume: number; intensity: number; frequency: number },
  retrievalContext: string[] = [],
): AdaptationResult {
  const base = simulateAdaptation(metrics, sandbox, current);
  const extra =
    retrievalContext.length > 0
      ? ` · Evidence: ${retrievalContext.slice(0, 2).join(" · ")}`
      : "";
  return {
    volume: base.volume,
    intensity: base.intensity,
    frequency: base.frequency,
    rationale: `${base.rationale}${extra}`.trim(),
    preservationNotes: [...PRESERVATION_NOTES],
  };
}
