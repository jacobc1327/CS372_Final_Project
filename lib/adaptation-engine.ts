/**
 * Program-preserving adaptation with retrieval-backed reasoning (CS372).
 * Prefers small global dials (volume %, intensity %, frequency %) over program switching.
 */

import type { Program, SandboxState, SimulationMetrics } from "@/lib/mock-data";
import { simulateAdaptation } from "@/lib/mock-data";
import { extractProgramFeatures, type ProgramModifiers } from "@/lib/features";
import { predictProgramBaseline } from "@/lib/predictor";
import { retrieveRelevantKnowledge, type RetrievedSnippet } from "@/lib/retrieval";

export interface AdaptApiMetrics {
  fatigueScore: number;
  progressScore: number;
  plateauRisk: number;
  adherenceDifficulty: number;
}

export type StructuredRecType = "optimization" | "warning" | "maintain" | "recovery";

export interface SupportingEvidenceItem {
  sourceTitle: string;
  chunkTitle: string;
  snippet: string;
  score: number;
}

export interface StructuredRecommendation {
  title: string;
  type: StructuredRecType;
  /** What lever or theme this touches (machine-readable). */
  target: string;
  /** Concrete delta, e.g. "-12% global volume". */
  adjustment: string;
  reasoning: string;
  expectedImpact: string;
  /** 0–1 heuristic from signal strength and evidence match. */
  confidence: number;
  supportingEvidence: SupportingEvidenceItem[];
}

export interface AdaptApiResult {
  currentMetrics: AdaptApiMetrics;
  adaptedModifiers: ProgramModifiers;
  adaptedMetrics: AdaptApiMetrics;
  recommendations: StructuredRecommendation[];
  narrative: string;
}

function toMetrics(out: ReturnType<typeof predictProgramBaseline>): AdaptApiMetrics {
  return {
    fatigueScore: out.fatigueScore,
    progressScore: out.progressScore,
    plateauRisk: out.plateauRisk,
    adherenceDifficulty: out.adherenceDifficulty,
  };
}

function metricsToSimulation(m: AdaptApiMetrics): SimulationMetrics {
  return {
    fatigueScore: m.fatigueScore,
    progressScore: m.progressScore,
    plateauRisk: m.plateauRisk,
    adherenceDifficulty: m.adherenceDifficulty,
  };
}

function buildRetrievalQuery(program: Program, sandbox: SandboxState, m: AdaptApiMetrics): string {
  const parts = [
    program.name,
    program.category,
    sandbox.recentProgress,
    sandbox.goal,
    "strength training adaptation",
  ];
  if (m.fatigueScore >= 62) parts.push("fatigue deload volume recovery");
  if (m.plateauRisk >= 55) parts.push("plateau progressive overload intensity wave");
  if (m.adherenceDifficulty >= 62) parts.push("adherence frequency scheduling");
  if (m.progressScore >= 68 && m.fatigueScore < 55) parts.push("progress sustainable maintain");
  return parts.join(" ");
}

function toEvidence(s: RetrievedSnippet): SupportingEvidenceItem {
  return {
    sourceTitle: s.sourceTitle,
    chunkTitle: s.chunkTitle,
    snippet: s.snippet.length > 240 ? `${s.snippet.slice(0, 240)}…` : s.snippet,
    score: s.score,
  };
}

