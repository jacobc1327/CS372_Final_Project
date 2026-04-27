"use client";

import { useEffect, useMemo, useState } from "react";
import type { Program } from "@/lib/mock-data";
import { getLogForProgram, type WorkoutLogEntry } from "@/lib/workout-log";
import { getScenariosForProgram, type CoachRunEntry } from "@/lib/coach-history";
import { cn } from "@/lib/utils";
import Link from "next/link";

function fmt(d: string): string {
  try {
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return d;
  }
}

function objectiveLabel(o: string): string {
  switch (o) {
    case "reduce_fatigue":
      return "Reduce fatigue";
    case "break_plateau":
      return "Break plateau";
    case "improve_adherence":
      return "Improve adherence";
    case "maximize_hypertrophy":
      return "Max hypertrophy";
    default:
      return "Coach run";
  }
}

export function ProgramHistoryStrip({
  program,
  onSelectSession,
  onSelectCoachRun,
}: {
  program: Program;
  onSelectSession?: (e: WorkoutLogEntry) => void;
  onSelectCoachRun?: (e: CoachRunEntry) => void;
}) {
  const [sessions, setSessions] = useState<WorkoutLogEntry[]>([]);
  const [plans, setPlans] = useState<CoachRunEntry[]>([]);
  const [tab, setTab] = useState<"plans" | "sessions">("plans");

  useEffect(() => {
    setSessions(getLogForProgram(program.id).slice(0, 8));
    setPlans(getScenariosForProgram(program.id).slice(0, 6));
  }, [program.id]);

  const hasSessions = sessions.length > 0;
  const hasPlans = plans.length > 0;

  const items = useMemo(() => {
    if (tab === "plans") return plans;
    return sessions;
  }, [tab, plans, sessions]);

  return (
    <div className="mt-6 rounded-xl border border-border bg-card px-4 py-4 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Your workflow
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Plans you saved, plus logged sessions.
          </div>
        </div>
        <div className="flex gap-1 rounded-md border border-border bg-background p-1 text-xs">
          <button
            type="button"
            onClick={() => setTab("plans")}
            className={cn(
              "rounded px-3 py-1.5",
              tab === "plans"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Plans
          </button>
          <button
            type="button"
            onClick={() => setTab("sessions")}
            className={cn(
              "rounded px-3 py-1.5",
              tab === "sessions"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Sessions
          </button>
        </div>
      </div>

      {tab === "plans" && !hasPlans ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No saved plans yet — run the Coach and save a plan.
        </p>
      ) : tab === "sessions" && !hasSessions ? (
        <p className="mt-4 text-sm text-muted-foreground">
          No logged sessions yet — log one to build history.
        </p>
      ) : (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {items.map((it) =>
            tab === "sessions" ? (
              <button
                key={(it as WorkoutLogEntry).id}
                type="button"
                onClick={() => onSelectSession?.(it as WorkoutLogEntry)}
                className="min-w-[190px] rounded-lg border border-border/80 bg-background px-3 py-2 text-left transition-colors hover:bg-muted"
              >
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {fmt((it as WorkoutLogEntry).completedAt)}
                </div>
                <div className="mt-1 text-sm font-medium">
                  Week {(it as WorkoutLogEntry).weekNumber} ·{" "}
                  {(it as WorkoutLogEntry).dayOfWeek}
                </div>
                <div className="text-xs text-muted-foreground line-clamp-1">
                  {(it as WorkoutLogEntry).dayName}
                </div>
              </button>
            ) : (
              <button
                key={(it as CoachRunEntry).id}
                type="button"
                onClick={() => onSelectCoachRun?.(it as CoachRunEntry)}
                className="min-w-[220px] rounded-lg border border-border/80 bg-background px-3 py-2 text-left transition-colors hover:bg-muted"
              >
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {fmt((it as CoachRunEntry).createdAt)}
                </div>
                <div className="mt-1 text-sm font-medium">
                  {(it as CoachRunEntry).label ?? objectiveLabel((it as CoachRunEntry).objective)}
                </div>
                <div className="text-xs text-muted-foreground line-clamp-2">
                  {(it as CoachRunEntry).whatChangedTitles.join(" · ")}
                </div>
              </button>
            ),
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-4">
        <Link
          href={`/programs/${program.id}/coach`}
          className="rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Coach →
        </Link>
        <Link
          href={`/programs/${program.id}/log`}
          className="rounded-md border border-border bg-background px-3.5 py-2 text-sm hover:bg-muted"
        >
          Log session
        </Link>
        <Link
          href={`/programs/${program.id}/simulate`}
          className="rounded-md border border-border bg-background px-3.5 py-2 text-sm hover:bg-muted"
        >
          Diagnose
        </Link>
      </div>
    </div>
  );
}

