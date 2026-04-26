import { NextResponse } from "next/server";
import { runAdaptationEngine } from "@/lib/adaptation-engine";
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
    const result = runAdaptationEngine(program, modifiers, sandbox);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
