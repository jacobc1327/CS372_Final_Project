"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { loadCoachHistory, type CoachRunEntry } from "@/lib/coach-history";
import { loadWorkoutLog, type WorkoutLogEntry } from "@/lib/workout-log";

function uniq<T>(xs: T[]): T[] {
  const out: T[] = [];
  const seen = new Set<T>();
  for (const x of xs) {
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export default function CoachHubPage() {
  const { resolveProgram } = useWorkspace();
  const [coachRuns, setCoachRuns] = useState<CoachRunEntry[]>([]);
  const [sessions, setSessions] = useState<WorkoutLogEntry[]>([]);

  useEffect(() => {
    setCoachRuns(loadCoachHistory().slice(0, 20));
    setSessions(loadWorkoutLog().slice(0, 20));
  }, []);

  const recentProgramIds = useMemo(() => {
    const fromCoach = coachRuns.map((c) => c.programId);
    const fromSessions = sessions.map((s) => s.programId);
    return uniq([...fromCoach, ...fromSessions]).slice(0, 8);
  }, [coachRuns, sessions]);

  const recentPrograms = useMemo(() => {
    return recentProgramIds
      .map((id) => resolveProgram(id))
      .filter(Boolean)
      .map((r) => r!);
  }, [recentProgramIds, resolveProgram]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 md:py-14">
      <header className="border-b border-border pb-8">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Coach
        </div>
        <h1 className="mt-2 font-serif text-4xl tracking-tight md:text-5xl">
          Start coaching in one click
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Pick a program and run the guided intake. The Coach will generate an adjusted week and
          save the run to your history.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/my-programs"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Choose from My programs →
          </Link>
          <Link
            href="/library"
            className="rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted"
          >
            Browse Library
          </Link>
          <Link
            href="/history"
            className="rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted"
          >
            View History
          </Link>
        </div>
      </header>

      <section className="mt-8">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Recent programs
        </div>
        <h2 className="mt-2 font-serif text-2xl tracking-tight">
          Continue where you left off
        </h2>

        {recentPrograms.length === 0 ? (
          <div className="mt-5 rounded-xl border border-border bg-card p-6 md:p-8">
            <div className="text-sm font-medium">No recent programs yet.</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Run a Coach session from any program page, or log a session in the simulator.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {recentPrograms.map(({ program }) => (
              <div
                key={program.id}
                className="rounded-xl border border-border bg-card p-5"
              >
                <div className="text-sm font-medium">{program.name}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {program.category} · {program.level} · {program.daysPerWeek} days/wk
                </div>
                <div className="mt-4 flex gap-2">
                  <Link
                    href={`/programs/${program.id}/coach`}
                    className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Coach me →
                  </Link>
                  <Link
                    href={`/programs/${program.id}/simulate`}
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted"
                  >
                    Diagnose
                  </Link>
                  <Link
                    href={`/programs/${program.id}/log`}
                    className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted"
                  >
                    Log
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {(coachRuns.length > 0 || sessions.length > 0) && (
        <section className="mt-10 rounded-xl border border-border bg-card p-6 md:p-8">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Latest activity
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border/80 bg-background p-4">
              <div className="text-sm font-medium">Coach runs</div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {coachRuns.slice(0, 4).map((c) => (
                  <li key={c.id} className="flex items-baseline justify-between gap-2">
                    <span className="line-clamp-1">{c.objective}</span>
                    <span className="text-xs">{fmt(c.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-border/80 bg-background p-4">
              <div className="text-sm font-medium">Sessions</div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {sessions.slice(0, 4).map((s) => (
                  <li key={s.id} className="flex items-baseline justify-between gap-2">
                    <span className="line-clamp-1">
                      {s.programName} · {s.dayOfWeek}
                    </span>
                    <span className="text-xs">{fmt(s.completedAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

