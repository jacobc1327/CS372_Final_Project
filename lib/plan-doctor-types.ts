export type PlanObjective = "reduce_fatigue" | "break_plateau" | "improve_adherence";

export type PlanChange =
  | {
      kind: "toggle_deload";
      weekNumber: number;
      deload: boolean;
    }
  | {
      kind: "sets_delta";
      where: "accessories" | "all";
      delta: number;
    }
  | {
      kind: "intensity_delta";
      deltaPct1RM: number;
      min: number;
      max: number;
    };

export interface RetrievedSnippet {
  sourceTitle: string;
  chunkTitle: string;
  snippet: string;
  sourceFile: string;
  score: number;
}

export interface BaselinePredictionOutput {
  fatigueScore: number;
  progressScore: number;
  plateauRisk: number;
  adherenceDifficulty: number;
  featureSummary: {
    weeklyStressMean: number;
    totalWeeklySets: number;
    averageIntensity: number;
    recoveryAdjustedLoad: number;
    goalAlignment: number;
    stressMonotony: number;
    dominantStressDriver: "volume" | "intensity" | "frequency" | "balanced";
  };
}

export interface PlanPatchResponse {
  objective: PlanObjective;
  title: string;
  summary: string;
  changes: PlanChange[];
  evidence: RetrievedSnippet[];
  before: BaselinePredictionOutput;
  after: BaselinePredictionOutput;
  patchedProgram: unknown;
}

