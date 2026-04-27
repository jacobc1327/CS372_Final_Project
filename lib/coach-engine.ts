import type { Program, SandboxState } from "@/lib/mock-data";
import type { ProgramModifiers } from "@/lib/features";
import { retrieveRelevantKnowledge } from "@/lib/retrieval";
import { generatePlanPatch } from "@/lib/plan-doctor";
import type {
  CoachIntakePayload,
  AdjustedPlan,
  AdjustedPlanDay,
  CoachFollowUpQuestion,
  CoachResponse,
} from "@/lib/coach-types";
import type { PlanChange } from "@/lib/plan-doctor-types";

function estMinutesForDay(day: { exercises: { sets: number }[] }, minutesPerSession: number): number {
  const base = day.exercises.reduce((s, e) => s + Math.max(1, e.sets), 0);
  // Heuristic: ~2.5 min per set + buffer, then clamp to user cap (soft).
  const est = Math.round(base * 2.5 + 10);
  return Math.min(minutesPerSession, Math.max(25, est));
}

function toDayPreview(
  day: { dayOfWeek: string; name: string; focus: string; exercises: any[] },
  minutesPerSession: number,
): AdjustedPlanDay {
  const main = day.exercises
    .filter((e) => typeof e.intensity === "number" && e.intensity > 0)
    .slice(0, 2)
    .map((e) => ({
      name: e.name,
      sets: e.sets,
      reps: e.reps,
      intensityPct1RM: e.intensity,
    }));
  const accessories = day.exercises
    .filter((e) => !e.intensity || e.intensity <= 0)
    .slice(0, 5)
    .map((e) => ({ name: e.name, sets: e.sets, reps: e.reps }));

  return {
    dayOfWeek: day.dayOfWeek,
    title: day.name,
    focus: day.focus,
    estimatedMinutes: estMinutesForDay(day, minutesPerSession),
    main,
    accessories,
  };
}

function chooseObjective(payload: CoachIntakePayload): "reduce_fatigue" | "break_plateau" | "improve_adherence" {
  if (payload.objective === "maximize_hypertrophy") return "break_plateau";
  if (payload.objective === "reduce_fatigue") return "reduce_fatigue";
  if (payload.objective === "break_plateau") return "break_plateau";
  return "improve_adherence";
}

function noteSignal(note?: string): "fatigue" | "pain" | "none" {
  const t = (note ?? "").toLowerCase();
  if (!t) return "none";
  if (t.match(/\b(pain|hurt|injur|tweak)\b/)) return "pain";
  if (t.match(/\b(sore|tired|fatigue|burnt|exhaust)\b/)) return "fatigue";
  return "none";
}

function applyExerciseSwaps(program: Program, swapMap: Map<string, string>): Program {
  if (swapMap.size === 0) return program;
  return {
    ...program,
    weeks: program.weeks.map((w) => ({
      ...w,
      days: w.days.map((d) => ({
        ...d,
        exercises: d.exercises.map((e) => {
          const nextName = swapMap.get(e.name);
          return nextName ? { ...e, name: nextName } : e;
        }),
      })),
    })),
  };
}

function changeTitle(c: PlanChange): string {
  switch (c.kind) {
    case "toggle_deload":
      return c.deload ? `Add deload (Week ${c.weekNumber})` : `Remove deload (Week ${c.weekNumber})`;
    case "sets_delta":
      return `${c.delta > 0 ? "Add" : "Reduce"} sets (${c.where})`;
    case "intensity_delta":
      return `${c.deltaPct1RM > 0 ? "Increase" : "Reduce"} intensity (${c.deltaPct1RM}%)`;
    default:
      return "Adjust program";
  }
}

function changeDetail(c: PlanChange): string {
  switch (c.kind) {
    case "toggle_deload":
      return c.deload
        ? "Insert a deload week to reduce accumulated fatigue and keep quality high."
        : "Remove a deload week to keep momentum when recovery signals look strong.";
    case "sets_delta":
      return c.delta > 0
        ? `Add ${Math.abs(c.delta)} set(s) to increase weekly volume stimulus (${c.where}).`
        : `Remove ${Math.abs(c.delta)} set(s) to reduce weekly volume load (${c.where}).`;
    case "intensity_delta":
      return `Shift main lift intensity by ${c.deltaPct1RM}% and clamp to ${c.min}–${c.max}% 1RM for manageability.`;
    default:
      return "";
  }
}

