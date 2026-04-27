import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

const REPORT_PATH = path.join(process.cwd(), "evaluation", "data", "report.json");

type ReportTarget = {
  baseline: { mae: number; rmse: number; r2: number };
  ridge: { mae: number; rmse: number; r2: number };
};

type EvalReport = {
  split: { train: number; val: number; test: number };
  selected_lambda: number;
  targets: Record<string, ReportTarget>;
};

let cached: { atMs: number; report: EvalReport } | null = null;

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
            "Missing evaluation report. Run `npm run eval:train` to generate `evaluation/data/report.json`.",
        },
        { status: 404 },
      );
    }
    const raw = fs.readFileSync(REPORT_PATH, "utf8");
    const report = JSON.parse(raw) as EvalReport;
    cached = { atMs: now, report };
    return NextResponse.json({ ok: true, report });
  } catch {
    return NextResponse.json({ ok: false, error: "Failed to load report" }, { status: 500 });
  }
}

