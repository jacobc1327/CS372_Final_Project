import { NextResponse } from "next/server";
import { extractProgramFeatures as extractHeuristicFeatures } from "@/lib/features";
import { predictProgramBaseline } from "@/lib/predictor";
import { PredictPostBodySchema, normalizePredictBody } from "@/lib/predict-request";
import { extractProgramFeatures as extractRidgeFeatures } from "@/lib/ai/features";
import { predictMetricsFromFeatures } from "@/lib/ai/predict";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = PredictPostBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { program, modifiers, sandbox } = normalizePredictBody(parsed.data);
    const heuristicFeatures = extractHeuristicFeatures(program, modifiers, sandbox);
    const out = predictProgramBaseline({
      program,
      features: heuristicFeatures,
      modifiers,
      sandbox,
    });

    // Ridge head is trained on the separate `lib/ai/features` vector shape.
    const effectiveFrequencyDays = Math.max(
      1,
      Math.min(7, Math.round(program.daysPerWeek * (modifiers.frequency / 100))),
    );
    const ridgeFeatures = extractRidgeFeatures(
      program,
      modifiers.volume,
      modifiers.intensity,
      effectiveFrequencyDays,
      sandbox,
    );
    const ridge = predictMetricsFromFeatures(ridgeFeatures);

    return NextResponse.json({
      baseline: {
        fatigueScore: out.fatigueScore,
        progressScore: out.progressScore,
        plateauRisk: out.plateauRisk,
        adherenceDifficulty: out.adherenceDifficulty,
      },
      ridge,
      featureSummary: out.featureSummary,
    });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
