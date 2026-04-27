import { NextResponse } from "next/server";
import { CoachBodySchema } from "@/lib/ai/validation";
import { runCoachAnalysis } from "@/lib/coach-engine";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = CoachBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { program, modifiers, sandbox, intake, answers, workoutLog } = parsed.data;
    const out = runCoachAnalysis({ program, modifiers, sandbox, intake, answers, workoutLog });
    return NextResponse.json(out);
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}

