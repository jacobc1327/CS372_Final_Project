"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useMemo } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { SessionLogPanel } from "@/components/session-log-panel";
import { getScenariosForProgram } from "@/lib/coach-history";
import { getActivePlanId } from "@/lib/active-plan";

export default function LogPage() {
  const params = useParams<{ id: string }>();
  const { resolveProgram } = useWorkspace();
  const resolved = resolveProgram(params.id);
  if (!resolved) notFound();
  const { program } = resolved;

  const activePlan = useMemo(() => {
    const activeId = getActivePlanId(program.id);
    const plans = getScenariosForProgram(program.id);
    const pick = activeId ? plans.find((p) => p.id === activeId) : null;
    return pick ?? plans[0] ?? null;
  }, [program.id]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 md:py-14">
      <nav className="text-sm text-muted-foreground">
        <Link href={`/programs/${program.id}`} className="hover:text-foreground">
          {program.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Log</span>
      </nav>

      <header className="mt-6 flex flex-wrap items-end justify-between gap-6 border-b border-border pb-8">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Log
          </div>
          <h1 className="mt-2 font-serif text-4xl tracking-tight md:text-5xl">
            Track completed sessions
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Log what you actually did. The Coach uses this history to improve next week’s plan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/programs/${program.id}/coach`}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Coach →
          </Link>
          <Link
            href={`/programs/${program.id}/simulate`}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted"
          >
            Diagnose
          </Link>
          <Link
            href={`/programs/${program.id}/editor`}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted"
          >
            Edit template
          </Link>
        </div>
      </header>

      {activePlan ? (
        <div className="mt-8 rounded-xl border border-border bg-card p-6 md:p-8">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Active plan
          </div>
          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
            <div className="font-serif text-2xl tracking-tight">
              {activePlan.label ?? "Plan"}
            </div>
            <Link
              href={`/programs/${program.id}/coach`}
              className="text-sm text-muted-foreground underline hover:text-foreground"
            >
              Change active plan
            </Link>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {activePlan.plan.weekPreview.map((d, i) => (
              <div
                key={`${d.dayOfWeek}-${i}`}
                className="rounded-lg border border-border/80 bg-background p-4"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <div className="text-sm font-medium">
                    {d.dayOfWeek} · {d.title}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    ~{d.estimatedMinutes}m
                  </div>
                </div>
                {d.main[0] && (
                  <div className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{d.main[0].name}</span>{" "}
                    {d.main[0].sets}×{d.main[0].reps}
                    {d.main[0].intensityPct1RM ? ` @ ${d.main[0].intensityPct1RM}%` : ""}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-8 rounded-xl border border-border bg-card p-6 md:p-8">
          <div className="text-sm font-medium">No saved plan yet.</div>
          <p className="mt-2 text-sm text-muted-foreground">
            Run the Coach and save a plan to make logging and iteration clearer.
          </p>
          <Link
            href={`/programs/${program.id}/coach`}
            className="mt-4 inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Run Coach →
          </Link>
        </div>
      )}

      <div className="mt-8">
        <SessionLogPanel program={program} />
      </div>
    </div>
  );
}

