import { NextResponse } from "next/server";
import { retrieveRelevantKnowledge } from "@/lib/retrieval";
import { RetrieveBodySchema } from "@/lib/ai/validation";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = RetrieveBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { query, topK } = parsed.data;
    const snippets = retrieveRelevantKnowledge(query, topK ?? 5);
    return NextResponse.json({ snippets });
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}
