import { NextResponse } from "next/server";
import { extractProgramFeatures } from "@/lib/features";
import { predictProgramBaseline } from "@/lib/predictor";
import { adaptProgramModifiers } from "@/lib/ai/adapt";
import { AdaptPostBodySchema, normalizeAdaptPost } from "@/lib/predict-request";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = AdaptPostBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { program, modifiers, sandbox, currentModifiers, retrievalContext } =
      normalizeAdaptPost(parsed.data);
    const features = extractProgramFeatures(program, modifiers, sandbox);
    const pred = predictProgramBaseline({ program, features, modifiers, sandbox });
    const metrics = {
      fatigueScore: pred.fatigueScore,
      progressScore: pred.progressScore,
      plateauRisk: pred.plateauRisk,
      adherenceDifficulty: pred.adherenceDifficulty,
    };
    const adapted = adaptProgramModifiers(
      metrics,
      sandbox,
      currentModifiers,
      retrievalContext,
    );
    return NextResponse.json(adapted);
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
