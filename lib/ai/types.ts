import type { Program, Recommendation, SandboxState, SimulationMetrics } from "@/lib/mock-data";

export interface PredictRequestBody {
  program: Program;
  volumeMod: number;
  intensityMod: number;
  /** Effective training days per week after modifier (same semantics as simulator UI). */
  effectiveFrequencyDays: number;
  sandbox: SandboxState;
}

export interface PredictResponseBody {
  metrics: SimulationMetrics;
  features: {
    names: readonly string[];
    vector: number[];
  };
}

export interface AdaptRequestBody extends PredictRequestBody {
  currentModifiers: { volume: number; intensity: number; frequency: number };
  /** Optional retrieval snippets (titles or one-line summaries) to fold into rationale. */
  retrievalContext?: string[];
}

export interface AdaptResponseBody {
  volume: number;
  intensity: number;
  frequency: number;
  rationale: string;
  /** Design notes preserved: template unchanged; only scalar modifiers adjusted. */
  preservationNotes: string[];
}

export interface KnowledgeHit {
  id: string;
  title: string;
  snippet: string;
  score: number;
}

export interface RetrieveRequestBody {
  query: string;
  topK?: number;
}

export interface RetrieveResponseBody {
  hits: KnowledgeHit[];
}

export interface RecommendationWithSources extends Recommendation {
  sources?: string[];
}
