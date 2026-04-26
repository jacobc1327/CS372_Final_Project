/**
 * Writes labeled training data for ridge calibration of prediction heads.
 * Run: npx tsx evaluation/export_training.ts
 */
import fs from "node:fs";
import path from "node:path";
import {
  programs,
  calculateMetrics,
  type SandboxState,
} from "../lib/mock-data";
import { extractProgramFeatures, PROGRAM_FEATURE_NAMES } from "../lib/ai/features";

const OUT_DIR = path.join(__dirname, "data");
const OUT_FILE = path.join(OUT_DIR, "training.csv");

function rnd<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomSandbox(): SandboxState {
  return {
    sleep: 4 + Math.random() * 6,
    soreness: Math.floor(Math.random() * 11),
    recovery: Math.random() * 100,
    recentProgress: rnd(["stalled", "slow", "normal", "fast"]),
    goal: rnd(["strength", "balanced", "hypertrophy"]),
  };
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const header = [
    ...PROGRAM_FEATURE_NAMES,
    "fatigueScore",
    "progressScore",
    "plateauRisk",
    "adherenceDifficulty",
  ];
  const lines: string[] = [header.join(",")];

  const n = 12_000;
  for (let i = 0; i < n; i++) {
    const program = programs[Math.floor(Math.random() * programs.length)]!;
    const volume = 55 + Math.random() * 90;
    const intensity = 55 + Math.random() * 70;
    const freqDays = Math.max(
      1,
      Math.min(7, Math.round(program.daysPerWeek * (0.65 + Math.random() * 0.7))),
    );
    const sandbox = randomSandbox();
    const metrics = calculateMetrics(program, volume, intensity, freqDays, sandbox);
    const { vector } = extractProgramFeatures(
      program,
      volume,
      intensity,
      freqDays,
      sandbox,
    );
    lines.push(
      [
        ...vector.map((v) => v.toFixed(6)),
        metrics.fatigueScore,
        metrics.progressScore,
        metrics.plateauRisk,
        metrics.adherenceDifficulty,
      ].join(","),
    );
  }

  fs.writeFileSync(OUT_FILE, lines.join("\n"), "utf8");
  console.log(`Wrote ${n} rows to ${OUT_FILE}`);
}

main();
