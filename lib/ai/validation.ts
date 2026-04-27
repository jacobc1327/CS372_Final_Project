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
  method: z.enum(["tfidf", "bm25", "hybrid"]).optional(),
});

export const PlanPatchBodySchema = z.object({
  program: ProgramSchema,
  modifiers: ModifiersSchema,
  sandbox: SandboxSchema,
  objective: z.enum(["reduce_fatigue", "break_plateau", "improve_adherence"]),
});

export const CoachIntakeSchema = z.object({
  profile: z.object({
    goal: z.enum(["strength", "hypertrophy", "balanced"]),
    daysPerWeek: z.number().int().min(1).max(7),
    minutesPerSession: z.number().int().min(20).max(180),
    experience: z.enum(["beginner", "intermediate", "advanced"]),
    equipment: z.enum(["full_gym", "barbell_only", "dumbbells_only", "home_minimal"]),
    constraints: z.string().max(600).optional(),
    preferences: z.string().max(600).optional(),
    avoidMovements: z.string().max(400).optional(),
    emphasis: z.enum(["full_body", "upper", "lower", "arms", "conditioning"]).optional(),
    estimated1RM: z
      .object({
        squat: z.number().min(1).max(1000).optional(),
        bench: z.number().min(1).max(1000).optional(),
        deadlift: z.number().min(1).max(1000).optional(),
        overheadPress: z.number().min(1).max(1000).optional(),
      })
      .optional(),
  }),
  objective: z.enum([
    "reduce_fatigue",
    "break_plateau",
    "improve_adherence",
    "maximize_hypertrophy",
  ]),
});

export const CoachBodySchema = z.object({
  program: ProgramSchema,
  modifiers: ModifiersSchema,
  sandbox: SandboxSchema,
  intake: CoachIntakeSchema,
  answers: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
  workoutLog: z
    .array(
      z.object({
        completedAt: z.string(),
        weekNumber: z.number().int(),
        dayOfWeek: z.string(),
        dayName: z.string(),
        note: z.string().optional(),
      }),
    )
    .max(40)
    .optional(),
});