function pickEvidence(snippets: RetrievedSnippet[], keywords: string[], max = 2): SupportingEvidenceItem[] {
  const keys = keywords.map((k) => k.toLowerCase());
  const scored = snippets
    .map((s) => {
      const blob = `${s.sourceTitle} ${s.chunkTitle} ${s.snippet}`.toLowerCase();
      const hits = keys.filter((k) => blob.includes(k)).length;
      return { s, hits };
    })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits || b.s.score - a.s.score);
  const seen = new Set<string>();
  const out: SupportingEvidenceItem[] = [];
  for (const { s } of scored) {
    const key = `${s.sourceFile}::${s.chunkTitle}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(toEvidence(s));
    if (out.length >= max) break;
  }
  if (out.length === 0 && snippets[0]) {
    out.push(toEvidence(snippets[0]!));
    if (snippets[1]) out.push(toEvidence(snippets[1]!));
  }
  return out;
}

function pctDelta(before: number, after: number): string {
  const d = after - before;
  if (d === 0) return "No change";
  const sign = d > 0 ? "+" : "";
  return `${sign}${d}% vs current`;
}

function clampConfidence(base: number, evidenceCount: number): number {
  const bump = Math.min(0.12, evidenceCount * 0.04);
  return Math.round(Math.min(0.94, Math.max(0.38, base + bump)) * 100) / 100;
}

function buildRecommendations(
  program: Program,
  modifiers: ProgramModifiers,
  adapted: { volume: number; intensity: number; frequency: number; rationale: string },
  current: AdaptApiMetrics,
  sandbox: SandboxState,
  snippets: RetrievedSnippet[],
): StructuredRecommendation[] {
  const recs: StructuredRecommendation[] = [];
  const dv = adapted.volume - modifiers.volume;
  const di = adapted.intensity - modifiers.intensity;
  const df = adapted.frequency - modifiers.frequency;

  if (dv < -2) {
    recs.push({
      title: "Ease global training volume",
      type: current.fatigueScore >= 62 ? "warning" : "optimization",
      target: "global_volume_pct",
      adjustment: pctDelta(modifiers.volume, adapted.volume),
      reasoning:
        "Lower-body and accessory work contribute disproportionately to fatigue. Trimming global volume mimics cutting secondary sets first while keeping the weekly template.",
      expectedImpact: "Lower fatigue scores within a week or two while preserving main-lift exposure.",
      confidence: clampConfidence(0.72, pickEvidence(snippets, ["volume", "deload", "secondary", "fatigue"], 2).length),
      supportingEvidence: pickEvidence(snippets, ["volume", "deload", "secondary", "accessory", "fatigue"], 2),
    });
  }

  if (di > 2 && current.plateauRisk >= 52) {
    recs.push({
      title: "Small intensity nudge for stale progress",
      type: "optimization",
      target: "global_intensity_pct",
      adjustment: pctDelta(modifiers.intensity, adapted.intensity),
      reasoning:
        "When plateau risk rises, a modest intensity increase can disrupt staleness without rewriting the program’s progression story.",
      expectedImpact: "Better neuromuscular challenge on main patterns; watch bar speed and joint comfort.",
      confidence: clampConfidence(0.62, pickEvidence(snippets, ["intensity", "overload", "wave", "heavy"], 2).length),
      supportingEvidence: pickEvidence(snippets, ["intensity", "overload", "wave", "heavy", "progress"], 2),
    });
  }

  if (di > 2 && current.plateauRisk < 52) {
    recs.push({
      title: "Refine average intensity slightly",
      type: "optimization",
      target: "global_intensity_pct",
      adjustment: pctDelta(modifiers.intensity, adapted.intensity),
      reasoning: "Minor intensity refinement when other signals are stable keeps progression honest without a full rewrite.",
      expectedImpact: "Marginal stimulus increase with limited adherence cost.",
      confidence: clampConfidence(0.55, pickEvidence(snippets, ["intensity", "progress"], 2).length),
      supportingEvidence: pickEvidence(snippets, ["intensity", "progress", "quality"], 2),
    });
  }

  if (dv > 2) {
    recs.push({
      title: "Add sustainable stimulus",
      type: "optimization",
      target: "global_volume_pct",
      adjustment: pctDelta(modifiers.volume, adapted.volume),
      reasoning:
        "Recovery is sufficient while progress lags—controlled volume restores productive overload without abandoning the split.",
      expectedImpact: "Improved progress potential if soreness and sleep remain steady.",
      confidence: clampConfidence(0.68, pickEvidence(snippets, ["volume", "overload", "progress"], 2).length),
      supportingEvidence: pickEvidence(snippets, ["volume", "overload", "progress", "recovery"], 2),
    });
  }

  if (df !== 0) {
    recs.push({
      title: df < 0 ? "Reduce weekly session count slightly" : "Allow higher frequency if schedule permits",
      type: current.adherenceDifficulty >= 62 ? "warning" : "optimization",
      target: "training_frequency_pct",
      adjustment: `Frequency modifier ${adapted.frequency}% (effective days scale with program template).`,
      reasoning:
        df < 0
          ? "Adherence stress is high—one fewer hard day often preserves main lifts while protecting consistency."
          : "Capacity looks available; frequency can rise if joints and sleep tolerate it.",
      expectedImpact: df < 0 ? "Better completion rate and lower burnout risk." : "More practice exposures for technical lifts.",
      confidence: clampConfidence(0.66, pickEvidence(snippets, ["frequency", "adherence", "spread", "recovery"], 2).length),
      supportingEvidence: pickEvidence(snippets, ["frequency", "adherence", "spread", "recovery", "session"], 2),
    });
  }

  if (current.fatigueScore >= 68 && sandbox.recovery < 55) {
    recs.push({
      title: "Plan a dedicated deload week",
      type: "recovery",
      target: "calendar_block",
      adjustment: "Insert ~1 week at roughly 55–65% prior volume; keep exercise menu.",
      reasoning:
        "A deload preserves program identity while letting tissue and motivation rebound—especially when recovery markers are soft.",
      expectedImpact: "Reduced injury risk and renewed capacity for the next loading phase.",
      confidence: clampConfidence(0.78, pickEvidence(snippets, ["deload", "window", "fatigue"], 2).length),
      supportingEvidence: pickEvidence(snippets, ["deload", "window", "fatigue", "volume", "recovery"], 2),
    });
  }

  if (recs.length === 0 || (Math.abs(dv) <= 2 && Math.abs(di) <= 2 && df === 0 && current.fatigueScore < 68)) {
    recs.push({
      title: "Hold the current mesocycle",
      type: "maintain",
      target: "none",
      adjustment: "Keep global dials within ±3%; focus on execution and recovery habits.",
      reasoning:
        "Progress and fatigue look compatible—large changes would add noise without clear upside. Minor tuning only if bar speed drifts.",
      expectedImpact: "Stability: maintain adaptation momentum without program drift.",
      confidence: clampConfidence(0.7, pickEvidence(snippets, ["maintain", "progress", "identity"], 2).length),
      supportingEvidence: pickEvidence(snippets, ["identity", "progress", "adaptation", "structure"], 2),
    });
  }

  const uniq: StructuredRecommendation[] = [];
  const seenTitles = new Set<string>();
  for (const r of recs) {
    if (seenTitles.has(r.title)) continue;
    seenTitles.add(r.title);
    uniq.push(r);
  }

  const sliced = uniq.slice(0, 5);
  const fillers: StructuredRecommendation[] = [
    {
      title: "Keep exercise selection; tune global levers only",
      type: "optimization",
      target: "program_identity",
      adjustment: "No new lifts—use volume/intensity/frequency sliders in the editor.",
      reasoning:
        "Program-preserving adaptation means the same weekly story and main lifts; retrieval notes emphasize global dials before rewrites.",
      expectedImpact: "Clearer athlete buy-in and easier A/B comparison week to week.",
      confidence: clampConfidence(0.58, pickEvidence(snippets, ["adaptation", "identity", "structure"], 2).length),
      supportingEvidence: pickEvidence(snippets, ["adaptation", "identity", "structure", "global"], 2),
    },
    {
      title: "Monitor sleep and soreness alongside bar speed",
      type: "recovery",
      target: "readiness_signals",
      adjustment: "Pause escalation if two readiness checks fail in the same week.",
      reasoning:
        "Small intelligent changes assume honest recovery reporting—sleep and soreness remain leading indicators before touching progression.",
      expectedImpact: "Fewer mistimed pushes when life stress rises outside the gym.",
      confidence: clampConfidence(0.61, pickEvidence(snippets, ["sleep", "soreness", "recovery"], 2).length),
      supportingEvidence: pickEvidence(snippets, ["sleep", "soreness", "recovery", "deload"], 2),
    },
  ];
  for (const f of fillers) {
    if (sliced.length >= 3) break;
    if (!sliced.some((r) => r.title === f.title)) sliced.push(f);
  }
  return sliced.slice(0, 5);
}

function buildNarrative(
  program: Program,
  current: AdaptApiMetrics,
  adapted: AdaptApiMetrics,
  rationale: string,
): string {
  return [
    `${program.name} (${program.category}): fatigue ${current.fatigueScore}/100, progress ${current.progressScore}/100, plateau risk ${current.plateauRisk}/100, adherence load ${current.adherenceDifficulty}/100.`,
    `After suggested dials: fatigue ${adapted.fatigueScore}/100, progress ${adapted.progressScore}/100, plateau ${adapted.plateauRisk}/100, adherence ${adapted.adherenceDifficulty}/100.`,
    `Rationale: ${rationale} Main-lift structure and weekly rhythm stay the same—only global volume, intensity, and frequency percentages move.`,
  ].join(" ");
}

/**
 * Full adaptation pass: predict → retrieve → rule-based modifiers → re-predict → structured recs.
 */
export function runAdaptationEngine(
  program: Program,
  modifiers: ProgramModifiers,
  sandbox: SandboxState,
): AdaptApiResult {
  const features0 = extractProgramFeatures(program, modifiers, sandbox);
  const pred0 = predictProgramBaseline({ program, features: features0, modifiers, sandbox });
  const currentMetrics = toMetrics(pred0);

  const sim = metricsToSimulation(currentMetrics);
  const adaptedRaw = simulateAdaptation(sim, sandbox, modifiers);
  const adaptedModifiers: ProgramModifiers = {
    volume: adaptedRaw.volume,
    intensity: adaptedRaw.intensity,
    frequency: adaptedRaw.frequency,
  };

  const features1 = extractProgramFeatures(program, adaptedModifiers, sandbox);
  const pred1 = predictProgramBaseline({
    program,
    features: features1,
    modifiers: adaptedModifiers,
    sandbox,
  });
  const adaptedMetrics = toMetrics(pred1);

  const query = buildRetrievalQuery(program, sandbox, currentMetrics);
  const snippets = retrieveRelevantKnowledge(query, 10);
  const recommendations = buildRecommendations(
    program,
    modifiers,
    {
      volume: adaptedModifiers.volume,
      intensity: adaptedModifiers.intensity,
      frequency: adaptedModifiers.frequency,
      rationale: adaptedRaw.rationale,
    },
    currentMetrics,
    sandbox,
    snippets,
  );

  const narrative = buildNarrative(program, currentMetrics, adaptedMetrics, adaptedRaw.rationale);

  return {
    currentMetrics,
    adaptedModifiers,
    adaptedMetrics,
    recommendations,
    narrative,
  };
}
