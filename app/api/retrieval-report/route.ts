import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const REPORT_PATH = path.join(process.cwd(), "evaluation", "data", "retrieval_report.json");

type RetrievalReport = {
  chunks: number;
  queries: number;
  reports: Array<{
    method: "tfidf" | "bm25" | "hybrid";
    nQueries: number;
    mrr: number;
    recallAt: Record<string, number>;
  }>;
};

let cached: { atMs: number; report: RetrievalReport } | null = null;

export async function GET() {
  try {
    const now = Date.now();
    if (cached && now - cached.atMs < 30_000) {
      return NextResponse.json({ ok: true, report: cached.report });
    }
    if (!fs.existsSync(REPORT_PATH)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Missing retrieval report. Run `npm run eval:retrieval` to generate `evaluation/data/retrieval_report.json`.",
        },
        { status: 404 },
      );
    }
    const raw = fs.readFileSync(REPORT_PATH, "utf8");
    const report = JSON.parse(raw) as RetrievalReport;
    cached = { atMs: now, report };
    return NextResponse.json({ ok: true, report });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to load retrieval report" }, { status: 500 });
  }
}

