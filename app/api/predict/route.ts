import { NextResponse } from "next/server";
import { extractProgramFeatures } from "@/lib/features";
import { predictProgramBaseline } from "@/lib/predictor";
import { PredictPostBodySchema, normalizePredictBody } from "@/lib/predict-request";

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
    const features = extractProgramFeatures(program, modifiers, sandbox);
    const out = predictProgramBaseline({ program, features, modifiers, sandbox });
    return NextResponse.json({
      fatigueScore: out.fatigueScore,
      progressScore: out.progressScore,
      plateauRisk: out.plateauRisk,
      adherenceDifficulty: out.adherenceDifficulty,
      featureSummary: out.featureSummary,
    });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
