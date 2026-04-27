"use client";

import type { ProgramCompletenessResult } from "@/lib/program-completeness";
import { cn } from "@/lib/utils";

export function ProgramReadinessPanel({
  result,
  context,
}: {
  result: ProgramCompletenessResult;
  context: "editor" | "simulate";
}) {
  if (result.issues.length === 0) {
    if (context !== "editor") return null;
    return (
      <div className="mt-6 rounded-xl border border-chart-3/35 bg-chart-3/5 px-4 py-3 md:px-5">
        <div className="text-xs font-medium uppercase tracking-widest text-chart-3">
          Program readiness
        </div>
        <p className="mt-1 text-sm text-foreground/90">
          Structure looks good — the simulator can use your full template volume and stress model.
        </p>
      </div>
    );
  }

  const errors = result.issues.filter((i) => i.severity === "error");
  const warnings = result.issues.filter((i) => i.severity === "warning");
  const strong = !result.ready;

  return (
    <div
      className={cn(
        "mt-6 rounded-xl border px-4 py-4 md:px-5 md:py-5",
        strong
          ? "border-accent/45 bg-accent/5"
          : "border-amber-500/35 bg-amber-500/[0.06]",
      )}
    >
      <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        {context === "simulate" ? "Simulator readiness" : "Program readiness"}
      </div>
      <p className="mt-2 text-sm font-medium text-foreground">
        {strong
          ? context === "simulate"
            ? "Scores and stress curves may be misleading until these are fixed."
            : "Fix the items below before relying on the simulator."
          : "A few optional improvements:"}
      </p>
      {errors.length > 0 && (
        <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-accent">
          {errors.map((e, idx) => (
            <li key={`e-${idx}`}>{e.message}</li>
          ))}
        </ul>
      )}
      {warnings.length > 0 && (
        <ul
          className={cn(
            "list-inside list-disc space-y-1.5 text-sm text-amber-900/80 dark:text-amber-200/90",
            errors.length > 0 ? "mt-3" : "mt-3",
          )}
        >
          {warnings.map((w, idx) => (
            <li key={`w-${idx}`}>{w.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
