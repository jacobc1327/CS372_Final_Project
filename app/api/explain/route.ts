import { NextResponse } from "next/server";
import { PredictPostBodySchema, normalizePredictBody } from "@/lib/predict-request";
import { extractProgramFeatures as extractRidgeFeatures } from "@/lib/ai/features";
import modelWeights from "@/lib/ai/weights.json";

type TargetKey = keyof typeof modelWeights.targets;

function niceName(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/\b(norm)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

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
    const effectiveFrequencyDays = Math.max(
      1,
      Math.min(7, Math.round(program.daysPerWeek * (modifiers.frequency / 100))),
    );
    const f = extractRidgeFeatures(
      program,
      modifiers.volume,
      modifiers.intensity,
      effectiveFrequencyDays,
      sandbox,
    );

    const names = modelWeights.featureNames;
    const vector = f.vector;

    const targets = Object.keys(modelWeights.targets) as TargetKey[];
    const out = targets.map((t) => {
      const head = modelWeights.targets[t];
      const contributions = names.map((feature, i) => {
        const x = vector[i] ?? 0;
        const w = head.coef[i] ?? 0;
        return {
          feature,
          label: niceName(feature),
          x,
          w,
          contrib: x * w,
          abs: Math.abs(x * w),
        };
      });
      contributions.sort((a, b) => b.abs - a.abs);
      const scoreRaw =
        head.intercept +
        contributions.reduce((s, c) => s + c.contrib, 0);
      return {
        target: t,
        intercept: head.intercept,
        scoreRaw,
        topPositive: contributions.filter((c) => c.contrib > 0).slice(0, 6),
        topNegative: contributions.filter((c) => c.contrib < 0).slice(0, 6),
      };
    });

    return NextResponse.json({
      targets: out,
      meta: {
        note: "Ridge linear attribution: contribution = feature_value * weight (intercept excluded).",
      },
    });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}

