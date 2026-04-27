/**
 * Demo seed data for course video/demo.
 * Runs client-side only and only when the workspace is empty.
 */

import { programs as presetPrograms, type Program } from "@/lib/mock-data";
import { COACH_HISTORY_KEY, type CoachRunEntry } from "@/lib/coach-history";
import { WORKOUT_LOG_STORAGE_KEY, type WorkoutLogEntry } from "@/lib/workout-log";
import { ACTIVE_PLAN_KEY } from "@/lib/active-plan";
import { COACH_PROFILE_KEY } from "@/lib/coach-profile";

function hasAny(key: string): boolean {
  const raw = window.localStorage.getItem(key);
  if (!raw) return false;
  return raw.trim().length > 2;
}

function uid(prefix: string): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? `${prefix}-${crypto.randomUUID()}`
    : `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

function estMinutes(exercises: { sets: number }[], cap: number): number {
  const sets = exercises.reduce((s, e) => s + Math.max(1, e.sets), 0);
  const m = Math.round(sets * 2.5 + 10);
  return Math.min(cap, Math.max(30, m));
}

function planFromWeek(program: Program, minutesPerSession: number) {
  const w0 = program.weeks[0];
  return (
    w0?.days.map((d) => {
      const main = d.exercises
        .filter((e) => e.intensity > 0)
        .slice(0, 2)
        .map((e) => ({
          name: e.name,
          sets: e.sets,
          reps: e.reps,
          intensityPct1RM: e.intensity,
        }));
      const accessories = d.exercises
        .filter((e) => e.intensity <= 0)
        .slice(0, 5)
        .map((e) => ({ name: e.name, sets: e.sets, reps: e.reps }));
      return {
        dayOfWeek: d.dayOfWeek,
        title: d.name,
        focus: d.focus,
        estimatedMinutes: estMinutes(d.exercises, minutesPerSession),
        main,
        accessories,
      };
    }) ?? []
  );
}

export function seedDemoDataIfEmpty(): void {
  if (typeof window === "undefined") return;

  // Only seed if user has truly no activity.
  if (hasAny(COACH_HISTORY_KEY) || hasAny(WORKOUT_LOG_STORAGE_KEY) || hasAny(ACTIVE_PLAN_KEY)) {
    return;
  }

  const flagship = presetPrograms[0];
  const secondary = presetPrograms[1];
  if (!flagship) return;

  // Seed a reasonable coach profile.
  if (!window.localStorage.getItem(COACH_PROFILE_KEY)) {
    window.localStorage.setItem(
      COACH_PROFILE_KEY,
      JSON.stringify({
        goal: "hypertrophy",
        daysPerWeek: flagship.daysPerWeek,
        minutesPerSession: 60,
        experience: "intermediate",
        equipment: "full_gym",
        emphasis: "upper",
        preferences: "Prefer RPE 7–8 work. Want a bit more arms.",
      }),
    );
  }

  const now = Date.now();
  const planAId = uid("plan");
  const planBId = uid("plan");
  const planCId = uid("plan");
  const planDId = uid("plan");
  const planEId = uid("plan");

  const basePlan = {
    headline: "Adjusted plan generated for your goals and constraints",
    whatChanged: [
      {
        title: "Hypertrophy bias with time realism",
        detail:
          "Balances weekly stress with a hypertrophy goal and keeps sessions close to your time cap by trimming the highest-cost accessory volume first.",
        evidence: [
          {
            title: "Program adaptation · Overview",
            snippet:
              "Small global adjustments are usually safer than rewriting structure; prioritize recovery and adherence before aggressive changes.",
          },
        ],
      },
      {
        title: "What to watch",
        detail:
          "If soreness stays high or sleep drops, hold loads and remove one accessory set for that day.",
      },
    ],
    weekPreview: planFromWeek(flagship, 60),
    progressionRules: [
      {
        title: "Progression",
        detail:
          "If last set feels like RPE ≤ 8, add a small load next week (+1–2.5 kg). If RPE ≥ 9, hold load and aim for cleaner reps.",
      },
    ],
    warnings: ["Demo seed: log sessions to personalize future plans."],
  };

  const coachHistory: CoachRunEntry[] = [
    {
      id: planAId,
      programId: flagship.id,
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 6).toISOString(),
      objective: "maximize_hypertrophy",
      headline: basePlan.headline,
      whatChangedTitles: basePlan.whatChanged.map((x) => x.title),
      label: "Upper bias (60 min)",
      intake: {
        objective: "maximize_hypertrophy",
        profile: {
          goal: "hypertrophy",
          daysPerWeek: flagship.daysPerWeek,
          minutesPerSession: 60,
          experience: "intermediate",
          equipment: "full_gym",
          emphasis: "upper",
          preferences: "Prefer RPE 7–8. More arms.",
        } as any,
      },
      plan: basePlan as any,
      patchedProgram: flagship,
    },
    {
      id: planBId,
      programId: flagship.id,
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 3).toISOString(),
      objective: "reduce_fatigue",
      headline: basePlan.headline,
      whatChangedTitles: ["Recovery-first trim", "Keep main work consistent"],
      label: "Recovery-first (45 min)",
      intake: {
        objective: "reduce_fatigue",
        profile: {
          goal: "balanced",
          daysPerWeek: flagship.daysPerWeek,
          minutesPerSession: 45,
          experience: "intermediate",
          equipment: "full_gym",
          emphasis: "full_body",
        } as any,
      },
      plan: {
        ...basePlan,
        whatChanged: [
          {
            title: "Recovery-first trim",
            detail:
              "Reduces accessory cost to fit 45 minutes and lowers next-day soreness without changing the main lift story.",
          },
          {
            title: "Keep main work consistent",
            detail:
              "Main lifts stay stable; accessories flex based on time and recovery that day.",
          },
        ],
        weekPreview: planFromWeek(flagship, 45),
        evidenceLinks: [
          {
            changeTitle: "Reduce sets (accessories)",
            changeDetail: "Trim accessory volume to lower fatigue and fit the session cap.",
            evidence: [
              {
                title: "Volume management · Practical levers",
                snippet:
                  "When recovery is limited, reduce volume first (especially accessory work) before cutting frequency or changing core structure.",
              },
            ],
          },
        ],
      } as any,
      patchedProgram: flagship,
    },
    {
      id: planCId,
      programId: flagship.id,
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 2).toISOString(),
      objective: "break_plateau",
      headline: basePlan.headline,
      whatChangedTitles: ["Intensity wave", "Add a deload checkpoint"],
      label: "Plateau breaker (wave)",
      intake: {
        objective: "break_plateau",
        profile: {
          goal: "strength",
          daysPerWeek: flagship.daysPerWeek,
          minutesPerSession: 60,
          experience: "intermediate",
          equipment: "full_gym",
          emphasis: "full_body",
          preferences: "Stalled for 3 weeks; want a clear progression structure.",
        } as any,
      },
      plan: {
        ...basePlan,
        whatChanged: [
          {
            title: "Intensity wave",
            detail:
              "Introduces a mild weekly intensity wave to reduce monotony and restore progress when sessions feel identical.",
            evidence: [
              {
                title: "Intensity management · Waves",
                snippet:
                  "Small intensity waves can reduce monotony and manage fatigue while keeping exposure to heavy work.",
              },
            ],
          },
          {
            title: "Add a deload checkpoint",
            detail:
              "Adds a deload week as a planned checkpoint to keep quality high through the block.",
          },
        ],
        weekPreview: planFromWeek(flagship, 60),
      } as any,
      patchedProgram: flagship,
    },
    {
      id: planDId,
      programId: flagship.id,
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 1).toISOString(),
      objective: "improve_adherence",
      headline: basePlan.headline,
      whatChangedTitles: ["Pain-safe swaps", "Shorter sessions"],
      label: "Pain-safe swaps",
      intake: {
        objective: "improve_adherence",
        profile: {
          goal: "balanced",
          daysPerWeek: flagship.daysPerWeek,
          minutesPerSession: 45,
          experience: "intermediate",
          equipment: "full_gym",
          emphasis: "lower",
          constraints: "Knee pain on deep squats; avoid high-impact jumps.",
          avoidMovements: "Deep back squat, jumping",
        } as any,
      },
      plan: {
        ...basePlan,
        whatChanged: [
          {
            title: "Pain-safe swaps",
            detail:
              "Swaps deep squat patterns to knee-friendlier options while preserving weekly lower-body stimulus.",
            evidence: [
              {
                title: "Program adaptation · Constraints",
                snippet:
                  "When constraints exist, preserve the training pattern (hinge/squat/push/pull) while swapping movements to a tolerable variation.",
              },
            ],
          },
        ],
        weekPreview: planFromWeek(flagship, 45),
      } as any,
      patchedProgram: flagship,
    },
  ];

  const week0 = flagship.weeks[0];
  const days = week0?.days ?? [];
  const pickDay = (idx: number) => days[idx % Math.max(1, days.length)]!;

  const workoutLog: WorkoutLogEntry[] = [
    {
      id: uid("log"),
      programId: flagship.id,
      programName: flagship.name,
      weekNumber: 1,
      dayId: pickDay(0).id,
      dayName: pickDay(0).name,
      dayOfWeek: pickDay(0).dayOfWeek,
      completedAt: new Date(now - 1000 * 60 * 60 * 24 * 10).toISOString(),
      note: "Felt good. Added +2.5kg on main lift. Technique solid.",
    },
    {
      id: uid("log"),
      programId: flagship.id,
      programName: flagship.name,
      weekNumber: 1,
      dayId: pickDay(1).id,
      dayName: pickDay(1).name,
      dayOfWeek: pickDay(1).dayOfWeek,
      completedAt: new Date(now - 1000 * 60 * 60 * 24 * 8).toISOString(),
      note: "Soreness high; cut one accessory set. Sleep was low (6h).",
    },
    {
      id: uid("log"),
      programId: flagship.id,
      programName: flagship.name,
      weekNumber: 2,
      dayId: pickDay(2).id,
      dayName: pickDay(2).name,
      dayOfWeek: pickDay(2).dayOfWeek,
      completedAt: new Date(now - 1000 * 60 * 60 * 24 * 6).toISOString(),
      note: "Short on time (45m). Kept main lift, skipped last accessory.",
    },
    {
      id: uid("log"),
      programId: flagship.id,
      programName: flagship.name,
      weekNumber: 2,
      dayId: pickDay(0).id,
      dayName: pickDay(0).name,
      dayOfWeek: pickDay(0).dayOfWeek,
      completedAt: new Date(now - 1000 * 60 * 60 * 24 * 4).toISOString(),
      note: "Fatigue creeping in. Bar speed slower. Might need a deload soon.",
    },
    {
      id: uid("log"),
      programId: flagship.id,
      programName: flagship.name,
      weekNumber: 3,
      dayId: pickDay(1).id,
      dayName: pickDay(1).name,
      dayOfWeek: pickDay(1).dayOfWeek,
      completedAt: new Date(now - 1000 * 60 * 60 * 24 * 2).toISOString(),
      note: "Knee pain on squat depth. Swapped to box squat and it felt better.",
    },
    {
      id: uid("log"),
      programId: flagship.id,
      programName: flagship.name,
      weekNumber: 3,
      dayId: pickDay(2).id,
      dayName: pickDay(2).name,
      dayOfWeek: pickDay(2).dayOfWeek,
      completedAt: new Date(now - 1000 * 60 * 60 * 20).toISOString(),
      note: "Great session. Recovery up. Ready to push next week.",
    },
  ];

  // Optional: seed a second program with a couple history entries so the global History filter looks real.
  if (secondary) {
    coachHistory.push({
      id: planEId,
      programId: secondary.id,
      createdAt: new Date(now - 1000 * 60 * 60 * 24 * 5).toISOString(),
      objective: "reduce_fatigue",
      headline: basePlan.headline,
      whatChangedTitles: ["Reduce monotony", "Keep schedule consistent"],
      label: "Busy-week variant",
      intake: {
        objective: "reduce_fatigue",
        profile: {
          goal: "balanced",
          daysPerWeek: Math.max(3, Math.min(secondary.daysPerWeek, 4)),
          minutesPerSession: 45,
          experience: "beginner",
          equipment: "home_minimal",
          emphasis: "full_body",
        } as any,
      },
      plan: {
        ...basePlan,
        weekPreview: planFromWeek(secondary, 45),
        warnings: ["Demo seed: minimal equipment + time cap."],
      } as any,
      patchedProgram: secondary,
    });

    const w0b = secondary.weeks[0];
    const daysB = w0b?.days ?? [];
    const pickB = (idx: number) => daysB[idx % Math.max(1, daysB.length)]!;
    workoutLog.push({
      id: uid("log"),
      programId: secondary.id,
      programName: secondary.name,
      weekNumber: 1,
      dayId: pickB(0).id,
      dayName: pickB(0).name,
      dayOfWeek: pickB(0).dayOfWeek,
      completedAt: new Date(now - 1000 * 60 * 60 * 24 * 3).toISOString(),
      note: "Quick home session. Felt manageable and sustainable.",
    });
  }

  window.localStorage.setItem(COACH_HISTORY_KEY, JSON.stringify(coachHistory));
  window.localStorage.setItem(WORKOUT_LOG_STORAGE_KEY, JSON.stringify(workoutLog));
  window.localStorage.setItem(ACTIVE_PLAN_KEY, JSON.stringify({ [flagship.id]: planAId }));
}

