/**
 * Lightweight retrieval over local markdown knowledge (CS372 — Adaptive Training Program Studio).
 * TF–IDF style scoring for retrieval-backed recommendations; not a conversational agent.
 */

import fs from "node:fs";
import path from "node:path";

export interface KnowledgeDocument {
  /** File basename, e.g. `progressive-overload.md`. */
  sourceFile: string;
  /** Human title from the first `#` heading, else derived from filename. */
  sourceTitle: string;
  /** Full markdown text. */
  rawText: string;
}

export interface KnowledgeChunk {
  id: string;
  sourceFile: string;
  /** Document-level title (same as KnowledgeDocument.sourceTitle). */
  sourceTitle: string;
  /** `##` section heading, or `Overview` for text before the first `##`. */
  chunkTitle: string;
  body: string;
}

export interface RetrievedSnippet {
  sourceTitle: string;
  chunkTitle: string;
  snippet: string;
  sourceFile: string;
  /** Higher is more relevant (TF–IDF sum; not normalized to 1). */
  score: number;
}

const KNOWLEDGE_DIR = path.join(process.cwd(), "data", "knowledge");

export function tokenize(text: string): string[] {
  const m = text.toLowerCase().match(/[a-z0-9]+/g);
  return m ?? [];
}

function titleFromFileName(fileName: string): string {
  return fileName
    .replace(/\.md$/i, "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function extractMainTitle(markdown: string): string | null {
  for (const line of markdown.split(/\r?\n/)) {
    const t = line.trim();
    if (t.startsWith("# ")) return t.slice(2).trim();
    if (t.length > 0) break;
  }
  return null;
}

/**
 * Load all `.md` files from `data/knowledge/`. Server-side only (uses `fs`).
 */
export function loadKnowledgeBase(): KnowledgeDocument[] {
  if (!fs.existsSync(KNOWLEDGE_DIR)) return [];
  const names = fs.readdirSync(KNOWLEDGE_DIR).filter((f) => f.endsWith(".md"));
  const out: KnowledgeDocument[] = [];
  for (const sourceFile of names.sort()) {
    const full = path.join(KNOWLEDGE_DIR, sourceFile);
    const rawText = fs.readFileSync(full, "utf8");
    const sourceTitle = extractMainTitle(rawText) ?? titleFromFileName(sourceFile);
    out.push({ sourceFile, sourceTitle, rawText });
  }
  return out;
}

/**
 * Split each document on `##` headings. Preamble before the first `##` becomes one chunk titled `Overview`.
 */
export function chunkKnowledgeBase(documents: KnowledgeDocument[]): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  for (const doc of documents) {
    const lines = doc.rawText.split(/\r?\n/);
    let i = 0;
    while (i < lines.length && lines[i]!.trim() === "") i++;
    if (i < lines.length && lines[i]!.trim().startsWith("# ")) i++;

    let currentTitle = "Overview";
    const buffer: string[] = [];

    const flush = () => {
      const body = buffer.join("\n").trim();
      buffer.length = 0;
      if (!body) return;
      const slug = `${doc.sourceFile}::${currentTitle}`.replace(/\s+/g, "-").toLowerCase();
      chunks.push({
        id: slug,
        sourceFile: doc.sourceFile,
        sourceTitle: doc.sourceTitle,
        chunkTitle: currentTitle,
        body,
      });
    };

    for (; i < lines.length; i++) {
      const line = lines[i]!;
      if (line.startsWith("## ")) {
        flush();
        currentTitle = line.slice(3).trim();
      } else {
        buffer.push(line);
      }
    }
    flush();
  }
  return chunks;
}

function buildDocumentFrequency(chunks: KnowledgeChunk[]): Map<string, number> {
  const df = new Map<string, number>();
  for (const c of chunks) {
    const unique = new Set(tokenize(`${c.sourceTitle} ${c.chunkTitle} ${c.body}`));
    for (const t of unique) {
      df.set(t, (df.get(t) ?? 0) + 1);
    }
  }
  return df;
}

function tfVector(chunk: KnowledgeChunk): Map<string, number> {
  const tokens = tokenize(`${chunk.sourceTitle} ${chunk.chunkTitle} ${chunk.body}`);
  const tf = new Map<string, number>();
  for (const t of tokens) {
    tf.set(t, (tf.get(t) ?? 0) + 1);
  }
  const len = tokens.length || 1;
  for (const [k, v] of tf) {
    tf.set(k, v / len);
  }
  return tf;
}

function scoreChunk(
  queryTerms: string[],
  chunk: KnowledgeChunk,
  df: Map<string, number>,
  N: number,
): number {
  const tf = tfVector(chunk);
  let score = 0;
  for (const term of queryTerms) {
    const f = tf.get(term);
    if (!f) continue;
    const dfi = df.get(term) ?? 1;
    const idf = Math.log((N + 1) / (dfi + 1)) + 1;
    score += f * idf;
  }
  return score;
}

/**
 * TF–IDF retrieval over chunked markdown. No network calls.
 */
export function retrieveRelevantKnowledge(query: string, topK = 5): RetrievedSnippet[] {
  const q = query.trim();
  if (!q) return [];
  const queryTerms = tokenize(q);
  if (queryTerms.length === 0) return [];

  const docs = loadKnowledgeBase();
  const chunks = chunkKnowledgeBase(docs);
  if (chunks.length === 0) return [];

  const df = buildDocumentFrequency(chunks);
  const N = chunks.length;

  const ranked = chunks
    .map((chunk) => ({
      chunk,
      score: scoreChunk(queryTerms, chunk, df, N),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return ranked.map(({ chunk, score }) => ({
    sourceTitle: chunk.sourceTitle,
    chunkTitle: chunk.chunkTitle,
    snippet:
      chunk.body.replace(/\s+/g, " ").trim().slice(0, 280) + (chunk.body.length > 280 ? "…" : ""),
    sourceFile: chunk.sourceFile,
    score: Math.round(score * 1000) / 1000,
  }));
}
