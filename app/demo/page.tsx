"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { programs as presetPrograms } from "@/lib/mock-data";
import { COACH_HISTORY_KEY } from "@/lib/coach-history";
import { WORKOUT_LOG_STORAGE_KEY } from "@/lib/workout-log";
import { ACTIVE_PLAN_KEY } from "@/lib/active-plan";
import { cn } from "@/lib/utils";

type Status = {
  label: string;
  ok: boolean;
  detail: string;
};

function hasAny(key: string): boolean {
  const raw = window.localStorage.getItem(key);
  if (!raw) return false;
  return raw.trim().length > 2;
}

async function safeGet(url: string): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch(url);
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

export default function DemoPage() {
  const flagship = presetPrograms[0];
  const programId = flagship?.id ?? "unknown";

  const [mounted, setMounted] = useState(false);
  const [seeded, setSeeded] = useState<boolean | null>(null);
  const [evalOk, setEvalOk] = useState<boolean | null>(null);
  const [retrievalOk, setRetrievalOk] = useState<boolean | null>(null);

  useEffect(() => {
    setMounted(true);
    setSeeded(
      hasAny(COACH_HISTORY_KEY) || hasAny(WORKOUT_LOG_STORAGE_KEY) || hasAny(ACTIVE_PLAN_KEY),
    );
    void (async () => {
      const [e, r] = await Promise.all([
        safeGet("/api/eval-report"),
        safeGet("/api/retrieval-report"),
      ]);
      setEvalOk(e.ok);
      setRetrievalOk(r.ok);
    })();
  }, []);

  const statuses: Status[] = useMemo(() => {
    // IMPORTANT: keep server-rendered HTML identical to the first client render to avoid hydration mismatch.
    if (!mounted) {
      return [
        { label: "Demo seed", ok: false, detail: "Checking…" },
        { label: "Model eval report", ok: false, detail: "Checking…" },
        { label: "Retrieval report", ok: false, detail: "Checking…" },
      ];
    }
    return [
      {
        label: "Demo seed",
        ok: seeded === true,
        detail:
          seeded === null
            ? "Checking…"
            : seeded
              ? "History + sessions are present"
              : "Not seeded yet (fresh browser)",
      },
      {
        label: "Model eval report",
        ok: evalOk === true,
        detail:
          evalOk === null
            ? "Checking…"
            : evalOk
              ? "Loaded"
              : "Missing (run `npm run eval:train`)",
      },
      {
        label: "Retrieval report",
        ok: retrievalOk === true,
        detail:
          retrievalOk === null
            ? "Checking…"
            : retrievalOk
              ? "Loaded"
              : "Missing (run `npm run eval:retrieval`)",
      },
    ];
  }, [mounted, seeded, evalOk, retrievalOk]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 md:py-14">
      <header className="rounded-2xl border border-border bg-gradient-to-br from-accent/15 via-background to-background p-8 md:p-10">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Demo hub</div>
        <h1 className="mt-2 font-serif text-4xl tracking-tight md:text-5xl">
          The best 3‑minute walkthrough
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Use these links to showcase Coach, Diagnose (model + retrieval quality), plan history, and
          session logging without editing anything.
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link
            href={`/programs/${programId}/coach`}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Open Coach →
          </Link>
          <Link
            href={`/programs/${programId}/simulate`}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted"
          >
            Open Diagnose →
          </Link>
          <Link
            href={`/programs/${programId}/log`}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted"
          >
            Open Log →
          </Link>
          <Link
            href="/history"
            className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted"
          >
            Open History →
          </Link>
        </div>
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 md:p-8">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Guided script
            </div>
            <h2 className="mt-2 font-serif text-2xl tracking-tight">Say this, click that</h2>
            <ol className="mt-4 space-y-3 text-sm text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Coach:</span> show guided questions →
                analysis → adjusted week plan. Scroll to “Evidence → action”.
              </li>
              <li>
                <span className="font-medium text-foreground">Diagnose:</span> switch predictor
                model → open “Explain” → show Model Quality + Retrieval Quality cards.
              </li>
              <li>
                <span className="font-medium text-foreground">History:</span> show saved Plans vs
                Sessions.
              </li>
              <li>
                <span className="font-medium text-foreground">Log:</span> show Active plan preview →
                log a session note (“fatigue” or “pain”) → re-run Coach to see personalization.
              </li>
            </ol>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 md:p-8">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Utilities</div>
            <h2 className="mt-2 font-serif text-2xl tracking-tight">Reset for clean demos</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              If you’ve clicked around a lot, you can reset the seeded demo history and reseed it.
            </p>
            <div className="mt-4">
              <Link
                href="/demo/reset"
                className="inline-flex rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted"
              >
                Reset demo data
              </Link>
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6 md:p-8">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Demo readiness
            </div>
            <h2 className="mt-2 font-serif text-2xl tracking-tight">Status</h2>
            <div className="mt-4 space-y-3">
              {statuses.map((s) => (
                <div
                  key={s.label}
                  className={cn(
                    "rounded-lg border border-border bg-background p-4",
                    s.ok && "border-emerald-500/30 bg-emerald-500/5",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium">{s.label}</div>
                    <div
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        s.ok
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                      )}
                    >
                      {s.ok ? "Ready" : "Check"}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">{s.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

