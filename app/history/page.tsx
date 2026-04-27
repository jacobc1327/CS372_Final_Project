"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { loadWorkoutLog, type WorkoutLogEntry } from "@/lib/workout-log";
import { loadCoachHistory, type CoachRunEntry } from "@/lib/coach-history";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/components/workspace-provider";

type HistoryItem =
  | { kind: "session"; at: string; entry: WorkoutLogEntry }
  | { kind: "coach"; at: string; entry: CoachRunEntry };

function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function HistoryPage() {
  const { resolveProgram } = useWorkspace();
  const [sessions, setSessions] = useState<WorkoutLogEntry[]>([]);
  const [coachRuns, setCoachRuns] = useState<CoachRunEntry[]>([]);
  const [tab, setTab] = useState<"all" | "sessions" | "plans">("all");
  const [programFilter, setProgramFilter] = useState<string>("all");
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);

  useEffect(() => {
    setSessions(loadWorkoutLog());
    setCoachRuns(loadCoachHistory());
  }, []);

  const items = useMemo(() => {
    const all: HistoryItem[] = [];
    const allowSessions = tab === "all" || tab === "sessions";
    const allowCoach = tab === "all" || tab === "plans";

    if (allowSessions) {
      for (const s of sessions) all.push({ kind: "session", at: s.completedAt, entry: s });
    }
    if (allowCoach) {
      for (const c of coachRuns) {
        if (tab === "plans" && !c.label) continue;
        all.push({ kind: "coach", at: c.createdAt, entry: c });
      }
    }
    const filtered = all.filter((it) => {
      if (programFilter === "all") return true;
      const pid =
        it.kind === "session"
          ? (it.entry as WorkoutLogEntry).programId
          : (it.entry as CoachRunEntry).programId;
      return pid === programFilter;
    });
    return filtered
      .sort((a, b) => (a.at < b.at ? 1 : -1))
      .slice(0, 80);
  }, [sessions, coachRuns, tab, programFilter]);

  const programName = (programId: string): string => {
    const r = resolveProgram(programId);
    return r?.program.name ?? programId;
  };

  const programOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const s of sessions) ids.add(s.programId);
    for (const c of coachRuns) ids.add(c.programId);
    return ["all", ...Array.from(ids).sort((a, b) => programName(a).localeCompare(programName(b)))];
  }, [sessions, coachRuns]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 md:py-14">
      <header className="border-b border-border pb-8">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          History
        </div>
        <h1 className="mt-2 font-serif text-4xl tracking-tight md:text-5xl">
          Past sessions and coach runs
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          This is your timeline across programs (stored in this browser). Use it to jump back into
          coaching or review what you actually did.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            href="/coach"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Go to Coach →
          </Link>
          <Link
            href="/my-programs"
            className="rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted"
          >
            My programs
          </Link>
          <Link
            href="/library"
            className="rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted"
          >
            Library
          </Link>
        </div>
      </header>

      <div className="mt-8 flex gap-1 rounded-md border border-border bg-card p-1 text-xs">
        {[
          ["all", "All"],
          ["sessions", "Sessions"],
          ["plans", "Plans"],
        ].map(([k, l]) => {
          const active = tab === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k as any)}
              className={cn(
                "rounded px-3 py-1.5",
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Program
          <select
            className="ml-2 h-9 rounded-md border border-border bg-card px-2 text-sm normal-case tracking-normal text-foreground"
            value={programFilter}
            onChange={(e) => setProgramFilter(e.target.value)}
          >
            {programOptions.map((id) => (
              <option key={id} value={id}>
                {id === "all" ? "All programs" : programName(id)}
              </option>
            ))}
          </select>
        </label>
        {tab === "plans" && (
          <div className="text-xs text-muted-foreground">
            Tip: plans are labeled coach outputs. Use the Coach page to compare plans A/B.
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border bg-card p-6 md:p-8">
          <div className="text-sm font-medium">Nothing here yet.</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Run the Coach or log a session in the Simulator to start building history.
          </p>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {items.map((it) => (
            <li
              key={`${it.kind}-${(it.entry as any).id}`}
              className="rounded-xl border border-border bg-card p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {it.kind === "session" ? "Session" : "Coach run"} · {fmtDateTime(it.at)}
                  </div>
                  {it.kind === "session" ? (
                    <>
                      <div className="mt-1 text-sm font-medium">
                        {(it.entry as WorkoutLogEntry).programName} · Week{" "}
                        {(it.entry as WorkoutLogEntry).weekNumber} ·{" "}
                        {(it.entry as WorkoutLogEntry).dayOfWeek} ·{" "}
                        {(it.entry as WorkoutLogEntry).dayName}
                      </div>
                      {(it.entry as WorkoutLogEntry).note && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {(it.entry as WorkoutLogEntry).note}
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="mt-1 text-sm font-medium">
                        {programName((it.entry as CoachRunEntry).programId)} ·{" "}
                        {(it.entry as CoachRunEntry).label
                          ? `Plan: ${(it.entry as CoachRunEntry).label}`
                          : (it.entry as CoachRunEntry).objective}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {(it.entry as CoachRunEntry).whatChangedTitles.join(" · ")}
                      </p>
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <Link
                    href={
                      it.kind === "session"
                        ? `/programs/${(it.entry as WorkoutLogEntry).programId}/simulate`
                        : `/programs/${(it.entry as CoachRunEntry).programId}/coach`
                    }
                    className="rounded-md border border-border bg-background px-3 py-1.5 text-sm hover:bg-muted"
                  >
                    Open
                  </Link>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

