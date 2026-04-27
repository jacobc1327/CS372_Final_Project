"use client";

import { useEffect } from "react";
import type { WorkoutDay, Exercise, MuscleGroup } from "@/lib/mock-data";

interface DayDetailDrawerProps {
  day: WorkoutDay | null;
  open: boolean;
  onClose: () => void;
  onAdjustSets: (exId: string, delta: number) => void;
  onAdjustReps: (exId: string, reps: string) => void;
  onAdjustIntensity: (exId: string, value: number) => void;
  /** Log last comfortable working weight (kg) for this slot, or null to clear. */
  onAdjustWorkingWeightKg: (exId: string, kg: number | null) => void;
  onRename: (exId: string, name: string) => void;
  onRemove: (exId: string) => void;
  onAdd: () => void;
}

const GROUP_COLORS: Record<MuscleGroup, string> = {
  quads: "oklch(0.6 0.13 38)",
  hamstrings: "oklch(0.55 0.11 28)",
  glutes: "oklch(0.5 0.1 18)",
  chest: "oklch(0.5 0.09 220)",
  back: "oklch(0.45 0.07 200)",
  shoulders: "oklch(0.55 0.1 180)",
  arms: "oklch(0.55 0.09 60)",
  core: "oklch(0.45 0.08 280)",
  conditioning: "oklch(0.5 0.1 140)",
};

export function DayDetailDrawer({
  day,
  open,
  onClose,
  onAdjustSets,
  onAdjustReps,
  onAdjustIntensity,
  onAdjustWorkingWeightKg,
  onRename,
  onRemove,
  onAdd,
}: DayDetailDrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !day) return null;

  return (
    <>
      {/* Backdrop */}
      <button
        onClick={onClose}
        className="fixed inset-0 z-30 bg-foreground/15 backdrop-blur-[2px]"
        aria-label="Close drawer"
      />

      {/* Drawer */}
      <aside
        className="fixed right-0 top-0 z-40 flex h-full w-full max-w-md flex-col border-l border-border bg-background shadow-[0_0_60px_-20px_rgba(0,0,0,0.18)] animate-drawer-in"
        role="dialog"
        aria-label={`Edit ${day.name}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border px-6 py-5">
          <div>
            <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
              {day.dayOfWeek} · {day.focus}
            </div>
            <h3 className="mt-1.5 font-serif text-2xl leading-tight tracking-tight">
              {day.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Exercises */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            {day.exercises.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-card/50 p-8 text-center text-sm text-muted-foreground">
                No exercises in this day. Add one below.
              </div>
            ) : (
              day.exercises.map((ex) => (
                <ExerciseRow
                  key={ex.id}
                  ex={ex}
                  onAdjustSets={(d) => onAdjustSets(ex.id, d)}
                  onAdjustReps={(reps) => onAdjustReps(ex.id, reps)}
                  onAdjustIntensity={(v) => onAdjustIntensity(ex.id, v)}
                  onAdjustWorkingWeightKg={(kg) => onAdjustWorkingWeightKg(ex.id, kg)}
                  onRename={(name) => onRename(ex.id, name)}
                  onRemove={() => onRemove(ex.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-border px-6 py-4">
          <button
            onClick={onAdd}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border bg-card px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add exercise
          </button>
        </div>
      </aside>
    </>
  );
}

function ExerciseRow({
  ex,
  onAdjustSets,
  onAdjustReps,
  onAdjustIntensity,
  onAdjustWorkingWeightKg,
  onRename,
  onRemove,
}: {
  ex: Exercise;
  onAdjustSets: (delta: number) => void;
  onAdjustReps: (reps: string) => void;
  onAdjustIntensity: (v: number) => void;
  onAdjustWorkingWeightKg: (kg: number | null) => void;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span
          className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
          style={{ background: GROUP_COLORS[ex.group] }}
        />
        <input
          type="text"
          value={ex.name}
          onChange={(e) => onRename(e.target.value)}
          className="flex-1 bg-transparent text-base font-medium leading-tight focus:outline-none"
        />
        <button
          onClick={onRemove}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
          aria-label="Remove exercise"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
        </button>
      </div>

      <div className="mt-1 ml-5 text-xs capitalize text-muted-foreground">
        {ex.group}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        {/* Sets stepper */}
        <div>
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Sets
          </div>
          <div className="flex items-center justify-between rounded-md border border-border bg-background">
            <button
              onClick={() => onAdjustSets(-1)}
              disabled={ex.sets <= 1}
              className="grid h-8 w-8 place-items-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
            >
              −
            </button>
            <span className="text-sm font-medium tabular-nums">{ex.sets}</span>
            <button
              onClick={() => onAdjustSets(1)}
              disabled={ex.sets >= 12}
              className="grid h-8 w-8 place-items-center text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
            >
              +
            </button>
          </div>
        </div>

        {/* Reps text input */}
        <div>
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Reps
          </div>
          <input
            type="text"
            value={ex.reps}
            onChange={(e) => onAdjustReps(e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-background px-2 text-center text-sm font-medium tabular-nums focus:border-foreground/30 focus:outline-none"
          />
        </div>

        {/* Intensity */}
        <div>
          <div className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
            Intensity
          </div>
          <div className="flex h-8 items-center justify-center rounded-md border border-border bg-background text-sm font-medium tabular-nums">
            {ex.intensity > 0 ? `${ex.intensity}%` : "—"}
          </div>
        </div>
      </div>

      {ex.intensity > 0 && (
        <div className="mt-3">
          <input
            type="range"
            min={40}
            max={105}
            step={1}
            value={ex.intensity}
            onChange={(e) => onAdjustIntensity(Number(e.target.value))}
            className="slider w-full"
          />
        </div>
      )}

      <div className="mt-4 border-t border-border/60 pt-4">
        <div className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          Working weight (kg, optional)
        </div>
        <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
          Log the load you actually use for this prescription. It refines analytics and adaptation
          text alongside %1RM intensity.
        </p>
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            max={600}
            step={0.5}
            placeholder="—"
            value={ex.workingWeightKg ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") {
                onAdjustWorkingWeightKg(null);
                return;
              }
              const n = Number(v);
              if (!Number.isFinite(n) || n < 0) return;
              if (n === 0) onAdjustWorkingWeightKg(null);
              else onAdjustWorkingWeightKg(Math.round(n * 10) / 10);
            }}
            className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm tabular-nums focus:border-foreground/30 focus:outline-none"
          />
          {(ex.workingWeightKg != null && ex.workingWeightKg > 0) && (
            <button
              type="button"
              onClick={() => onAdjustWorkingWeightKg(null)}
              className="shrink-0 rounded-md border border-border px-2.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
