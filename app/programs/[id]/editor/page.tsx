"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useCallback, useState } from "react";
import {
  buildWeekGrid,
  programMaxStress,
  type Program,
  type WorkoutDay,
  type ProgramWeek,
} from "@/lib/mock-data";
import { useWorkspace } from "@/components/workspace-provider";
import { DayDetailDrawer } from "@/components/day-detail-drawer";
import { cn } from "@/lib/utils";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function heatColor(scale: number): string {
  if (scale <= 0) return "var(--stress-rest)";
  if (scale < 0.25) return "var(--stress-low)";
  if (scale < 0.5) return "var(--stress-mid)";
  if (scale < 0.8) return "var(--stress-high)";
  return "var(--stress-peak)";
}

export default function EditorPage() {
  const params = useParams<{ id: string }>();

  const {
    resolveProgram,
    commitEdit,
    resetWorkingProgram,
    hasChanges,
    getModifiers,
    setModifiers,
  } = useWorkspace();

  const resolved = resolveProgram(params.id);
  if (!resolved) notFound();

  const { program, isCustom } = resolved;
  const mods = getModifiers(program.id);
  const dirty = hasChanges(program.id);

  const [weekIndex, setWeekIndex] = useState(0);
  const [openDayId, setOpenDayId] = useState<string | null>(null);
  const [savedToast, setSavedToast] = useState(false);

  const updateProgram = useCallback(
    (next: Program) => {
      commitEdit(program.id, next);
    },
    [program.id, commitEdit],
  );

  // Mutations
  const updateDay = (dayId: string, mutator: (d: WorkoutDay) => WorkoutDay) => {
    const next: Program = {
      ...program,
      weeks: program.weeks.map((w, wi) =>
        wi === weekIndex
          ? ({
              ...w,
              days: w.days.map((d) => (d.id === dayId ? mutator(d) : d)),
            } as ProgramWeek)
          : w,
      ),
    };
    updateProgram(next);
  };

  const adjustSets = (dayId: string, exId: string, delta: number) => {
    updateDay(dayId, (d) => ({
      ...d,
      exercises: d.exercises.map((e) =>
        e.id === exId
          ? { ...e, sets: Math.max(1, Math.min(12, e.sets + delta)) }
          : e,
      ),
    }));
  };
  const adjustReps = (dayId: string, exId: string, reps: string) => {
    updateDay(dayId, (d) => ({
      ...d,
      exercises: d.exercises.map((e) => (e.id === exId ? { ...e, reps } : e)),
    }));
  };
  const adjustIntensity = (dayId: string, exId: string, v: number) => {
    updateDay(dayId, (d) => ({
      ...d,
      exercises: d.exercises.map((e) =>
        e.id === exId ? { ...e, intensity: v } : e,
      ),
    }));
  };
  const renameEx = (dayId: string, exId: string, name: string) => {
    updateDay(dayId, (d) => ({
      ...d,
      exercises: d.exercises.map((e) => (e.id === exId ? { ...e, name } : e)),
    }));
  };
  const removeEx = (dayId: string, exId: string) => {
    updateDay(dayId, (d) => ({
      ...d,
      exercises: d.exercises.filter((e) => e.id !== exId),
    }));
  };
  const addEx = (dayId: string) => {
    updateDay(dayId, (d) => ({
      ...d,
      exercises: [
        ...d.exercises,
        {
          id: `ex-${Date.now()}`,
          name: "New exercise",
          sets: 3,
          reps: "8-12",
          intensity: 70,
          group: "arms",
        },
      ],
    }));
  };

  const setMod = (key: "volume" | "intensity" | "frequency", v: number) => {
    setModifiers(program.id, { ...mods, [key]: v });
  };

  // Drawer-related derived values
  const week = program.weeks[weekIndex];
  const max = programMaxStress(program, mods.volume, mods.intensity);
  const grid = buildWeekGrid(week, mods.volume, mods.intensity, max);
  const openDay = week?.days.find((d) => d.id === openDayId) ?? null;

  const handleSave = () => {
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2200);
  };

  const handleDiscard = () => {
    resetWorkingProgram(program.id);
    setWeekIndex(0);
    setOpenDayId(null);
  };

  // Week summary numbers
  const totalExercises = week?.days.reduce(
    (s, d) => s + d.exercises.length,
    0,
  );
  const totalSessions = week?.days.length;

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
        <span className="text-foreground">Editor</span>
      </nav>

      {/* Header */}
      <header className="mt-6 flex flex-wrap items-end justify-between gap-6 border-b border-border pb-8">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Editor
          </div>
          <h1 className="mt-2 font-serif text-4xl tracking-tight md:text-5xl">
            {program.name}
          </h1>
          {isCustom ? (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/40" />
              Custom · auto-saving
            </div>
          ) : (
            dirty && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Unsaved changes in your workspace
              </div>
            )
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isCustom && (
            <Link
              href={`/create/${program.id}/builder`}
              className="rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted"
            >
              Edit structure
            </Link>
          )}
          {!isCustom && dirty && (
            <button
              onClick={handleDiscard}
              className="rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted"
            >
              Discard
            </button>
          )}
          <Link
            href={`/programs/${program.id}/simulate`}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted"
          >
            Simulate →
          </Link>
          {!isCustom && (
            <button
              onClick={handleSave}
              disabled={!dirty}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                dirty
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "cursor-not-allowed bg-muted text-muted-foreground",
              )}
            >
              Save
            </button>
          )}
        </div>
      </header>

      {/* Week tabs */}
      <div className="mt-8 flex flex-wrap gap-1 border-b border-border">
        {program.weeks.map((w, i) => {
          const active = i === weekIndex;
          return (
            <button
              key={w.weekNumber}
              onClick={() => setWeekIndex(i)}
              className={cn(
                "relative -mb-px border-b-2 px-4 py-2.5 text-sm transition-colors",
                active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              Week {w.weekNumber}
              {w.deload && (
                <span className="ml-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  · deload
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Week summary */}
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Sessions
          </div>
          <div className="mt-2 font-serif text-3xl tracking-tight">
            {totalSessions}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Exercises
          </div>
          <div className="mt-2 font-serif text-3xl tracking-tight">
            {totalExercises}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Phase
          </div>
          <div className="mt-2 font-serif text-3xl tracking-tight">
            {week?.deload ? "Deload" : "Working"}
          </div>
        </div>
      </div>

      {/* Day grid */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-serif text-2xl tracking-tight">
            Week {week?.weekNumber} · click any day to edit
          </h2>
          <div className="hidden items-center gap-2 text-[11px] uppercase tracking-widest text-muted-foreground md:flex">
            <span>Stress:</span>
            <span className="flex items-center gap-1">
              {[
                "var(--stress-rest)",
                "var(--stress-low)",
                "var(--stress-mid)",
                "var(--stress-high)",
                "var(--stress-peak)",
              ].map((c) => (
                <span
                  key={c}
                  className="h-3 w-3 rounded-sm border border-border"
                  style={{ background: c }}
                />
              ))}
            </span>
            <span>low → high</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-7">
          {DAYS.map((d) => {
            const cell = grid.find((c) => c.day === d);
            const w = cell?.workout;
            const scale = cell?.intensityScale ?? 0;
            return (
              <button
                key={d}
                onClick={() => w && setOpenDayId(w.id)}
                disabled={!w}
                className={cn(
                  "group relative flex aspect-[3/4] flex-col rounded-lg border border-border p-3 text-left transition-all",
                  w
                    ? "hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-[0_2px_16px_-8px_rgba(0,0,0,0.15)]"
                    : "cursor-default",
                )}
                style={{ background: heatColor(scale) }}
              >
                <div className="text-[10px] font-medium uppercase tracking-widest text-foreground/60">
                  {d}
                </div>
                <div className="mt-auto">
                  {w ? (
                    <>
                      <div className="line-clamp-2 text-sm font-medium leading-tight">
                        {w.name}
                      </div>
                      <div className="mt-1 text-[11px] text-foreground/55">
                        {w.exercises.length} ex
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-foreground/40">Rest</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Master modifiers */}
      <div className="mt-12 rounded-xl border border-border bg-card p-6 md:p-8">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="font-serif text-2xl tracking-tight">
            Master modifiers
          </h2>
          <button
            onClick={() => setModifiers(program.id, { volume: 100, intensity: 100, frequency: 100 })}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Reset modifiers
          </button>
        </div>
        <p className="text-sm text-muted-foreground">
          Apply program-wide adjustments without editing individual exercises.
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <SliderField
            label="Volume"
            value={mods.volume}
            min={60}
            max={140}
            unit="%"
            onChange={(v) => setMod("volume", v)}
          />
          <SliderField
            label="Intensity"
            value={mods.intensity}
            min={70}
            max={115}
            unit="%"
            onChange={(v) => setMod("intensity", v)}
          />
          <SliderField
            label="Frequency"
            value={mods.frequency}
            min={70}
            max={115}
            unit="%"
            onChange={(v) => setMod("frequency", v)}
          />
        </div>

        <div className="mt-6 flex justify-end">
          <Link
            href={`/programs/${program.id}/simulate`}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted"
          >
            See predicted impact in simulator →
          </Link>
        </div>
      </div>

      {/* Drawer */}
      <DayDetailDrawer
        day={openDay}
        open={!!openDay}
        onClose={() => setOpenDayId(null)}
        onAdjustSets={(exId, delta) => openDay && adjustSets(openDay.id, exId, delta)}
        onAdjustReps={(exId, reps) => openDay && adjustReps(openDay.id, exId, reps)}
        onAdjustIntensity={(exId, v) => openDay && adjustIntensity(openDay.id, exId, v)}
        onRename={(exId, name) => openDay && renameEx(openDay.id, exId, name)}
        onRemove={(exId) => openDay && removeEx(openDay.id, exId)}
        onAdd={() => openDay && addEx(openDay.id)}
      />

      {/* Toast */}
      {savedToast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-primary px-5 py-2.5 text-sm text-primary-foreground shadow-lg animate-in-up">
          Workspace saved · changes persist while browsing
        </div>
      )}
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  const modified = value !== 100;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </label>
        <span
          className={cn(
            "font-serif text-2xl tabular-nums",
            modified ? "text-accent" : "text-foreground",
          )}
        >
          {value}
          <span className="text-sm text-muted-foreground">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        step={1}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider mt-3 w-full"
      />
      <div className="mt-1.5 flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>{min}</span>
        <span>baseline</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