function tokenizeTiny(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((t) => t.length >= 4);
}

function scoreEvidenceForChange(changeText: string, snippetText: string): number {
  const a = new Set(tokenizeTiny(changeText));
  if (a.size === 0) return 0;
  const b = new Set(tokenizeTiny(snippetText));
  let hit = 0;
  for (const t of a) if (b.has(t)) hit++;
  return hit / Math.max(6, a.size);
}

export function runCoachAnalysis(input: {
  program: Program;
  modifiers: ProgramModifiers;
  sandbox: SandboxState;
  intake: CoachIntakePayload;
  answers?: Record<string, string | number>;
  workoutLog?: {
    completedAt: string;
    weekNumber: number;
    dayOfWeek: string;
    dayName: string;
    note?: string;
  }[];
}): CoachResponse {
  const { program, modifiers, sandbox, intake, answers, workoutLog } = input;

  const followUps: CoachFollowUpQuestion[] = [];
  const timeCap = intake.profile.minutesPerSession;
  const hasConstraints = !!intake.profile.constraints?.trim();
  const avoid = intake.profile.avoidMovements?.trim() ?? "";
  const has1RM =
    !!intake.profile.estimated1RM &&
    Object.values(intake.profile.estimated1RM).some((v) => v != null);

  if (!has1RM && answers?.top_set_method == null) {
    followUps.push({
      id: "top_set_method",
      prompt:
        "Optional but improves precision: do you want to estimate strength from a recent top set or skip lift-specific calibration?",
      type: "select",
      options: [
        { value: "skip", label: "Skip (use template-only signals)" },
        { value: "estimate", label: "Estimate from a recent top set" },
      ],
    });
  }
  if (timeCap <= 45 && answers?.time_priority == null) {
    followUps.push({
      id: "time_priority",
      prompt: "With a 45-minute cap, which is most important on busy days?",
      type: "select",
      options: [
        { value: "main_lift", label: "Keep the main lift" },
        { value: "accessories", label: "Keep accessories/pump work" },
        { value: "balanced", label: "Balanced" },
      ],
    });
  }
  if (hasConstraints && answers?.pain_policy == null) {
    followUps.push({
      id: "pain_policy",
      prompt: "If a movement aggravates symptoms, what should the coach do?",
      type: "select",
      options: [
        { value: "swap", label: "Swap exercises to a safer pattern" },
        { value: "reduce", label: "Reduce range/load but keep the movement" },
        { value: "avoid", label: "Avoid the pattern entirely" },
      ],
    });
  }
  if (avoid && answers?.avoid_policy == null) {
    followUps.push({
      id: "avoid_policy",
      prompt: "You listed movements to avoid. Should the coach fully replace those patterns?",
      type: "select",
      options: [
        { value: "replace", label: "Yes — always replace them" },
        { value: "optional", label: "Only replace if they show up a lot" },
      ],
    });
  }
  if (!intake.profile.emphasis && answers?.emphasis == null) {
    followUps.push({
      id: "emphasis",
      prompt: "Any emphasis you want this week?",
      type: "select",
      options: [
        { value: "full_body", label: "Full body / balanced" },
        { value: "upper", label: "Upper body" },
        { value: "lower", label: "Lower body" },
        { value: "arms", label: "Arms" },
        { value: "conditioning", label: "Conditioning" },
      ],
    });
  }

  if (followUps.length > 0) return { kind: "followup", questions: followUps.slice(0, 3) };

  // Personalization: bias objective if recent notes suggest fatigue/pain.
  let objective = chooseObjective(intake);
  if (workoutLog && workoutLog.length > 0) {
    const sig = noteSignal(workoutLog[0]?.note);
    if (sig === "pain") objective = "improve_adherence";
    if (sig === "fatigue") objective = "reduce_fatigue";
  }

  // Use deterministic patching under the hood, but present it as an “adjusted plan”.
  let patch = generatePlanPatch({ program, modifiers, sandbox, objective });

  // Apply explicit swaps requested by the user (back-and-forth).
  const swapMap = new Map<string, string>();
  for (const [k, v] of Object.entries(answers ?? {})) {
    if (!k.startsWith("swap:")) continue;
    const from = k.slice("swap:".length);
    if (typeof v === "string" && v.trim()) swapMap.set(from, v.trim());
  }
  if (swapMap.size > 0) {
    const swappedProgram = applyExerciseSwaps(patch.patchedProgram, swapMap);
    patch = { ...patch, patchedProgram: swappedProgram };
  }

  const query = [
    program.name,
    program.category,
    intake.profile.goal,
    intake.profile.experience,
    intake.profile.equipment,
    intake.profile.minutesPerSession <= 45 ? "time cap 45 minutes" : "session time",
    intake.profile.constraints ?? "",
    intake.profile.preferences ?? "",
    intake.profile.avoidMovements ?? "",
    intake.profile.emphasis ?? (typeof answers?.emphasis === "string" ? answers.emphasis : ""),
    patch.title,
  ]
    .filter(Boolean)
    .join(" ");

  const snippets = retrieveRelevantKnowledge(query, 6, { method: "hybrid" });
  const evidence = snippets.slice(0, 3).map((s) => ({
    title: `${s.sourceTitle}${s.chunkTitle ? ` · ${s.chunkTitle}` : ""}`,
    snippet: s.snippet,
  }));

  const evidenceLinks =
    (patch.changes ?? []).length === 0
      ? []
      : patch.changes.slice(0, 6).map((c) => {
          const ct = changeTitle(c as any);
          const cd = changeDetail(c as any);
          const combined = `${ct} ${cd} ${patch.title} ${patch.summary}`;
          const ranked = evidence
            .map((e) => ({
              e,
              score: scoreEvidenceForChange(combined, `${e.title} ${e.snippet}`),
            }))
            .sort((a, b) => b.score - a.score)
            .filter((x) => x.score > 0)
            .slice(0, 2)
            .map((x) => x.e);
          return { changeTitle: ct, changeDetail: cd, evidence: ranked.length ? ranked : evidence.slice(0, 1) };
        });

  const week0 = patch.patchedProgram.weeks[0];
  const weekPreview: AdjustedPlanDay[] =
    week0?.days.map((d) => toDayPreview(d as any, intake.profile.minutesPerSession)) ?? [];

  const warnings: string[] = [];
  if (intake.profile.minutesPerSession <= 45) {
    warnings.push("45-minute cap selected — prioritize main work if you’re running long.");
  }
  if (intake.profile.constraints?.trim()) {
    warnings.push("Constraints noted — use substitutions if any movement aggravates symptoms.");
  }
  if (workoutLog && workoutLog.length > 0) {
    const last = workoutLog
      .slice()
      .sort((a, b) => (a.completedAt < b.completedAt ? 1 : -1))[0]!;
    warnings.push(
      `Recent history: last logged session was Week ${last.weekNumber} · ${last.dayOfWeek} (${new Date(last.completedAt).toLocaleDateString()}).`,
    );
  }

  if (swapMap.size > 0) {
    warnings.push("Exercise swaps applied from your selections.");
  }

  const plan: AdjustedPlan = {
    headline: "Adjusted plan generated for your goals and constraints",
    whatChanged: [
      {
        title: patch.title,
        detail: patch.summary,
        evidence,
      },
      {
        title: "Why these changes",
        detail:
          "The coach optimizes for your objective while preserving the program’s weekly rhythm. It trims the highest-cost stimulus first and uses deloads/intensity waves when signals suggest staleness or recovery mismatch.",
      },
    ],
    evidenceLinks,
    weekPreview,
    progressionRules: [
      {
        title: "Progression rule (simple)",
        detail:
          "If your final set of the main lift feels like RPE ≤ 8 and form stays clean, add a small load next time (+2.5–5 lb / +1–2.5 kg). If it feels like RPE ≥ 9, hold load and aim to improve reps/quality.",
      },
      {
        title: "Recovery override",
        detail:
          "If sleep is <6.5h for 2+ nights or soreness stays high, keep intensity the same and drop 1 accessory set for that session.",
      },
    ],
    warnings,
  };

  return { kind: "result", plan, patchedProgram: patch.patchedProgram };
}

