/**
 * Offline retrieval evaluation for the local markdown knowledge base.
 *
 * We generate a labeled query set from each chunk:
 * - query = `${sourceTitle} ${chunkTitle}` (and a couple variations)
 * - label = that chunk id (sourceFile + chunkTitle)
 *
 * Then we compare retrieval methods via Recall@K + MRR.
 *
 * Run:
 *   npx tsx evaluation/retrieval_eval.ts
 */
import fs from "node:fs";
import path from "node:path";
import { chunkKnowledgeBase, loadKnowledgeBase, retrieveRelevantKnowledge } from "../lib/retrieval";

type Method = "tfidf" | "bm25" | "hybrid";

type QueryCase = {
  query: string;
  expectedSourceFile: string;
  expectedChunkTitle: string;
};

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

function rankPosition(
  results: { sourceFile: string; chunkTitle: string }[],
  expectedSourceFile: string,
  expectedChunkTitle: string,
): number | null {
  const ef = normalize(expectedSourceFile);
  const ect = normalize(expectedChunkTitle);
  for (let i = 0; i < results.length; i++) {
    const r = results[i]!;
    if (normalize(r.sourceFile) === ef && normalize(r.chunkTitle) === ect) return i + 1; // 1-index
  }
  return null;
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
}

function evaluate(method: Method, queries: QueryCase[], ks: number[]) {
  const mrrs: number[] = [];
  const recallAt: Record<number, number[]> = Object.fromEntries(ks.map((k) => [k, []]));

  for (const qc of queries) {
    const topK = Math.max(...ks);
    const res = retrieveRelevantKnowledge(qc.query, topK, { method });
    const pos = rankPosition(res, qc.expectedSourceFile, qc.expectedChunkTitle);
    mrrs.push(pos ? 1 / pos : 0);
    for (const k of ks) {
      recallAt[k]!.push(pos !== null && pos <= k ? 1 : 0);
    }
  }

  return {
    method,
    nQueries: queries.length,
    mrr: mean(mrrs),
    recallAt: Object.fromEntries(ks.map((k) => [k, mean(recallAt[k]!)])),
  };
}

function main() {
  const docs = loadKnowledgeBase();
  const chunks = chunkKnowledgeBase(docs);
  if (chunks.length === 0) {
    console.error("No knowledge chunks found.");
    process.exitCode = 1;
    return;
  }

  const queries: QueryCase[] = [];
  for (const c of chunks) {
    const base = `${c.sourceTitle} ${c.chunkTitle}`.trim();
    const q1 = base;
    const q2 = `${c.chunkTitle} ${c.sourceTitle}`.trim();
    const q3 = `${c.sourceTitle}`.trim();
    queries.push(
      { query: q1, expectedSourceFile: c.sourceFile, expectedChunkTitle: c.chunkTitle },
      { query: q2, expectedSourceFile: c.sourceFile, expectedChunkTitle: c.chunkTitle },
      { query: q3, expectedSourceFile: c.sourceFile, expectedChunkTitle: c.chunkTitle },
    );
  }

  const ks = [1, 3, 5];
  const methods: Method[] = ["tfidf", "bm25", "hybrid"];
  const reports = methods.map((m) => evaluate(m, queries, ks));

  const out = { chunks: chunks.length, queries: queries.length, reports };
  const outDir = path.join(__dirname, "data");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "retrieval_report.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  console.log(JSON.stringify(out, null, 2));
  console.log(`Wrote ${outPath}`);
}

main();

