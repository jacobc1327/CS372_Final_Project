"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  EXERCISE_FAMILIES,
  EXERCISE_LIBRARY,
  MUSCLE_GROUPS,
  type Exercise,
  type LibraryExercise,
  type MuscleGroup,
  type Program,
  type ProgramWeek,
  type WorkoutDay,
} from "@/lib/mock-data";
import { useWorkspace } from "@/components/workspace-provider";
import { cn } from "@/lib/utils";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type DayOfWeek = (typeof DAYS)[number];

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export default function BuilderPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const {
    getCustomProgram,
    isDraft,
    updateCustomProgram,
    publishCustomProgram,
    deleteCustomProgram,
  } = useWorkspace();

  const program = getCustomProgram(params.id);
  const draft = isDraft(params.id);

  const [weekIndex, setWeekIndex] = useState(0);
  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [pickerFamily, setPickerFamily] = useState<LibraryExercise["family"] | null>(null);

  const sessionsConfigured = useMemo(
    () =>
      program?.weeks.reduce(
        (sum, w) => sum + w.days.filter((d) => d.exercises.length > 0).length,
        0,
      ) ?? 0,
    [program],
  );
  const totalSlots = program ? program.duration * program.daysPerWeek : 0;
  const canPublish = sessionsConfigured >= 1;

  // ============ Not found state ============
  if (!program) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-24 text-center">
        <h1 className="font-serif text-4xl tracking-tight">
          That program isn&apos;t in your workspace.
        </h1>
        <p className="mt-3 text-muted-foreground">
          Custom programs are stored in this browser (localStorage). If you cleared site data or switched browsers, this draft may no longer be available.
        </p>
        <Link
          href="/create"
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Start a new program
        </Link>
      </div>
    );
  }

  const week = program.weeks[weekIndex];
  const editingDay = week?.days.find((d) => d.id === editingDayId) ?? null;
  const usedDaysOfWeek = new Set(week?.days.map((d) => d.dayOfWeek));

  // ============ Mutators (always commit to context) ============
  const setProgram = (next: Program) => updateCustomProgram(program.id, next);

  const setWeek = (mutator: (w: ProgramWeek) => ProgramWeek) => {
    setProgram({
      ...program,
      weeks: program.weeks.map((w, i) => (i === weekIndex ? mutator(w) : w)),
    });
  };

  const toggleDeload = () => setWeek((w) => ({ ...w, deload: !w.deload }));

  const addDayOfWeek = (dow: DayOfWeek) => {
    if (usedDaysOfWeek.has(dow)) return;
    const newDay: WorkoutDay = {
      id: uid("day"),
      name: `${dow} session`,
      dayOfWeek: dow,
      focus: "",
      exercises: [],
    };
    setWeek((w) => ({
      ...w,
      days: [...w.days, newDay].sort(
        (a, b) => DAYS.indexOf(a.dayOfWeek) - DAYS.indexOf(b.dayOfWeek),
      ),
    }));
    setEditingDayId(newDay.id);
  };

  const updateDay = (dayId: string, mutator: (d: WorkoutDay) => WorkoutDay) =>
    setWeek((w) => ({
      ...w,
      days: w.days.map((d) => (d.id === dayId ? mutator(d) : d)),
    }));

  const removeDay = (dayId: string) =>
    setWeek((w) => ({ ...w, days: w.days.filter((d) => d.id !== dayId) }));

  const addLibraryExercise = (lib: LibraryExercise) => {
    if (!editingDay) return;
    const ex: Exercise = {
      id: uid("ex"),
      name: lib.name,
      sets: lib.defaultSets,
      reps: lib.defaultReps,
      intensity: lib.defaultIntensity,
      group: lib.group,
    };
    updateDay(editingDay.id, (d) => ({ ...d, exercises: [...d.exercises, ex] }));
    setPickerOpen(false);
    setPickerSearch("");
    setPickerFamily(null);
  };

  const addBlankExercise = () => {
    if (!editingDay) return;
    const ex: Exercise = {
      id: uid("ex"),
      name: "New exercise",
      sets: 3,
      reps: "8",
      intensity: 0,
      group: "arms",
    };
    updateDay(editingDay.id, (d) => ({ ...d, exercises: [...d.exercises, ex] }));
  };

  const updateExercise = (exId: string, patch: Partial<Exercise>) => {
    if (!editingDay) return;
    updateDay(editingDay.id, (d) => ({
      ...d,
      exercises: d.exercises.map((e) => (e.id === exId ? { ...e, ...patch } : e)),
    }));
  };

  const removeExercise = (exId: string) => {
    if (!editingDay) return;
    updateDay(editingDay.id, (d) => ({
      ...d,
      exercises: d.exercises.filter((e) => e.id !== exId),
    }));
  };

  const handlePublish = () => {
    if (!canPublish) return;
    publishCustomProgram(program.id);
    router.push(`/programs/${program.id}`);
  };

  const handleDiscard = () => {
    if (confirm("Discard this draft? It will be removed from your workspace.")) {
      deleteCustomProgram(program.id);
      router.push("/my-programs");
    }
  };

  // Filtered picker results
  const pickerResults = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return EXERCISE_LIBRARY.filter((e) => {
      if (pickerFamily && e.family !== pickerFamily) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [pickerSearch, pickerFamily]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 md:py-14">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground">
        <Link href="/my-programs" className="hover:text-foreground">
          My programs
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{program.name}</span>
      </nav>

      {/* Header */}
      <header className="mt-6 flex flex-wrap items-end justify-between gap-6 border-b border-border pb-8">
        <div>
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Step 2 of 2 · Structure
          </div>
          <h1 className="mt-2 font-serif text-4xl tracking-tight md:text-5xl">
            {program.name}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            {draft ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-2.5 py-0.5 font-medium text-accent">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                Draft · auto-saving
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 font-medium text-muted-foreground">
                Published · auto-saving
              </span>
            )}
            <span className="text-muted-foreground">
              {sessionsConfigured} of {totalSlots} sessions configured
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDiscard}
            className="rounded-md border border-border bg-card px-4 py-2 text-sm text-muted-foreground hover:border-destructive/40 hover:text-destructive"
          >
            Discard
          </button>
          {draft ? (
            <button
              onClick={handlePublish}
              disabled={!canPublish}
              title={!canPublish ? "Add at least one session with an exercise" : ""}
              className={cn(
                "rounded-md px-4 py-2 text-sm font-medium transition-colors",
                canPublish
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "cursor-not-allowed bg-muted text-muted-foreground",
              )}
            >
              Save & finish
            </button>
          ) : (
            <Link
              href={`/programs/${program.id}`}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              View program
            </Link>
          )}
        </div>
      </header>

      {/* Week tabs */}
      <div className="mt-8 flex flex-wrap gap-1 border-b border-border">
        {program.weeks.map((w, i) => {
          const filled = w.days.filter((d) => d.exercises.length > 0).length;
          const active = i === weekIndex;
          return (
            <button
              key={w.weekNumber}
              onClick={() => setWeekIndex(i)}
              className={cn(
                "relative -mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition-colors",
                active
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <span>Week {w.weekNumber}</span>
              {filled > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                    active
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  {filled}
                </span>
              )}
              {w.deload && (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  · deload
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Week toolbar */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={!!week?.deload}
            onChange={toggleDeload}
            className="h-4 w-4 rounded border-border accent-foreground"
          />
          <span>Mark Week {week?.weekNumber} as deload</span>
        </label>
        <span className="text-xs text-muted-foreground">
          Click any day to plan it. Click again to edit.
        </span>
      </div>

      {/* Day grid */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-7">
        {DAYS.map((dow) => {
          const day = week?.days.find((d) => d.dayOfWeek === dow);
          const isOpen = day?.id === editingDayId;
          if (!day) {
            return (
              <button
                key={dow}
                onClick={() => addDayOfWeek(dow)}
                className="group flex aspect-[3/4] flex-col items-start justify-between rounded-lg border border-dashed border-border bg-card/40 p-3 text-left transition-all hover:border-foreground/30 hover:bg-card"
              >
                <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  {dow}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Add session
                </div>
              </button>
            );
          }
          return (
            <button
              key={dow}
              onClick={() => setEditingDayId(day.id)}
              className={cn(
                "group flex aspect-[3/4] flex-col rounded-lg border p-3 text-left transition-all",
                isOpen
                  ? "border-foreground bg-accent/10"
                  : "border-border bg-card hover:-translate-y-0.5 hover:border-foreground/30",
              )}
            >
              <div className="text-[10px] font-medium uppercase tracking-widest text-foreground/60">
                {dow}
              </div>
              <div className="mt-auto">
                <div className="line-clamp-2 text-sm font-medium leading-tight">
                  {day.name}
                </div>
                <div className="mt-1 text-[11px] text-foreground/55">
                  {day.exercises.length}{" "}
                  {day.exercises.length === 1 ? "exercise" : "exercises"}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Day editor — slide-out drawer */}
      {editingDay && (
        <DayEditorDrawer
          key={editingDay.id}
          day={editingDay}
          onClose={() => {
            setEditingDayId(null);
            setPickerOpen(false);
            setPickerSearch("");
            setPickerFamily(null);
          }}
          onUpdateDayMeta={(patch) =>
            updateDay(editingDay.id, (d) => ({ ...d, ...patch }))
          }
          onRemoveDay={() => {
            const id = editingDay.id;
            removeDay(id);
            setEditingDayId(null);
          }}
          onAddBlank={addBlankExercise}
          pickerOpen={pickerOpen}
          onTogglePicker={() => setPickerOpen((v) => !v)}
          pickerSearch={pickerSearch}
          onPickerSearchChange={setPickerSearch}
          pickerFamily={pickerFamily}
          onPickerFamilyChange={setPickerFamily}
          pickerResults={pickerResults}
          onPickLibrary={addLibraryExercise}
          onUpdateExercise={updateExercise}
          onRemoveExercise={removeExercise}
        />
      )}
    </div>
  );
}

// =============================================================================
// Day editor drawer
// =============================================================================

function DayEditorDrawer({
  day,
  onClose,
  onUpdateDayMeta,
  onRemoveDay,
  onAddBlank,
  pickerOpen,
  onTogglePicker,
  pickerSearch,
  onPickerSearchChange,
  pickerFamily,
  onPickerFamilyChange,
  pickerResults,
  onPickLibrary,
  onUpdateExercise,
  onRemoveExercise,
}: {
  day: WorkoutDay;
  onClose: () => void;
  onUpdateDayMeta: (patch: Partial<Pick<WorkoutDay, "name" | "focus">>) => void;
  onRemoveDay: () => void;
  onAddBlank: () => void;
  pickerOpen: boolean;
  onTogglePicker: () => void;
  pickerSearch: string;
  onPickerSearchChange: (v: string) => void;
  pickerFamily: LibraryExercise["family"] | null;
  onPickerFamilyChange: (v: LibraryExercise["family"] | null) => void;
  pickerResults: LibraryExercise[];
  onPickLibrary: (lib: LibraryExercise) => void;
  onUpdateExercise: (exId: string, patch: Partial<Exercise>) => void;
  onRemoveExercise: (exId: string) => void;
}) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div
        className="absolute inset-0 bg-foreground/20 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside className="relative ml-auto flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-border bg-background shadow-2xl">
        {/* Drawer header */}
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/95 px-6 py-4 backdrop-blur">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {day.dayOfWeek}
            </div>
            <h2 className="font-serif text-xl tracking-tight">Day editor</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
          >
            Close
          </button>
        </header>

        <div className="flex-1 space-y-8 px-6 py-6">
          {/* Day meta */}
          <section className="space-y-4">
            <div>
              <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Workout name
              </label>
              <input
                type="text"
                value={day.name}
                onChange={(e) => onUpdateDayMeta({ name: e.target.value })}
                className="mt-2 w-full rounded-md border border-border bg-card px-3 py-2.5 text-base focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Focus
              </label>
              <input
                type="text"
                value={day.focus}
                onChange={(e) => onUpdateDayMeta({ focus: e.target.value })}
                placeholder="lower body, push, full body…"
                className="mt-2 w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>
          </section>

          {/* Exercises */}
          <section>
            <div className="flex items-baseline justify-between">
              <h3 className="font-serif text-lg tracking-tight">
                Exercises
                <span className="ml-2 text-sm text-muted-foreground">
                  · {day.exercises.length}
                </span>
              </h3>
            </div>

            {day.exercises.length === 0 ? (
              <div className="mt-4 rounded-lg border border-dashed border-border bg-card/40 p-8 text-center text-sm text-muted-foreground">
                No exercises yet. Add one from the library or build a custom row.
              </div>
            ) : (
              <ul className="mt-4 space-y-3">
                {day.exercises.map((ex, idx) => (
                  <ExerciseRow
                    key={ex.id}
                    index={idx + 1}
                    exercise={ex}
                    onUpdate={(patch) => onUpdateExercise(ex.id, patch)}
                    onRemove={() => onRemoveExercise(ex.id)}
                  />
                ))}
              </ul>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={onTogglePicker}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-sm transition-colors",
                  pickerOpen
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card hover:bg-muted",
                )}
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                {pickerOpen ? "Hide library" : "Add from library"}
              </button>
              <button
                onClick={onAddBlank}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3.5 py-2 text-sm hover:bg-muted"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Custom row
              </button>
            </div>

            {/* Library picker (inline expanding) */}
            {pickerOpen && (
              <div className="mt-4 rounded-xl border border-border bg-card p-4">
                <div className="relative">
                  <svg
                    viewBox="0 0 24 24"
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5" />
                  </svg>
                  <input
                    type="search"
                    value={pickerSearch}
                    onChange={(e) => onPickerSearchChange(e.target.value)}
                    placeholder="Search exercises…"
                    className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-ring/30"
                    autoFocus
                  />
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  <FamilyChip
                    label="All"
                    active={pickerFamily === null}
                    onClick={() => onPickerFamilyChange(null)}
                  />
                  {EXERCISE_FAMILIES.map((f) => (
                    <FamilyChip
                      key={f.id}
                      label={f.label}
                      active={pickerFamily === f.id}
                      onClick={() => onPickerFamilyChange(f.id)}
                    />
                  ))}
                </div>

                <div className="mt-3 max-h-64 overflow-y-auto rounded-md border border-border">
                  {pickerResults.length === 0 ? (
                    <div className="p-6 text-center text-sm text-muted-foreground">
                      No exercises match.
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {pickerResults.map((lib) => (
                        <li key={lib.name}>
                          <button
                            onClick={() => onPickLibrary(lib)}
                            className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left hover:bg-muted"
                          >
                            <div>
                              <div className="text-sm font-medium">
                                {lib.name}
                              </div>
                              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                                {lib.group}
                              </div>
                            </div>
                            <div className="text-xs tabular-nums text-muted-foreground">
                              {lib.defaultSets}×{lib.defaultReps}
                              {lib.defaultIntensity > 0
                                ? ` @${lib.defaultIntensity}%`
                                : ""}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Drawer footer */}
        <footer className="sticky bottom-0 flex items-center justify-between border-t border-border bg-background/95 px-6 py-4 backdrop-blur">
          <button
            onClick={onRemoveDay}
            className="text-sm text-muted-foreground hover:text-destructive"
          >
            Delete this day
          </button>
          <button
            onClick={onClose}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Done
          </button>
        </footer>
      </aside>
    </div>
  );
}

function FamilyChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-0.5 text-xs transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function ExerciseRow({
  index,
  exercise,
  onUpdate,
  onRemove,
}: {
  index: number;
  exercise: Exercise;
  onUpdate: (patch: Partial<Exercise>) => void;
  onRemove: () => void;
}) {
  return (
    <li className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start gap-2">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-border text-[11px] tabular-nums text-muted-foreground">
          {index}
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={exercise.name}
              onChange={(e) => onUpdate({ name: e.target.value })}
              placeholder="Exercise name"
              className="min-w-0 flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm font-medium focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-ring/30"
            />
            <select
              value={exercise.group}
              onChange={(e) =>
                onUpdate({ group: e.target.value as MuscleGroup })
              }
              className="rounded-md border border-border bg-background px-2 py-1.5 text-xs uppercase tracking-widest text-muted-foreground focus:border-foreground/30 focus:outline-none"
            >
              {MUSCLE_GROUPS.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <FieldStepper
              label="Sets"
              value={exercise.sets}
              min={1}
              max={12}
              onChange={(v) => onUpdate({ sets: v })}
            />
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Reps
              </label>
              <input
                type="text"
                value={exercise.reps}
                onChange={(e) => onUpdate({ reps: e.target.value })}
                placeholder="5, 8-12, AMRAP…"
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm tabular-nums focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Intensity %
              </label>
              <input
                type="number"
                value={exercise.intensity}
                min={0}
                max={120}
                onChange={(e) =>
                  onUpdate({ intensity: Math.max(0, Math.min(120, Number(e.target.value) || 0)) })
                }
                className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1 text-sm tabular-nums focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </div>
          </div>
        </div>
        <button
          onClick={onRemove}
          aria-label="Remove exercise"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </li>
  );
}

function FieldStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-1 rounded-md border border-border bg-background p-0.5">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
          aria-label="Decrease"
        >
          −
        </button>
        <span className="flex-1 text-center text-sm tabular-nums">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
          aria-label="Increase"
        >
          +
        </button>
      </div>
    </div>
  );
}
