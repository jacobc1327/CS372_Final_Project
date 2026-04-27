"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  defaultSandbox,
  weeklyStressSeries,
  type SandboxState,
  type SimulationMetrics,
} from "@/lib/mock-data";
import type { FeatureSummary } from "@/lib/predictor";
import { useWorkspace } from "@/components/workspace-provider";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ProgramReadinessPanel } from "@/components/program-readiness-panel";
import { SessionLogPanel } from "@/components/session-log-panel";
import { assessProgramCompleteness } from "@/lib/program-completeness";
import { ChevronDown } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const EMPTY_METRICS: SimulationMetrics = {
  fatigueScore: 0,
  progressScore: 0,
  plateauRisk: 0,
  adherenceDifficulty: 0,
};

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

type PredictResponse = SimulationMetrics & {
  featureSummary: FeatureSummary;
};

type PredictResponseV2 = {
  baseline: SimulationMetrics;
  ridge: SimulationMetrics;
  featureSummary: FeatureSummary;
};

type EvalReport = {
  split: { train: number; val: number; test: number };
  selected_lambda: number;
  targets: Record<
    string,
    {
      baseline: { mae: number; rmse: number; r2: number };
      ridge: { mae: number; rmse: number; r2: number };
    }
  >;
};

type RetrievalReport = {
  chunks: number;
  queries: number;
  reports: Array<{
    method: "tfidf" | "bm25" | "hybrid";
    nQueries: number;
    mrr: number;
    recallAt: Record<string, number>;
  }>;
};

type ExplainResponse = {
  targets: Array<{
    target: string;
    intercept: number;
    scoreRaw: number;
    topPositive: Array<{
      feature: string;
      label: string;
      x: number;
      w: number;
      contrib: number;
      abs: number;
    }>;
    topNegative: Array<{
      feature: string;
      label: string;
      x: number;
      w: number;
      contrib: number;
      abs: number;
    }>;
  }>;
  meta: { note: string };
};

