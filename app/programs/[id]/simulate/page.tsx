"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useMemo } from "react";
import {
  calculateMetrics,
  generateRecommendations,
  generateNarrative,
  simulateAdaptation,
  defaultSandbox,
  type SandboxState,
} from "@/lib/mock-data";
import { useWorkspace } from "@/components/workspace-provider";
import { cn } from "@/lib/utils";

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

  const metrics = useMemo(
    () =>
      calculateMetrics(
        program,
        mods.volume,
        mods.intensity,
        Math.round(program.daysPerWeek * (mods.frequency / 100)),
        sandbox,
      ),
    [program, mods, sandbox],
  );

  const baseMetrics = useMemo(
    () =>
      calculateMetrics(
        program,
        100,
        100,
        program.daysPerWeek,
        defaultSandbox,
      ),
    [program],
  );

  const recs = useMemo(
    () => generateRecommendations(metrics, sandbox),
    [metrics, sandbox],
  );
  const narrative = useMemo(
    () => generateNarrative(metrics, sandbox),
    [metrics, sandbox],
  );

  const adapted = useMemo(
    () =>
      simulateAdaptation(metrics, sandbox, {
        volume: mods.volume,
        intensity: mods.intensity,
        frequency: mods.frequency,
      }),
    [metrics, sandbox, mods],
  );

  const applyAdaptation = () => {
    setModifiers(program.id, {
      volume: adapted.volume,
      intensity: adapted.intensity,
      frequency: adapted.frequency,
    });
  };

  const updateSandbox = (patch: Partial<SandboxState>) =>
    setSandbox({ ...sandbox, ...patch });

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 md:py-14">
      {/* Breadcrumbs */}
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

      {/* Header */}
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

      {/* Two-column body */}
      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_1.2fr]">
        {/* Sandbox controls */}
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

          {/* Modifiers (read-only display + adapt button) */}
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
                  → V{adapted.volume} · I{adapted.intensity} · F
                  {adapted.frequency}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {adapted.rationale}
              </p>
              <button
                onClick={applyAdaptation}
                className="mt-3 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Apply suggested modifiers
              </button>
            </div>
          </div>
        </section>

        {/* Metrics + narrative + recommendations */}
        <section className="space-y-6">
          {/* Metrics grid */}
          <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-2">
            <MetricCell
              label="Fatigue"
              value={metrics.fatigueScore}
              base={baseMetrics.fatigueScore}
              tone="caution"
            />
            <MetricCell
              label="Progress"
              value={metrics.progressScore}
              base={baseMetrics.progressScore}
              tone="positive"
            />
            <MetricCell
              label="Plateau risk"
              value={metrics.plateauRisk}
              base={baseMetrics.plateauRisk}
              tone="caution"
            />
            <MetricCell
              label="Adherence load"
              value={metrics.adherenceDifficulty}
              base={baseMetrics.adherenceDifficulty}
              tone="caution"
            />
          </div>

          {/* Narrative */}
          <div className="rounded-xl border border-border bg-card p-6 md:p-8">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Reading
            </div>
            <h3 className="mt-2 font-serif text-2xl tracking-tight">
              How the system looks today
            </h3>
            <ul className="mt-5 space-y-3">
              {narrative.map((line, i) => (
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
          </div>

          {/* Recommendations */}
          <div className="rounded-xl border border-border bg-card p-6 md:p-8">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Recommendations
            </div>
            <h3 className="mt-2 font-serif text-2xl tracking-tight">
              What to consider
            </h3>
            {recs.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Nothing pressing — the program looks well-calibrated to your
                current state.
              </p>
            ) : (
              <ul className="mt-5 space-y-3">
                {recs.map((r) => (
                  <li
                    key={r.id}
                    className={cn(
                      "rounded-lg border p-4",
                      r.type === "warning" &&
                        "border-accent/30 bg-accent/5",
                      r.type === "success" &&
                        "border-chart-3/30 bg-chart-3/5",
                      r.type === "info" && "border-border bg-background",
                      r.type === "optimization" &&
                        "border-border bg-background",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="text-sm font-medium">{r.title}</div>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                        {r.impact} impact
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {r.description}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
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
  const positive = (tone === "positive" && delta >= 0) || (tone === "caution" && delta <= 0);

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
      {/* Bar */}
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
