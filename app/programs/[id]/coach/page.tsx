"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { ProgramHistoryStrip } from "@/components/program-history-strip";
import type { CoachProfile } from "@/lib/coach-profile";
import { loadCoachProfile, saveCoachProfile } from "@/lib/coach-profile";
import type {
  CoachIntakePayload,
  CoachObjective,
  AdjustedPlan,
  CoachResponse,
  CoachFollowUpQuestion,
} from "@/lib/coach-types";
import type { Program } from "@/lib/mock-data";
import { appendCoachRun } from "@/lib/coach-history";
import type { WorkoutLogEntry } from "@/lib/workout-log";
import type { CoachRunEntry } from "@/lib/coach-history";
import { getLogForProgram } from "@/lib/workout-log";
import { EXERCISE_LIBRARY, type LibraryExercise } from "@/lib/mock-data";
import { getScenariosForProgram, setCoachRunLabel } from "@/lib/coach-history";
import { setActivePlanId } from "@/lib/active-plan";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type CoachApiResponse = CoachResponse;

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(t || res.statusText);
  }
  return res.json() as Promise<T>;
}

type Step = "intake" | "analyzing" | "results";

export default function CoachPage() {
  const params = useParams<{ id: string }>();
  const { resolveProgram, getModifiers, sandbox, commitEdit } = useWorkspace();

  const resolved = resolveProgram(params.id);
  if (!resolved) notFound();
  const { program } = resolved;
  const mods = getModifiers(program.id);

  const [step, setStep] = useState<Step>("intake");
  const [objective, setObjective] = useState<CoachObjective>("reduce_fatigue");
  const [profile, setProfile] = useState<CoachProfile>(() => {
    return (
      loadCoachProfile() ?? {
        goal: "balanced",
        daysPerWeek: program.daysPerWeek,
        minutesPerSession: 60,
        experience: "intermediate",
        equipment: "full_gym",
        emphasis: "full_body",
      }
    );
  });

  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("Ready");
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<AdjustedPlan | null>(null);
  const [patchedProgram, setPatchedProgram] = useState<Program | null>(null);
  const [followUps, setFollowUps] = useState<CoachFollowUpQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [scenarioName, setScenarioName] = useState("");
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [openCompare, setOpenCompare] = useState(false);
  const [openSwap, setOpenSwap] = useState(false);
  const [swapFrom, setSwapFrom] = useState<string | null>(null);
  const [swapQuery, setSwapQuery] = useState("");
  const [openHistory, setOpenHistory] = useState(false);
  const [historyMode, setHistoryMode] = useState<"session" | "coach">("session");
  const [selectedSession, setSelectedSession] = useState<WorkoutLogEntry | null>(null);
  const [selectedCoachRun, setSelectedCoachRun] = useState<CoachRunEntry | null>(null);

  const intake: CoachIntakePayload = useMemo(
    () => ({ profile, objective }),
    [profile, objective],
  );

  const scenarios = useMemo(() => getScenariosForProgram(program.id).slice(0, 8), [program.id]);
  const scenarioById = useMemo(() => {
    const m = new Map<string, CoachRunEntry>();
    for (const s of scenarios) m.set(s.id, s);
    return m;
  }, [scenarios]);

  const swapOptions = useMemo(() => {
    const q = swapQuery.trim().toLowerCase();
    const eq = profile.equipment;
    return EXERCISE_LIBRARY.filter((e) => {
      if (q && !e.name.toLowerCase().includes(q)) return false;
      if (eq === "dumbbells_only") {
        return (
          e.name.toLowerCase().includes("dumbbell") ||
          e.name.toLowerCase().includes("goblet") ||
          e.name.toLowerCase().includes("push-up") ||
          e.defaultIntensity === 0
        );
      }
      if (eq === "home_minimal") {
        return (
          e.name.toLowerCase().includes("push-up") ||
          e.name.toLowerCase().includes("goblet") ||
          e.defaultIntensity === 0
        );
      }
      if (eq === "barbell_only") {
        return (
          e.family === "squat" ||
          e.family === "hinge" ||
          e.name.toLowerCase().includes("bench") ||
          e.name.toLowerCase().includes("press") ||
          e.name.toLowerCase().includes("row") ||
          e.defaultIntensity > 0
        );
      }
      return true;
    }).slice(0, 60);
  }, [swapQuery, profile.equipment]);

  useEffect(() => {
    saveCoachProfile(profile);
  }, [profile]);

  const runAnalysis = async () => {
    setError(null);
    setStep("analyzing");
    setPlan(null);
    setPatchedProgram(null);
    setFollowUps(null);

    // Staged progress bar (UX), while the API runs in parallel.
    const stages = [
      { label: "Understanding your constraints", pct: 18, ms: 420 },
      { label: "Analyzing your current plan", pct: 42, ms: 520 },
      { label: "Searching training knowledge", pct: 66, ms: 640 },
      { label: "Generating an adjusted week", pct: 82, ms: 540 },
      { label: "Final checks", pct: 94, ms: 520 },
    ];

    let cancelled = false;
    const tick = (async () => {
      let cur = 0;
      setProgress(0);
      for (const s of stages) {
        if (cancelled) return;
        setStage(s.label);
        const steps = 10;
        const start = cur;
        for (let i = 1; i <= steps; i++) {
          if (cancelled) return;
          const v = start + ((s.pct - start) * i) / steps;
          setProgress(Math.round(v));
          await new Promise((r) => setTimeout(r, Math.round(s.ms / steps)));
        }
        cur = s.pct;
      }
    })();

    try {
      const out = await postJson<CoachApiResponse>("/api/coach", {
        program,
        modifiers: {
          volume: mods.volume,
          intensity: mods.intensity,
          frequency: mods.frequency,
        },
        sandbox,
        intake,
        answers,
        workoutLog: getLogForProgram(program.id).slice(0, 20).map((e) => ({
          completedAt: e.completedAt,
          weekNumber: e.weekNumber,
          dayOfWeek: e.dayOfWeek,
          dayName: e.dayName,
          note: e.note,
        })),
      });
      if (out.kind === "followup") {
        setFollowUps(out.questions);
        setStage("Follow-up needed");
        setProgress(100);
        setStep("intake");
      } else {
        setPlan(out.plan);
        setPatchedProgram(out.patchedProgram as Program);
        // Intentionally NOT auto-saving as a "plan" to reduce clutter/confusion.
        // Users explicitly save a labeled plan in the Plans panel.
        setStage("Done");
        setProgress(100);
        setStep("results");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Coach analysis failed");
      setStep("intake");
    } finally {
      cancelled = true;
      void tick;
    }
  };

  const applyToWorkspace = () => {
    if (!patchedProgram) return;
    commitEdit(program.id, patchedProgram);
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:py-14">
      <nav className="text-sm text-muted-foreground">
        <Link href={`/programs/${program.id}`} className="hover:text-foreground">
          {program.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Coach</span>
      </nav>

      <header className="mt-6 flex flex-wrap items-end justify-between gap-6 border-b border-border pb-8">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            AI Coach
          </div>
          <h1 className="mt-2 font-serif text-4xl tracking-tight md:text-5xl">
            Let’s tune your program
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Answer a few questions. The coach will analyze your plan, match training principles, and
            generate an adjusted week you can actually follow.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/programs/${program.id}/editor`}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted"
          >
            ← Back to editor
          </Link>
          <Link
            href={`/programs/${program.id}/simulate`}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted"
          >
            Simulator
          </Link>
        </div>
      </header>

      <ProgramHistoryStrip
        program={program}
        onSelectSession={(e) => {
          setSelectedSession(e);
          setSelectedCoachRun(null);
          setHistoryMode("session");
          setOpenHistory(true);
        }}
        onSelectCoachRun={(e) => {
          setSelectedCoachRun(e);
          setSelectedSession(null);
          setHistoryMode("coach");
          setOpenHistory(true);
        }}
      />

      <Dialog open={openHistory} onOpenChange={setOpenHistory}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {historyMode === "session" ? "Logged session" : "Coach run"}
            </DialogTitle>
          </DialogHeader>

          {historyMode === "session" && selectedSession && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  {new Date(selectedSession.completedAt).toLocaleString()}
                </div>
                <div className="mt-1 font-medium">
                  Week {selectedSession.weekNumber} · {selectedSession.dayOfWeek} ·{" "}
                  {selectedSession.dayName}
                </div>
                {selectedSession.note && (
                  <p className="mt-2 text-muted-foreground">{selectedSession.note}</p>
                )}
              </div>
              <Link
                href={`/programs/${program.id}/simulate`}
                className="inline-flex rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted"
              >
                Open simulator log
              </Link>
            </div>
          )}

          {historyMode === "coach" && selectedCoachRun && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-card p-3">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  {new Date(selectedCoachRun.createdAt).toLocaleString()}
                </div>
                <div className="mt-1 text-sm font-medium">
                  {selectedCoachRun.plan.headline}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Objective: <span className="text-foreground">{selectedCoachRun.objective}</span>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-card p-3">
                <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Week preview
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {selectedCoachRun.plan.weekPreview.map((d, i) => (
                    <div key={`${d.dayOfWeek}-${i}`} className="rounded-md border border-border/70 bg-background p-3">
                      <div className="flex items-baseline justify-between gap-2">
                        <div className="text-sm font-medium">
                          {d.dayOfWeek} · {d.title}
                        </div>
                        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          ~{d.estimatedMinutes}m
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground line-clamp-1">{d.focus}</div>
                      {d.main[0] && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{d.main[0].name}</span>{" "}
                          {d.main[0].sets}×{d.main[0].reps}
                          {d.main[0].intensityPct1RM ? ` @ ${d.main[0].intensityPct1RM}%` : ""}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    commitEdit(program.id, selectedCoachRun.patchedProgram);
                    setOpenHistory(false);
                  }}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Save this plan to editor
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setObjective(selectedCoachRun.objective);
                    setProfile(selectedCoachRun.intake.profile);
                    setStep("results");
                    setPlan(selectedCoachRun.plan);
                    setPatchedProgram(selectedCoachRun.patchedProgram);
                    setOpenHistory(false);
                  }}
                  className="rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted"
                >
                  Re-open in Coach
                </button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {step === "intake" && (
        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1fr]">
          <section className="rounded-xl border border-border bg-card p-6 md:p-8">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Step 1
            </div>
            <h2 className="mt-2 font-serif text-2xl tracking-tight">
              What should the coach optimize for?
            </h2>
            <div className="mt-5 grid gap-2">
              <ObjectiveButton
                active={objective === "reduce_fatigue"}
                title="Reduce fatigue"
                desc="Keep the program’s main structure, lower recovery cost."
                onClick={() => setObjective("reduce_fatigue")}
              />
              <ObjectiveButton
                active={objective === "break_plateau"}
                title="Break plateau"
                desc="Add a small wave/variation to disrupt staleness."
                onClick={() => setObjective("break_plateau")}
              />
              <ObjectiveButton
                active={objective === "improve_adherence"}
                title="Improve adherence"
                desc="Make sessions easier to complete and recover from."
                onClick={() => setObjective("improve_adherence")}
              />
              <ObjectiveButton
                active={objective === "maximize_hypertrophy"}
                title="Maximize hypertrophy"
                desc="Bias toward growth stimulus within your constraints."
                onClick={() => setObjective("maximize_hypertrophy")}
              />
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-6 md:p-8">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Step 2
            </div>
            <h2 className="mt-2 font-serif text-2xl tracking-tight">
              Tell me about you
            </h2>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <LabeledSelect
                label="Goal"
                value={profile.goal}
                onChange={(v) => setProfile((p) => ({ ...p, goal: v as any }))}
                options={[
                  ["strength", "Strength"],
                  ["balanced", "Balanced"],
                  ["hypertrophy", "Hypertrophy"],
                ]}
              />
              <LabeledSelect
                label="Experience"
                value={profile.experience}
                onChange={(v) => setProfile((p) => ({ ...p, experience: v as any }))}
                options={[
                  ["beginner", "Beginner"],
                  ["intermediate", "Intermediate"],
                  ["advanced", "Advanced"],
                ]}
              />
              <LabeledSelect
                label="Equipment"
                value={profile.equipment}
                onChange={(v) => setProfile((p) => ({ ...p, equipment: v as any }))}
                options={[
                  ["full_gym", "Full gym"],
                  ["barbell_only", "Barbell only"],
                  ["dumbbells_only", "Dumbbells only"],
                  ["home_minimal", "Home minimal"],
                ]}
              />
              <LabeledSelect
                label="Emphasis"
                value={profile.emphasis ?? "full_body"}
                onChange={(v) => setProfile((p) => ({ ...p, emphasis: v as any }))}
                options={[
                  ["full_body", "Full body / balanced"],
                  ["upper", "Upper body"],
                  ["lower", "Lower body"],
                  ["arms", "Arms"],
                  ["conditioning", "Conditioning"],
                ]}
              />
              <LabeledNumber
                label="Minutes per session"
                value={profile.minutesPerSession}
                min={20}
                max={180}
                step={5}
                onChange={(n) => setProfile((p) => ({ ...p, minutesPerSession: n }))}
              />
              <LabeledNumber
                label="Days per week"
                value={profile.daysPerWeek}
                min={1}
                max={7}
                step={1}
                onChange={(n) => setProfile((p) => ({ ...p, daysPerWeek: n }))}
              />
            </div>

            <label className="mt-4 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Constraints (optional)
              <textarea
                className="mt-1.5 block min-h-[72px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="e.g. knee pain with deep squats, no overhead pressing"
                value={profile.constraints ?? ""}
                onChange={(e) => setProfile((p) => ({ ...p, constraints: e.target.value }))}
              />
            </label>
            <label className="mt-3 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Movements to avoid (optional)
              <textarea
                className="mt-1.5 block min-h-[72px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="e.g. deep knee flexion, heavy hinging, overhead press"
                value={profile.avoidMovements ?? ""}
                onChange={(e) => setProfile((p) => ({ ...p, avoidMovements: e.target.value }))}
              />
            </label>
            <label className="mt-3 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
              Preferences (optional)
              <textarea
                className="mt-1.5 block min-h-[72px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="e.g. want more arms, prefer RPE 7–8 work"
                value={profile.preferences ?? ""}
                onChange={(e) => setProfile((p) => ({ ...p, preferences: e.target.value }))}
              />
            </label>

            {followUps && followUps.length > 0 && (
              <div className="mt-5 rounded-lg border border-amber-500/35 bg-amber-500/[0.06] p-4">
                <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  One more thing
                </div>
                <p className="mt-2 text-sm text-foreground/90">
                  I can be more specific with a couple quick answers.
                </p>
                <div className="mt-4 space-y-3">
                  {followUps.map((q) => (
                    <div key={q.id}>
                      <div className="text-xs font-medium text-muted-foreground">{q.prompt}</div>
                      {q.type === "select" ? (
                        <select
                          className="mt-1.5 block h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
                          value={String(answers[q.id] ?? "")}
                          onChange={(e) =>
                            setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                          }
                        >
                          <option value="" disabled>
                            Select…
                          </option>
                          {(q.options ?? []).map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : q.type === "number" ? (
                        <input
                          type="number"
                          className="mt-1.5 block h-10 w-full rounded-md border border-border bg-background px-2 text-sm tabular-nums"
                          value={Number(answers[q.id] ?? "")}
                          min={q.min}
                          max={q.max}
                          step={q.step ?? 1}
                          onChange={(e) =>
                            setAnswers((a) => ({ ...a, [q.id]: Number(e.target.value) }))
                          }
                        />
                      ) : (
                        <input
                          type="text"
                          className="mt-1.5 block h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
                          value={String(answers[q.id] ?? "")}
                          onChange={(e) =>
                            setAnswers((a) => ({ ...a, [q.id]: e.target.value }))
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Then click “Run coach analysis” again.
                </p>
              </div>
            )}

            {error && (
              <p className="mt-3 rounded-md border border-accent/40 bg-accent/5 px-3 py-2 text-sm text-accent">
                {error}
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void runAnalysis()}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Run coach analysis →
              </button>
              <Link
                href={`/programs/${program.id}/editor`}
                className="rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted"
              >
                Edit program instead
              </Link>
            </div>
          </section>
        </div>
      )}

      {step === "analyzing" && (
        <div className="mt-10 rounded-xl border border-border bg-card p-6 md:p-10">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Analyzing
          </div>
          <h2 className="mt-2 font-serif text-3xl tracking-tight">
            Building your adjusted week
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            {stage}. This is where we’ll later plug in deeper retrieval and optional LLM calls.
          </p>
          <div className="mt-6">
            <Progress value={progress} />
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>{stage}</span>
              <span className="tabular-nums">{progress}%</span>
            </div>
          </div>
          <div className="mt-6 text-xs text-muted-foreground">
            Tip: You can keep moving the sandbox sliders in the Simulator — the Coach will use the
            same recovery context.
          </div>
        </div>
      )}

      {step === "results" && plan && (
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="rounded-xl border border-border bg-card p-6 md:p-8">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Your adjusted week
            </div>
            <h2 className="mt-2 font-serif text-3xl tracking-tight">
              {plan.headline}
            </h2>

            <div className="mt-6 grid gap-3 md:grid-cols-2">
              {plan.weekPreview.map((d, i) => (
                <div
                  key={`${d.dayOfWeek}-${i}`}
                  className="rounded-lg border border-border bg-background p-4"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="text-sm font-medium">
                      {d.dayOfWeek} · {d.title}
                    </div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      ~{d.estimatedMinutes} min
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{d.focus}</div>

                  {d.main.length > 0 && (
                    <div className="mt-3">
                      <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                        Main work
                      </div>
                      <ul className="mt-1 space-y-1 text-sm">
                        {d.main.map((m, j) => (
                          <li key={`${m.name}-${j}`} className="text-foreground/90">
                            <span className="font-medium">{m.name}</span>{" "}
                            <span className="text-muted-foreground">
                              {m.sets}×{m.reps}
                              {m.intensityPct1RM ? ` @ ${m.intensityPct1RM}%` : ""}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setSwapFrom(m.name);
                                setSwapQuery("");
                                setOpenSwap(true);
                              }}
                              className="ml-2 text-xs text-muted-foreground underline hover:text-foreground"
                            >
                              Swap
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {d.accessories.length > 0 && (
                    <div className="mt-3">
                      <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                        Accessories
                      </div>
                      <ul className="mt-1 space-y-1 text-sm text-muted-foreground">
                        {d.accessories.map((a, j) => (
                          <li key={`${a.name}-${j}`}>
                            {a.name} · {a.sets}×{a.reps}
                            <button
                              type="button"
                              onClick={() => {
                                setSwapFrom(a.name);
                                setSwapQuery("");
                                setOpenSwap(true);
                              }}
                              className="ml-2 text-xs underline hover:text-foreground"
                            >
                              Swap
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-xl border border-border bg-card p-6 md:p-8">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                Iterate
              </div>
              <h3 className="mt-2 font-serif text-2xl tracking-tight">
                Regenerate with a twist
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Quickly re-run the coach with a different optimization target.
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setObjective("reduce_fatigue");
                    void runAnalysis();
                  }}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted"
                >
                  Less fatigue
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setObjective("maximize_hypertrophy");
                    void runAnalysis();
                  }}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted"
                >
                  More hypertrophy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setObjective("improve_adherence");
                    void runAnalysis();
                  }}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted"
                >
                  Easier sessions
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setObjective("break_plateau");
                    void runAnalysis();
                  }}
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted"
                >
                  Break plateau
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-6 md:p-8">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                What changed
              </div>
              <h3 className="mt-2 font-serif text-2xl tracking-tight">
                The coach’s rationale
              </h3>
              <ul className="mt-5 space-y-4">
                {plan.whatChanged.map((c, i) => (
                  <li key={`${c.title}-${i}`} className="rounded-lg border border-border/80 bg-background p-4">
                    <div className="text-sm font-medium">{c.title}</div>
                    <p className="mt-1 text-sm text-muted-foreground">{c.detail}</p>
                    {c.evidence && c.evidence.length > 0 && (
                      <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
                        {c.evidence.map((ev, j) => (
                          <blockquote key={`${ev.title}-${j}`} className="border-l-2 border-border pl-3 text-xs text-muted-foreground">
                            <cite className="not-italic text-[11px] font-medium text-foreground/80">
                              {ev.title}
                            </cite>
                            <p className="mt-1">{ev.snippet}</p>
                          </blockquote>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {plan.evidenceLinks && plan.evidenceLinks.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-6 md:p-8">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  Evidence → action
                </div>
                <h3 className="mt-2 font-serif text-2xl tracking-tight">
                  Why each change is supported
                </h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Each change is linked to the most relevant knowledge snippets the coach retrieved.
                </p>
                <div className="mt-5 space-y-4">
                  {plan.evidenceLinks.slice(0, 6).map((x) => (
                    <div key={x.changeTitle} className="rounded-lg border border-border/80 bg-background p-4">
                      <div className="text-sm font-medium">{x.changeTitle}</div>
                      <p className="mt-1 text-sm text-muted-foreground">{x.changeDetail}</p>
                      {x.evidence.length > 0 && (
                        <div className="mt-3 grid gap-3 border-t border-border/60 pt-3 md:grid-cols-2">
                          {x.evidence.map((ev) => (
                            <div key={ev.title} className="rounded-md border border-border bg-card p-3">
                              <div className="text-[11px] font-medium text-foreground/80">{ev.title}</div>
                              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{ev.snippet}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-border bg-card p-6 md:p-8">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                Progression
              </div>
              <h3 className="mt-2 font-serif text-2xl tracking-tight">
                How to run it
              </h3>
              <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
                {plan.progressionRules.map((r) => (
                  <li key={r.title}>
                    <span className="font-medium text-foreground">{r.title}.</span>{" "}
                    {r.detail}
                  </li>
                ))}
              </ul>
              {plan.warnings.length > 0 && (
                <div className="mt-5 rounded-lg border border-accent/30 bg-accent/5 p-4 text-sm text-muted-foreground">
                  <div className="text-[10px] font-medium uppercase tracking-widest text-accent">
                    Notes
                  </div>
                  <ul className="mt-2 list-inside list-disc space-y-1">
                    {plan.warnings.map((w, i) => (
                      <li key={`${w}-${i}`}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={applyToWorkspace}
                  disabled={!patchedProgram}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Save adjusted plan to editor
                </button>
                <button
                  type="button"
                  onClick={() => setStep("intake")}
                  className="rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted"
                >
                  Ask different questions
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 md:p-8">
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                Plans
              </div>
              <h3 className="mt-2 font-serif text-2xl tracking-tight">
                Save and compare
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Name this coach output so you can compare plans later.
              </p>
              <div className="mt-4 flex gap-2">
                <input
                  className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm"
                  value={scenarioName}
                  placeholder="e.g. 45-min cut, Hypertrophy bias"
                  onChange={(e) => setScenarioName(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!plan || !patchedProgram) return;
                    const entry = appendCoachRun({
                      programId: program.id,
                      intake,
                      plan,
                      patchedProgram,
                      label: scenarioName.trim() || "Plan",
                    });
                    setActivePlanId(program.id, entry.id);
                    setScenarioName("");
                  }}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Save plan
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Tip: open a saved plan from the History strip above (Coach tab).
              </p>

              {scenarios.length > 0 && (
                <div className="mt-4 border-t border-border/60 pt-4">
                  <div className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                    Saved plans
                  </div>
                  <ul className="space-y-2">
                    {scenarios.map((s) => {
                      const a = compareA === s.id;
                      const b = compareB === s.id;
                      return (
                        <li
                          key={s.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/70 bg-background px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">
                              {s.label ?? "Plan"}
                            </div>
                            <div className="truncate text-xs text-muted-foreground">
                              {s.whatChangedTitles.join(" · ")}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setCompareA(s.id)}
                              className={cn(
                                "rounded-md border px-2 py-1 text-[11px]",
                                a
                                  ? "border-foreground/20 bg-foreground text-background"
                                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                              )}
                            >
                              A
                            </button>
                            <button
                              type="button"
                              onClick={() => setCompareB(s.id)}
                              className={cn(
                                "rounded-md border px-2 py-1 text-[11px]",
                                b
                                  ? "border-foreground/20 bg-foreground text-background"
                                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                              )}
                            >
                              B
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const next = window.prompt("Rename scenario", s.label ?? "");
                                if (next == null) return;
                                setCoachRunLabel(s.id, next);
                              }}
                              className="rounded-md border border-border px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                commitEdit(program.id, s.patchedProgram);
                              }}
                              className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
                            >
                              Apply
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  <button
                    type="button"
                    disabled={!compareA || !compareB || compareA === compareB}
                    onClick={() => setOpenCompare(true)}
                    className="mt-3 w-full rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-muted disabled:opacity-50"
                  >
                    Compare plans (A vs B)
                  </button>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      <Dialog open={openCompare} onOpenChange={setOpenCompare}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Compare plans</DialogTitle>
          </DialogHeader>
          {compareA && compareB ? (
            <div className="grid gap-4 md:grid-cols-2">
              {([["A", compareA], ["B", compareB]] as const).map(([label, id]) => {
                const s = scenarioById.get(id);
                if (!s) return null;
                return (
                  <div key={id} className="rounded-lg border border-border bg-card p-4">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Plan {label}
                    </div>
                    <div className="mt-1 text-sm font-medium">{s.label ?? "Plan"}</div>
                    <div className="mt-3">
                      <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                        Week preview
                      </div>
                      <ul className="mt-2 space-y-2 text-sm">
                        {s.plan.weekPreview.map((d, i) => (
                          <li key={`${d.dayOfWeek}-${i}`} className="rounded-md border border-border/70 bg-background px-3 py-2">
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="font-medium">
                                {d.dayOfWeek} · {d.title}
                              </div>
                              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                                ~{d.estimatedMinutes}m
                              </div>
                            </div>
                            {d.main[0] && (
                              <div className="mt-1 text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">{d.main[0].name}</span>{" "}
                                {d.main[0].sets}×{d.main[0].reps}
                                {d.main[0].intensityPct1RM ? ` @ ${d.main[0].intensityPct1RM}%` : ""}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Select A and B first.</p>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={openSwap} onOpenChange={setOpenSwap}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Swap exercise</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Replaces <span className="font-medium text-foreground">{swapFrom ?? "—"}</span> in the
            adjusted plan. The coach will re-run analysis with your swap.
          </p>
          <input
            className="mt-2 h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            placeholder="Search exercises…"
            value={swapQuery}
            onChange={(e) => setSwapQuery(e.target.value)}
          />
          <div className="mt-3 max-h-[360px] overflow-auto rounded-md border border-border">
            <ul className="divide-y divide-border">
              {swapOptions.map((e: LibraryExercise) => (
                <li
                  key={e.name}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{e.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {e.family} · {e.group}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (!swapFrom) return;
                      setAnswers((a) => ({ ...a, [`swap:${swapFrom}`]: e.name }));
                      setOpenSwap(false);
                      void runAnalysis();
                    }}
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-xs hover:bg-muted"
                  >
                    Use
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ObjectiveButton({
  active,
  title,
  desc,
  onClick,
}: {
  active: boolean;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border p-4 text-left transition-colors",
        active ? "border-foreground/25 bg-muted" : "border-border bg-background hover:bg-muted",
      )}
    >
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-1 text-xs text-muted-foreground">{desc}</div>
    </button>
  );
}

function LabeledSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: [string, string][];
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-xs font-medium uppercase tracking-widest text-muted-foreground">
      {label}
      <select
        className="mt-1.5 block h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

function LabeledNumber({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block text-xs font-medium uppercase tracking-widest text-muted-foreground">
      {label}
      <input
        type="number"
        className="mt-1.5 block h-10 w-full rounded-md border border-border bg-background px-2 text-sm tabular-nums"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

