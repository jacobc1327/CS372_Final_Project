import { NextResponse } from "next/server";
import { PlanPatchBodySchema } from "@/lib/ai/validation";
import { generatePlanPatch } from "@/lib/plan-doctor";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = PlanPatchBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { program, modifiers, sandbox, objective } = parsed.data;
    const out = generatePlanPatch({ program, modifiers, sandbox, objective });

    return NextResponse.json(out);
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}

