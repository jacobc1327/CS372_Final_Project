"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  generateNarrative,
  generateRecommendations,
  defaultSandbox,
  type SandboxState,
  type SimulationMetrics,
} from "@/lib/mock-data";
import { useWorkspace } from "@/components/workspace-provider";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { AdaptApiResult } from "@/lib/adaptation-engine";
import { ChevronDown } from "lucide-react";

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
  featureSummary: Record<string, unknown>;
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

  const [metrics, setMetrics] = useState<SimulationMetrics | null>(null);
  const [baseMetrics, setBaseMetrics] = useState<SimulationMetrics | null>(null);
  const [predictLoading, setPredictLoading] = useState(true);
  const [predictError, setPredictError] = useState<string | null>(null);

  const [adaptResult, setAdaptResult] = useState<AdaptApiResult | null>(null);
  const [adaptLoading, setAdaptLoading] = useState(false);
  const [adaptError, setAdaptError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayMetrics = metrics ?? EMPTY_METRICS;
  const displayBase = baseMetrics ?? EMPTY_METRICS;

  useEffect(() => {
    setAdaptResult(null);
    setAdaptError(null);
  }, [program, mods.volume, mods.intensity, mods.frequency, sandbox]);

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
            postJson<PredictResponse>("/api/predict", bodyCurrent),
            postJson<PredictResponse>("/api/predict", bodyBase),
          ]);
          setMetrics({
            fatigueScore: cur.fatigueScore,
            progressScore: cur.progressScore,
            plateauRisk: cur.plateauRisk,
            adherenceDifficulty: cur.adherenceDifficulty,
          });
          setBaseMetrics({
            fatigueScore: base.fatigueScore,
            progressScore: base.progressScore,
            plateauRisk: base.plateauRisk,
            adherenceDifficulty: base.adherenceDifficulty,
          });
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

  const heuristicNarrative = generateNarrative(displayMetrics, sandbox);
  const heuristicRecs = generateRecommendations(displayMetrics, sandbox);

  const runAdaptation = useCallback(async () => {
    setAdaptLoading(true);
    setAdaptError(null);
    try {
      const out = await postJson<AdaptApiResult>("/api/adapt", {
        program,
        modifiers: {
          volume: mods.volume,
          intensity: mods.intensity,
          frequency: mods.frequency,
        },
        sandbox,
      });
      setAdaptResult(out);
    } catch (e) {
      setAdaptError(e instanceof Error ? e.message : "Adaptation failed");
    } finally {
      setAdaptLoading(false);
    }
  }, [program, mods.volume, mods.intensity, mods.frequency, sandbox]);

  const applyAdaptation = () => {
    if (!adaptResult) return;
    setModifiers(program.id, {
      volume: adaptResult.adaptedModifiers.volume,
      intensity: adaptResult.adaptedModifiers.intensity,
      frequency: adaptResult.adaptedModifiers.frequency,
    });
    setAdaptResult(null);
  };

  const updateSandbox = (patch: Partial<SandboxState>) =>
    setSandbox({ ...sandbox, ...patch });

  const showApiNarrative = adaptResult?.narrative;

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
        <span className="text-foreground">Simulator</span>
      </nav>

      <header className="mt-6 flex flex-wrap items-end justify-between gap-6 border-b border-border pb-8">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Simulator
          </div>
          <h1 className="mt-2 font-serif text-4xl tracking-tight md:text-5xl">
            What would happen if…
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Adjust your sandbox below. The simulator predicts how this program
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

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1.2fr]">
        <section>
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

            <div className="mt-5 rounded-lg border border-accent/30 bg-accent/5 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <div className="text-sm font-medium text-accent">
                  Adapt to current state
                </div>
                <span className="text-xs text-muted-foreground">
                  {adaptResult ? (
                    <>
                      → V{adaptResult.adaptedModifiers.volume} · I
                      {adaptResult.adaptedModifiers.intensity} · F
                      {adaptResult.adaptedModifiers.frequency}
                    </>
                  ) : (
                    <span className="italic">Run analysis for suggested dials</span>
                  )}
                </span>
              </div>
              {adaptError && (
                <p className="mt-2 text-xs text-accent">{adaptError}</p>
              )}
              {adaptResult && (
                <div className="mt-3 rounded-md border border-border/80 bg-background/60 p-3 text-[11px] text-muted-foreground">
                  <div className="font-medium uppercase tracking-widest text-foreground/80">
                    Before → after (model)
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 tabular-nums">
                    <MetricPair
                      label="Fatigue"
                      before={adaptResult.currentMetrics.fatigueScore}
                      after={adaptResult.adaptedMetrics.fatigueScore}
                    />
                    <MetricPair
                      label="Progress"
                      before={adaptResult.currentMetrics.progressScore}
                      after={adaptResult.adaptedMetrics.progressScore}
                    />
                    <MetricPair
                      label="Plateau"
                      before={adaptResult.currentMetrics.plateauRisk}
                      after={adaptResult.adaptedMetrics.plateauRisk}
                    />
                    <MetricPair
                      label="Adherence"
                      before={adaptResult.currentMetrics.adherenceDifficulty}
                      after={adaptResult.adaptedMetrics.adherenceDifficulty}
                    />
                  </div>
                </div>
              )}
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void runAdaptation()}
                  disabled={adaptLoading || predictLoading}
                  className="w-full rounded-md border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 sm:flex-1"
                >
                  {adaptLoading ? "Analyzing…" : "Simulate adaptation"}
                </button>
                <button
                  type="button"
                  onClick={applyAdaptation}
                  disabled={!adaptResult || adaptLoading}
                  className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 sm:flex-1"
                >
                  Apply suggested modifiers
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-6">
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

          <div className="rounded-xl border border-border bg-card p-6 md:p-8">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Reading
            </div>
            <h3 className="mt-2 font-serif text-2xl tracking-tight">
              How the system looks today
            </h3>
            {showApiNarrative ? (
              <p className="mt-5 text-base leading-relaxed text-foreground/90">
                {showApiNarrative}
              </p>
            ) : (
              <ul className="mt-5 space-y-3">
                {heuristicNarrative.map((line, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 border-b border-border/60 pb-3 text-base last:border-0 last:pb-0"
                  >
                    <span
                      className={cn(
                        "mt-2 h-1.5 w-1.5 shrink-0 rounded-full",
                        line.tone === "positive" && "bg-chart-3",
                        line.tone === "caution" && "bg-accent",
                        line.tone === "neutral" && "bg-muted-foreground",
                      )}
                    />
                    <span className="leading-relaxed">{line.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-6 md:p-8">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Recommendations
            </div>
            <h3 className="mt-2 font-serif text-2xl tracking-tight">
              What to consider
            </h3>
            {adaptResult && adaptResult.recommendations.length > 0 ? (
              <ul className="mt-5 space-y-3">
                {adaptResult.recommendations.map((r, idx) => (
                  <li
                    key={`${r.title}-${idx}`}
                    className={cn(
                      "rounded-lg border p-4",
                      r.type === "warning" && "border-accent/30 bg-accent/5",
                      r.type === "recovery" && "border-accent/25 bg-accent/[0.07]",
                      r.type === "maintain" && "border-chart-3/30 bg-chart-3/5",
                      r.type === "optimization" && "border-border bg-background",
                    )}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <div className="text-sm font-medium">{r.title}</div>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        Confidence {(r.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {r.reasoning}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/80">
                        Adjustment:
                      </span>{" "}
                      {r.adjustment}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/80">
                        Expected impact:
                      </span>{" "}
                      {r.expectedImpact}
                    </p>
                    {r.supportingEvidence.length > 0 && (
                      <Collapsible className="group/c mt-3 border-t border-border/60 pt-3">
                        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-left text-xs font-medium uppercase tracking-widest text-muted-foreground hover:text-foreground">
                          <span>Why this recommendation?</span>
                          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-data-[state=open]/c:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3 space-y-3">
                          {r.supportingEvidence.map((ev, j) => (
                            <blockquote
                              key={`${ev.sourceTitle}-${j}`}
                              className="border-l-2 border-border pl-3 text-sm leading-relaxed text-muted-foreground"
                            >
                              <cite className="not-italic text-xs font-medium text-foreground/80">
                                {ev.sourceTitle}
                                {ev.chunkTitle ? ` · ${ev.chunkTitle}` : ""}
                              </cite>
                              <p className="mt-1">{ev.snippet}</p>
                            </blockquote>
                          ))}
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </li>
                ))}
              </ul>
            ) : heuristicRecs.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Nothing pressing — the program looks well-calibrated to your current state.
              </p>
            ) : (
              <>
                <ul className="mt-5 space-y-3">
                  {heuristicRecs.map((r) => (
                    <li
                      key={r.id}
                      className={cn(
                        "rounded-lg border p-4",
                        r.type === "warning" && "border-accent/30 bg-accent/5",
                        r.type === "success" && "border-chart-3/30 bg-chart-3/5",
                        r.type === "info" && "border-border bg-background",
                        r.type === "optimization" && "border-border bg-background",
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="text-sm font-medium">{r.title}</div>
                        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                          {r.impact} impact
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-muted-foreground">
                  Run <strong className="font-medium text-foreground">Simulate adaptation</strong> for
                  retrieval-backed cards with cited evidence.
                </p>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
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
