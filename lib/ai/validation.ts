import { z } from "zod";
import type { Program } from "@/lib/mock-data";

export const SandboxSchema = z.object({
  sleep: z.number(),
  soreness: z.number(),
  recovery: z.number(),
  recentProgress: z.enum(["stalled", "slow", "normal", "fast"]),
  goal: z.enum(["strength", "balanced", "hypertrophy"]),
});

export const ModifiersSchema = z.object({
  volume: z.number(),
  intensity: z.number(),
  frequency: z.number(),
});

/** Payload from our editor/client; checks minimal shape before feature extraction. */
export const ProgramSchema = z.custom<Program>(
  (val): val is Program =>
    typeof val === "object" &&
    val !== null &&
    "id" in val &&
    "weeks" in val &&
    Array.isArray((val as Program).weeks),
);

export const RetrieveBodySchema = z.object({
  query: z.string().min(1),
  topK: z.number().int().min(1).max(12).optional(),
});