export default function SimulatePage() {
  const params = useParams<{ id: string }>();

  const {
    resolveProgram,
    getModifiers,
    setModifiers,
    sandbox,
    setSandbox,
  } = useWorkspace();

  const resolved = resolveProgram(params.id);
  if (!resolved) notFound();

  const { program, isCustom } = resolved;
  const mods = getModifiers(program.id);

  const [metrics, setMetrics] = useState<{ baseline: SimulationMetrics; ridge: SimulationMetrics } | null>(null);
  const [baseMetrics, setBaseMetrics] = useState<{ baseline: SimulationMetrics; ridge: SimulationMetrics } | null>(null);
  const [predictLoading, setPredictLoading] = useState(true);
  const [predictError, setPredictError] = useState<string | null>(null);

  const [featureSummary, setFeatureSummary] = useState<FeatureSummary | null>(null);
  const [featureSummaryBaseline, setFeatureSummaryBaseline] =
    useState<FeatureSummary | null>(null);

  const [modelView, setModelView] = useState<"ridge" | "baseline">("ridge");

  const [evalReport, setEvalReport] = useState<EvalReport | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  const [retrievalReport, setRetrievalReport] = useState<RetrievalReport | null>(null);
  const [retrievalError, setRetrievalError] = useState<string | null>(null);

  const [explainOpen, setExplainOpen] = useState(false);
  const [explain, setExplain] = useState<ExplainResponse | null>(null);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [explainLoading, setExplainLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const completeness = useMemo(() => assessProgramCompleteness(program), [program]);

  const stressSeriesCurrent = useMemo(
    () => weeklyStressSeries(program, mods.volume, mods.intensity),
    [program, mods.volume, mods.intensity],
  );
  const stressSeriesBaseline = useMemo(
    () => weeklyStressSeries(program, 100, 100),
    [program],
  );

  const displayMetrics = (metrics ? metrics[modelView] : null) ?? EMPTY_METRICS;
  const displayBase = (baseMetrics ? baseMetrics[modelView] : null) ?? EMPTY_METRICS;

  useEffect(() => {
    // Dashboard-only: no recommendation state to clear here.
  }, [program, mods.volume, mods.intensity, mods.frequency, sandbox]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/eval-report");
        const json = (await res.json()) as { ok: boolean; report?: EvalReport; error?: string };
        if (!alive) return;
        if (!json.ok || !json.report) {
          setEvalError(json.error ?? "Evaluation report unavailable");
          return;
        }
        setEvalReport(json.report);
      } catch (e) {
        if (!alive) return;
        setEvalError(e instanceof Error ? e.message : "Evaluation report unavailable");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const res = await fetch("/api/retrieval-report");
        const json = (await res.json()) as {
          ok: boolean;
          report?: RetrievalReport;
          error?: string;
        };
        if (!alive) return;
        if (!json.ok || !json.report) {
          setRetrievalError(json.error ?? "Retrieval report unavailable");
          return;
        }
        setRetrievalReport(json.report);
      } catch (e) {
        if (!alive) return;
        setRetrievalError(e instanceof Error ? e.message : "Retrieval report unavailable");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void (async () => {
        setPredictLoading(true);
        setPredictError(null);
        try {
          const bodyCurrent = {
            program,
            modifiers: {
              volume: mods.volume,
              intensity: mods.intensity,
              frequency: mods.frequency,
            },
            sandbox,
          };
          const bodyBase = {
            program,
            modifiers: { volume: 100, intensity: 100, frequency: 100 },
            sandbox: defaultSandbox,
          };
          const [cur, base] = await Promise.all([
            postJson<PredictResponseV2>("/api/predict", bodyCurrent),
            postJson<PredictResponseV2>("/api/predict", bodyBase),
          ]);
          setMetrics({ baseline: cur.baseline, ridge: cur.ridge });
          setBaseMetrics({ baseline: base.baseline, ridge: base.ridge });
          setFeatureSummary(cur.featureSummary);
          setFeatureSummaryBaseline(base.featureSummary);
        } catch (e) {
          setPredictError(e instanceof Error ? e.message : "Prediction failed");
        } finally {
          setPredictLoading(false);
        }
      })();
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [program, mods.volume, mods.intensity, mods.frequency, sandbox]);

  // This page is intentionally a dashboard (signals + charts + logging).
  // All prescriptive recommendations live in the Coach flow.

  const updateSandbox = (patch: Partial<SandboxState>) =>
    setSandbox({ ...sandbox, ...patch });

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 md:py-14">
      <nav className="text-sm text-muted-foreground">
        {isCustom ? (
          <Link href="/my-programs" className="hover:text-foreground">
            My programs
          </Link>
        ) : (
          <Link href="/library" className="hover:text-foreground">
            Library
          </Link>
        )}
        <span className="mx-2">/</span>
        <Link
          href={`/programs/${program.id}`}
          className="hover:text-foreground"
        >
          {program.name}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Diagnose</span>
      </nav>

      <header className="mt-6 flex flex-wrap items-end justify-between gap-6 border-b border-border pb-8">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Diagnose
          </div>
          <h1 className="mt-2 font-serif text-4xl tracking-tight md:text-5xl">
            What would happen if…
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Adjust your sandbox below. The diagnostics model estimates how this program
            — with your edits and modifiers — would interact with your current
            recovery state.
          </p>
        </div>

        <Link
          href={`/programs/${program.id}/editor`}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted"
        >
          ← Back to editor
        </Link>
      </header>

      <ProgramReadinessPanel result={completeness} context="simulate" />

      <div className="mt-10 grid gap-10 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="order-2 lg:order-1 space-y-6 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-xl border border-border bg-card p-6 md:p-8">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Diagnose
            </div>
            <h2 className="mt-2 font-serif text-2xl tracking-tight">
              Scoreboard
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Switch models, open explanations, and see how your current sandbox changes the four outcomes.
            </p>
          </div>

          {predictError && (
            <div
              className="rounded-lg border border-accent/40 bg-accent/5 px-4 py-3 text-sm text-accent"
              role="alert"
            >
              {predictError}
            </div>
          )}

          <div
            className={cn(
              "relative grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2",
              predictLoading && "opacity-70",
            )}
          >
            <div className="col-span-full border-b border-border bg-card px-4 py-3 md:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Predictor model
                  </div>
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    Compare the hand-tuned baseline vs the ridge-calibrated head.
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <SegmentedField
                    label=""
                    value={modelView}
                    options={[
                      { v: "ridge", l: "Ridge (trained)" },
                      { v: "baseline", l: "Heuristic (baseline)" },
                    ]}
                    onChange={(v) => setModelView(v as "ridge" | "baseline")}
                  />
                  <Sheet open={explainOpen} onOpenChange={setExplainOpen}>
                    <SheetTrigger asChild>
                      <button
                        className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted"
                        onClick={() => {
                          setExplainOpen(true);
                          if (modelView !== "ridge") return;
                          if (explain || explainLoading) return;
                          setExplainLoading(true);
                          setExplainError(null);
                          void (async () => {
                            try {
                              const bodyCurrent = {
                                program,
                                modifiers: {
                                  volume: mods.volume,
                                  intensity: mods.intensity,
                                  frequency: mods.frequency,
                                },
                                sandbox,
                              };
                              const out = await postJson<ExplainResponse>("/api/explain", bodyCurrent);
                              setExplain(out);
                            } catch (e) {
                              setExplainError(e instanceof Error ? e.message : "Explain failed");
                            } finally {
                              setExplainLoading(false);
                            }
                          })();
                        }}
                      >
                        Explain
                      </button>
                    </SheetTrigger>
                    <SheetContent className="sm:max-w-lg">
                      <SheetHeader>
                        <SheetTitle>Why these numbers?</SheetTitle>
                        <SheetDescription>
                          Ridge attribution (linear): feature value × weight, plus an intercept.
                        </SheetDescription>
                      </SheetHeader>
                      <div className="px-4 pb-4">
                        {modelView !== "ridge" ? (
                          <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
                            Explanation is currently available for the trained ridge model only.
                            Switch the toggle to “Ridge (trained)”.
                          </div>
                        ) : explainLoading && !explain ? (
                          <div className="text-sm text-muted-foreground">Computing attribution…</div>
                        ) : explainError ? (
                          <div className="rounded-lg border border-accent/40 bg-accent/5 p-4 text-sm text-accent">
                            {explainError}
                          </div>
                        ) : !explain ? (
                          <div className="text-sm text-muted-foreground">No explanation available.</div>
                        ) : (
                          <div className="space-y-4">
                            {explain.targets.map((t) => (
                              <ExplainTargetCard key={t.target} t={t} />
                            ))}
                          </div>
                        )}
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              </div>
            </div>
            {predictLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/30 backdrop-blur-[1px]">
                <span className="rounded-md border border-border bg-card px-3 py-1.5 font-serif text-sm text-muted-foreground">
                  Updating prediction…
                </span>
              </div>
            )}
            <MetricCell
              label="Fatigue"
              value={displayMetrics.fatigueScore}
              base={displayBase.fatigueScore}
              tone="caution"
            />
            <MetricCell
              label="Progress"
              value={displayMetrics.progressScore}
              base={displayBase.progressScore}
              tone="positive"
            />
            <MetricCell
              label="Plateau risk"
              value={displayMetrics.plateauRisk}
              base={displayBase.plateauRisk}
              tone="caution"
            />
            <MetricCell
              label="Adherence load"
              value={displayMetrics.adherenceDifficulty}
              base={displayBase.adherenceDifficulty}
              tone="caution"
            />
          </div>

          <DualWeeklyStressBars
            current={stressSeriesCurrent}
            baseline={stressSeriesBaseline}
          />

          <ModelSignalsCard
            current={featureSummary}
            baseline={featureSummaryBaseline}
            loading={predictLoading}
          />

          <ModelQualityReportCard report={evalReport} error={evalError} />
          <RetrievalQualityCard report={retrievalReport} error={retrievalError} />
          <ScoreGlossaryCollapsible />

          <div className="rounded-xl border border-border bg-card p-6 md:p-8">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Next step
            </div>
            <h3 className="mt-2 font-serif text-2xl tracking-tight">
              Turn signals into an adjusted plan
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              This simulator shows metrics, stress, and model signals. The <span className="text-foreground">Coach</span>{" "}
              asks guided questions, runs a longer analysis, and produces a digestible adjusted week
              plan with rationale.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/programs/${program.id}/coach`}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Open Coach →
              </Link>
              <Link
                href={`/programs/${program.id}/editor`}
                className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted"
              >
                Keep editing
              </Link>
            </div>
          </div>

          <SessionLogPanel program={program} />
        </section>

        <section className="order-1 lg:order-2">
          <div className="rounded-xl border border-border bg-card p-6 md:p-8">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Sandbox
            </div>
            <h2 className="mt-2 font-serif text-2xl tracking-tight">
              Your current state
            </h2>

            <div className="mt-6 space-y-7">
              <SliderField
                label="Sleep"
                value={sandbox.sleep}
                min={4}
                max={10}
                step={0.5}
                unit=" hrs"
                onChange={(v) => updateSandbox({ sleep: v })}
              />
              <SliderField
                label="Soreness"
                value={sandbox.soreness}
                min={0}
                max={10}
                step={1}
                unit=" / 10"
                onChange={(v) => updateSandbox({ soreness: v })}
              />
              <SliderField
                label="Recovery"
                value={sandbox.recovery}
                min={0}
                max={100}
                step={5}
                unit="%"
                onChange={(v) => updateSandbox({ recovery: v })}
              />

              <SegmentedField
                label="Recent progress"
                value={sandbox.recentProgress}
                options={[
                  { v: "stalled", l: "Stalled" },
                  { v: "slow", l: "Slow" },
                  { v: "normal", l: "Normal" },
                  { v: "fast", l: "Fast" },
                ]}
                onChange={(v) =>
                  updateSandbox({
                    recentProgress: v as SandboxState["recentProgress"],
                  })
                }
              />

              <SegmentedField
                label="Goal"
                value={sandbox.goal}
                options={[
                  { v: "strength", l: "Strength" },
                  { v: "balanced", l: "Balanced" },
                  { v: "hypertrophy", l: "Hypertrophy" },
                ]}
                onChange={(v) =>
                  updateSandbox({ goal: v as SandboxState["goal"] })
                }
              />
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-border bg-card p-6 md:p-8">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Program modifiers
            </div>
            <div className="mt-3 grid grid-cols-3 gap-4">
              {[
                { l: "Volume", v: mods.volume },
                { l: "Intensity", v: mods.intensity },
                { l: "Frequency", v: mods.frequency },
              ].map((m) => (
                <div
                  key={m.l}
                  className="rounded-lg border border-border bg-background p-4"
                >
                  <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                    {m.l}
                  </div>
                  <div className="mt-1 font-serif text-2xl tabular-nums">
                    {m.v}%
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-lg border border-border bg-background p-4">
              <div className="text-sm font-medium">Coach replaces recommendations</div>
              <p className="mt-2 text-xs text-muted-foreground">
                This simulator is a dashboard (signals, charts, and logging). For guided questions,
                a long “analysis” phase, and an adjusted week plan, use the Coach.
              </p>
              <Link
                href={`/programs/${program.id}/coach`}
                className="mt-3 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Open Coach →
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function fmtPct(p: number): string {
  if (!Number.isFinite(p)) return "—";
  return `${Math.round(p * 100)}%`;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function improvement(baseline: number, ridge: number): number {
  if (!Number.isFinite(baseline) || baseline <= 0) return 0;
  return (baseline - ridge) / baseline;
}

function targetLabel(key: string): string {
  switch (key) {
    case "fatigueScore":
      return "Fatigue";
    case "progressScore":
      return "Progress";
    case "plateauRisk":
      return "Plateau risk";
    case "adherenceDifficulty":
      return "Adherence load";
    default:
      return key;
  }
}

function ModelQualityReportCard({
  report,
  error,
}: {
  report: EvalReport | null;
  error: string | null;
}) {
  const keys = ["fatigueScore", "progressScore", "plateauRisk", "adherenceDifficulty"];
  const rows = keys
    .map((k) => {
      const t = report?.targets?.[k];
      if (!t) return null;
      const base = t.baseline;
      const ridge = t.ridge;
      const rmseImp = improvement(base.rmse, ridge.rmse);
      const maeImp = improvement(base.mae, ridge.mae);
      return {
        key: k,
        label: targetLabel(k),
        base,
        ridge,
        rmseImp,
        maeImp,
      };
    })
    .filter(Boolean) as {
    key: string;
    label: string;
    base: { mae: number; rmse: number; r2: number };
    ridge: { mae: number; rmse: number; r2: number };
    rmseImp: number;
    maeImp: number;
  }[];

  const headline =
    rows.length === 0
      ? null
      : {
          rmse: rows.reduce((s, r) => s + clamp01(r.rmseImp), 0) / rows.length,
          mae: rows.reduce((s, r) => s + clamp01(r.maeImp), 0) / rows.length,
        };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="bg-gradient-to-br from-accent/20 via-background to-background p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Model quality report
            </div>
            <h3 className="mt-2 font-serif text-2xl tracking-tight">
              Trained head vs baseline
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Offline evaluation on the synthetic dataset generated from the legacy simulator
              labels. Metrics shown: MAE, RMSE, and \(R^2\) on held-out test split.
            </p>
          </div>

          <div className="min-w-[240px] rounded-lg border border-border/70 bg-background/60 p-4 backdrop-blur">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Summary
            </div>
            {report ? (
              <div className="mt-2 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Split</span>
                  <span className="tabular-nums">
                    {report.split.train}/{report.split.val}/{report.split.test}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">Selected λ</span>
                  <span className="tabular-nums">{report.selected_lambda}</span>
                </div>
                <div className="mt-3 border-t border-border/60 pt-3">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Avg error reduction
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    <KpiPill label="RMSE" value={headline ? fmtPct(headline.rmse) : "—"} />
                    <KpiPill label="MAE" value={headline ? fmtPct(headline.mae) : "—"} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-2 text-sm text-muted-foreground">
                {error ??
                  "Run `npm run eval:train` to generate the evaluation report for this build."}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {error ??
              "No evaluation data found. Generate it with `npm run eval:train`."}
          </p>
        ) : (
          <div className="space-y-4">
            {rows.map((r) => (
              <MetricCompareRow
                key={r.key}
                label={r.label}
                baseline={r.base}
                ridge={r.ridge}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 font-serif text-xl tabular-nums">{value}</div>
    </div>
  );
}

function MetricCompareRow({
  label,
  baseline,
  ridge,
}: {
  label: string;
  baseline: { mae: number; rmse: number; r2: number };
  ridge: { mae: number; rmse: number; r2: number };
}) {
  const rmseImp = clamp01(improvement(baseline.rmse, ridge.rmse));
  const maeImp = clamp01(improvement(baseline.mae, ridge.mae));
  const r2 = ridge.r2;

  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="font-medium">{label}</div>
        <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
          Ridge \(R^2\): <span className="tabular-nums text-foreground">{r2.toFixed(3)}</span>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <CompareBar
          title="RMSE"
          base={baseline.rmse}
          ridge={ridge.rmse}
          improve={rmseImp}
        />
        <CompareBar
          title="MAE"
          base={baseline.mae}
          ridge={ridge.mae}
          improve={maeImp}
        />
      </div>
    </div>
  );
}

function CompareBar({
  title,
  base,
  ridge,
  improve,
}: {
  title: string;
  base: number;
  ridge: number;
  improve: number;
}) {
  // Visual: lower error is better. Bar shows ridge relative to baseline.
  const ratio = clamp01(base > 0 ? ridge / base : 1);
  const ridgeWidth = Math.max(6, Math.round(ratio * 100));
  return (
    <div className="rounded-md border border-border/70 bg-card p-3">
      <div className="flex items-center justify-between gap-3 text-sm">
        <div className="text-muted-foreground">{title}</div>
        <div className="tabular-nums">
          <span className="text-muted-foreground">baseline</span>{" "}
          <span className="text-foreground">{base.toFixed(2)}</span>{" "}
          <span className="text-muted-foreground">→ ridge</span>{" "}
          <span className="text-foreground">{ridge.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-2">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-full bg-foreground/10" />
          <div className="h-full bg-accent" style={{ width: `${ridgeWidth}%` }} />
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] uppercase tracking-widest text-muted-foreground">
          <span>Lower is better</span>
          <span className="text-foreground">-{Math.round(improve * 100)}%</span>
        </div>
      </div>
    </div>
  );
}

function methodLabel(m: "tfidf" | "bm25" | "hybrid"): string {
  switch (m) {
    case "tfidf":
      return "TF‑IDF";
    case "bm25":
      return "BM25";
    default:
      return "Hybrid";
  }
}

function RetrievalQualityCard({
  report,
  error,
}: {
  report: RetrievalReport | null;
  error: string | null;
}) {
  const rows = (report?.reports ?? []).slice().sort((a, b) => b.mrr - a.mrr);
  const winner = rows[0]?.method;
  const maxMrr = Math.max(1e-9, ...rows.map((r) => r.mrr));

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="bg-gradient-to-br from-foreground/5 via-background to-background p-6 md:p-8">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Retrieval quality
        </div>
        <h3 className="mt-2 font-serif text-2xl tracking-tight">
          RAG-lite ablation: ranking methods
        </h3>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Offline eval over the local knowledge base chunks. We measure MRR and Recall@K for three
          rankers and use the best-performing method as default in Coach.
        </p>
      </div>

      <div className="p-6 md:p-8">
        {!report ? (
          <p className="text-sm text-muted-foreground">
            {error ?? "Run `npm run eval:retrieval` to generate the retrieval report."}
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background p-4">
              <div className="text-sm text-muted-foreground">
                Corpus: <span className="tabular-nums text-foreground">{report.chunks}</span>{" "}
                chunks · <span className="tabular-nums text-foreground">{report.queries}</span>{" "}
                queries
              </div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Default:{" "}
                <span className="text-foreground">
                  {winner ? methodLabel(winner) : "—"}
                </span>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {rows.map((r) => {
                const w = Math.max(6, Math.round((r.mrr / maxMrr) * 100));
                return (
                  <div
                    key={r.method}
                    className={cn(
                      "rounded-lg border border-border bg-background p-4",
                      r.method === winner && "border-accent/60 bg-accent/5",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium">
                        {methodLabel(r.method)}
                        {r.method === winner && (
                          <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-medium text-accent-foreground">
                            Best
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                        MRR <span className="tabular-nums text-foreground">{r.mrr.toFixed(3)}</span>
                      </div>
                    </div>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full bg-foreground/10" style={{ width: "100%" }} />
                      <div className="h-full bg-accent" style={{ width: `${w}%` }} />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                      <div>
                        R@1{" "}
                        <span className="tabular-nums text-foreground">
                          {Math.round((r.recallAt["1"] ?? 0) * 100)}%
                        </span>
                      </div>
                      <div>
                        R@3{" "}
                        <span className="tabular-nums text-foreground">
                          {Math.round((r.recallAt["3"] ?? 0) * 100)}%
                        </span>
                      </div>
                      <div>
                        R@5{" "}
                        <span className="tabular-nums text-foreground">
                          {Math.round((r.recallAt["5"] ?? 0) * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function explainTargetLabel(key: string): string {
  switch (key) {
    case "fatigueScore":
      return "Fatigue";
    case "progressScore":
      return "Progress";
    case "plateauRisk":
      return "Plateau risk";
    case "adherenceDifficulty":
      return "Adherence load";
    default:
      return key;
  }
}

function fmtSigned(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const v = Math.round(n * 100) / 100;
  return v > 0 ? `+${v}` : `${v}`;
}

function ExplainTargetCard({
  t,
}: {
  t: ExplainResponse["targets"][number];
}) {
  const pos = t.topPositive;
  const neg = t.topNegative;
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            {explainTargetLabel(t.target)}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">
            Intercept{" "}
            <span className="tabular-nums text-foreground">
              {Math.round(t.intercept * 100) / 100}
            </span>{" "}
            · Raw score{" "}
            <span className="tabular-nums text-foreground">
              {Math.round(t.scoreRaw * 100) / 100}
            </span>
          </div>
        </div>
        <div className="rounded-md border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">
          Top drivers
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <ExplainList title="Pushes score up" items={pos} tone="positive" />
        <ExplainList title="Pulls score down" items={neg} tone="caution" />
      </div>
    </div>
  );
}

function ExplainList({
  title,
  items,
  tone,
}: {
  title: string;
  items: Array<{ label: string; x: number; w: number; contrib: number }>;
  tone: "positive" | "caution";
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className="mt-2 space-y-2">
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground">—</div>
        ) : (
          items.map((it) => (
            <div key={it.label} className="rounded-lg border border-border bg-background p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium">{it.label}</div>
                <div
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
                    tone === "positive"
                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "bg-amber-500/10 text-amber-700 dark:text-amber-300",
                  )}
                >
                  {fmtSigned(it.contrib)}
                </div>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                value <span className="tabular-nums text-foreground">{Math.round(it.x * 1000) / 1000}</span> · weight{" "}
                <span className="tabular-nums text-foreground">{Math.round(it.w * 1000) / 1000}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function DualWeeklyStressBars({
  current,
  baseline,
}: {
  current: { week: number; stress: number; deload: boolean }[];
  baseline: { week: number; stress: number; deload: boolean }[];
}) {
  const max = Math.max(
    1,
    ...current.map((x) => x.stress),
    ...baseline.map((x) => x.stress),
  );

  if (current.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 md:p-8">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Weekly stress
        </div>
        <p className="mt-2 text-sm text-muted-foreground">No weeks in this program — add weeks in the editor.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 md:p-8">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">Weekly stress</div>
      <h3 className="mt-2 font-serif text-2xl tracking-tight">Volume through the block</h3>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Each pair of bars is one week: <span className="text-accent">accent</span> = your current
        volume and intensity modifiers; <span className="text-muted-foreground">gray</span> =
        template at 100% / 100% (same sandbox is not applied here — only prescription stress).
      </p>
      <div className="mt-6 flex h-40 items-end gap-1 sm:gap-1.5">
        {current.map((s, i) => {
          const b = baseline[i];
          const hA = Math.max(5, (s.stress / max) * 100);
          const hB = b ? Math.max(5, (b.stress / max) * 100) : 0;
          return (
            <div
              key={s.week}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
            >
              <div className="flex h-full w-full max-w-[32px] items-end justify-center gap-0.5 sm:max-w-[40px]">
                <div
                  title={`Week ${s.week} (your modifiers): stress ${Math.round(s.stress)}`}
                  className={cn(
                    "w-[46%] rounded-sm transition-all",
                    s.deload ? "bg-foreground/15" : "bg-accent/80",
                  )}
                  style={{ height: `${hA}%` }}
                />
                <div
                  title={`Week ${s.week} (100% template): stress ${b ? Math.round(b.stress) : "—"}`}
                  className="w-[46%] rounded-sm bg-muted-foreground/30"
                  style={{ height: `${hB}%` }}
                />
              </div>
              <div className="text-[10px] tabular-nums text-muted-foreground">{s.week}</div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-[11px] uppercase tracking-widest text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-accent/80" /> Your modifiers
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-muted-foreground/30" /> 100% / 100% template
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-foreground/15" /> Deload week
        </span>
      </div>
    </div>
  );
}

function dominantDriverLabel(d: FeatureSummary["dominantStressDriver"]): string {
  switch (d) {
    case "volume":
      return "Volume %";
    case "intensity":
      return "Intensity %";
    case "frequency":
      return "Frequency %";
    default:
      return "Balanced";
  }
}

function ModelSignalsCard({
  current,
  baseline,
  loading,
}: {
  current: FeatureSummary | null;
  baseline: FeatureSummary | null;
  loading: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 md:p-8">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">Model signals</div>
      <h3 className="mt-2 font-serif text-2xl tracking-tight">What drives the four scores</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Extracted from your program text plus modifiers. The headline numbers above are functions of
        these signals and your sandbox sliders.
      </p>
      {loading && !current ? (
        <p className="mt-5 text-sm text-muted-foreground">Loading signals…</p>
      ) : !current ? (
        <p className="mt-5 text-sm text-muted-foreground">Signals unavailable.</p>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[320px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[10px] uppercase tracking-widest text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Metric</th>
                <th className="py-2 pr-3 font-medium tabular-nums">Your scenario</th>
                <th className="py-2 font-medium tabular-nums">Baseline template</th>
              </tr>
            </thead>
            <tbody className="tabular-nums text-foreground/90">
              <SignalRow
                label="Weekly stress (mean index)"
                a={current.weeklyStressMean}
                b={baseline?.weeklyStressMean}
              />
              <SignalRow label="Weekly sets (approx.)" a={current.totalWeeklySets} b={baseline?.totalWeeklySets} />
              <SignalRow label="Avg intensity (%1RM)" a={current.averageIntensity} b={baseline?.averageIntensity} />
              <SignalRow
                label="Recovery-adj. load"
                a={current.recoveryAdjustedLoad}
                b={baseline?.recoveryAdjustedLoad}
              />
              <SignalRow label="Goal alignment (0–1)" a={current.goalAlignment} b={baseline?.goalAlignment} />
              <SignalRow label="Stress monotony" a={current.stressMonotony} b={baseline?.stressMonotony} />
              <tr className="border-t border-border/80">
                <td className="py-2 pr-3 text-muted-foreground">Dominant dial vs 100%</td>
                <td className="py-2 pr-3">{dominantDriverLabel(current.dominantStressDriver)}</td>
                <td className="py-2">
                  {baseline ? dominantDriverLabel(baseline.dominantStressDriver) : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SignalRow({
  label,
  a,
  b,
}: {
  label: string;
  a: number;
  b?: number;
}) {
  return (
    <tr className="border-b border-border/60">
      <td className="py-2 pr-3 text-muted-foreground">{label}</td>
      <td className="py-2 pr-3">{typeof a === "number" ? a.toFixed(1) : "—"}</td>
      <td className="py-2">{b !== undefined ? b.toFixed(1) : "—"}</td>
    </tr>
  );
}

function ScoreGlossaryCollapsible() {
  const items: { title: string; body: string }[] = [
    {
      title: "Fatigue score",
      body: "Higher means the model expects more accumulated stress vs recovery (weekly load, monotony, sleep gap, soreness, and how hard volume/intensity/frequency are pushed). It is not a medical diagnosis.",
    },
    {
      title: "Progress score",
      body: "Higher suggests more headroom for adaptation given stimulus, goal fit, recovery, and recent progress — tempered when fatigue is high.",
    },
    {
      title: "Plateau risk",
      body: "Higher flags staleness: stalled progress, repetitive stress shape, or push/pull and squat/hinge imbalance in the template.",
    },
    {
      title: "Adherence load",
      body: "Higher means the program may be harder to stick to (set counts, frequency, sleep debt, soreness). Use it as a scheduling realism check.",
    },
  ];

  return (
    <Collapsible className="group/g rounded-xl border border-border bg-card">
      <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left md:px-8 md:py-5">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Reference</div>
          <div className="mt-1 font-serif text-xl tracking-tight">What the four scores mean</div>
        </div>
        <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]/g:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t border-border/60 px-6 pb-5 pt-2 md:px-8">
        <ul className="space-y-4 text-sm leading-relaxed text-muted-foreground">
          {items.map((it) => (
            <li key={it.title}>
              <span className="font-medium text-foreground">{it.title}.</span> {it.body}
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}


function MetricPair({
  label,
  before,
  after,
}: {
  label: string;
  before: number;
  after: number;
}) {
  const d = after - before;
  return (
    <div className="flex justify-between gap-2">
      <span>{label}</span>
      <span className="tabular-nums text-foreground">
        {before}
        <span className="text-muted-foreground"> → </span>
        {after}
        {d !== 0 && (
          <span
            className={cn(
              "ml-1 text-[10px]",
              d > 0 ? "text-chart-3" : "text-accent",
            )}
          >
            ({d > 0 ? "+" : ""}
            {d})
          </span>
        )}
      </span>
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </label>
        <span className="font-serif text-xl tabular-nums">
          {value}
          <span className="text-sm text-muted-foreground">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider mt-3 w-full"
      />
    </div>
  );
}

function SegmentedField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { v: string; l: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {label}
      </label>
      <div className="grid grid-cols-2 gap-1 rounded-md border border-border bg-background p-1 sm:grid-cols-4">
        {options.map((o) => {
          const active = value === o.v;
          return (
            <button
              key={o.v}
              type="button"
              onClick={() => onChange(o.v)}
              className={cn(
                "rounded px-3 py-1.5 text-xs transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.l}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MetricCell({
  label,
  value,
  base,
  tone,
}: {
  label: string;
  value: number;
  base: number;
  tone: "positive" | "caution";
}) {
  const delta = value - base;
  const positive =
    (tone === "positive" && delta >= 0) || (tone === "caution" && delta <= 0);

  return (
    <div className="bg-card p-6">
      <div className="flex items-baseline justify-between">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
        {delta !== 0 && (
          <span
            className={cn(
              "text-xs tabular-nums",
              positive ? "text-chart-3" : "text-accent",
            )}
          >
            {delta > 0 ? "+" : ""}
            {delta}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <div className="font-serif text-5xl tabular-nums tracking-tight">
          {value}
        </div>
        <div className="text-sm text-muted-foreground">/ 100</div>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            tone === "positive" ? "bg-chart-3" : "bg-accent",
          )}
          style={{ width: `${value}%` }}
        />
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        Baseline: {base}
      </div>
    </div>
  );
}
