"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Program } from "@/lib/mock-data";
import {
  appendWorkoutLog,
  getLogForProgram,
  removeWorkoutLogEntry,
  type WorkoutLogEntry,
} from "@/lib/workout-log";

export function SessionLogPanel({ program }: { program: Program }) {
  const [entries, setEntries] = useState<WorkoutLogEntry[]>([]);
  const [weekIdx, setWeekIdx] = useState(0);
  const [dayId, setDayId] = useState("");
  const [note, setNote] = useState("");

  const refresh = useCallback(() => {
    setEntries(getLogForProgram(program.id));
  }, [program.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const week = program.weeks[weekIdx];
  const days = week?.days ?? [];

  useEffect(() => {
    if (!days.length) {
      setDayId("");
      return;
    }
    if (!dayId || !days.some((d) => d.id === dayId)) {
      setDayId(days[0]!.id);
    }
  }, [days, dayId, weekIdx]);

  const selectedDay = useMemo(
    () => days.find((d) => d.id === dayId) ?? null,
    [days, dayId],
  );

  const handleLog = () => {
    if (!week || !selectedDay) return;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `w-${Date.now()}`;
    appendWorkoutLog({
      id,
      programId: program.id,
      programName: program.name,
      weekNumber: week.weekNumber,
      dayId: selectedDay.id,
      dayName: selectedDay.name,
      dayOfWeek: selectedDay.dayOfWeek,
      completedAt: new Date().toISOString(),
      note: note.trim() || undefined,
    });
    setNote("");
    refresh();
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 md:p-8">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">
        Session log
      </div>
      <h3 className="mt-2 font-serif text-2xl tracking-tight">Saved workouts</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        Log when you complete a day (stored in this browser only). Helps you track what you
        actually ran alongside the simulator.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Week
          <select
            className="mt-1.5 block h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
            value={weekIdx}
            onChange={(e) => setWeekIdx(Number(e.target.value))}
          >
            {program.weeks.map((w, i) => (
              <option key={w.weekNumber} value={i}>
                Week {w.weekNumber}
                {w.deload ? " (deload)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Day
          <select
            className="mt-1.5 block h-10 w-full rounded-md border border-border bg-background px-2 text-sm"
            value={dayId}
            onChange={(e) => setDayId(e.target.value)}
            disabled={!days.length}
          >
            {days.map((d) => (
              <option key={d.id} value={d.id}>
                {d.dayOfWeek} · {d.name}
                {d.exercises.length === 0 ? " (rest)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="mt-3 block text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Note (optional)
        <textarea
          className="mt-1.5 block min-h-[72px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="e.g. Felt heavy on squats, slept poorly"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <button
        type="button"
        onClick={handleLog}
        disabled={!week || !selectedDay}
        className="mt-3 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        Log this session
      </button>

      {entries.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">No sessions logged for this program yet.</p>
      ) : (
        <ul className="mt-6 space-y-3 border-t border-border/60 pt-5">
          {entries.slice(0, 15).map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-border/80 bg-background/50 px-3 py-2.5 text-sm"
            >
              <div>
                <div className="font-medium text-foreground">
                  Week {e.weekNumber} · {e.dayOfWeek} · {e.dayName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {new Date(e.completedAt).toLocaleString()}
                </div>
                {e.note && (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{e.note}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  removeWorkoutLogEntry(e.id);
                  refresh();
                }}
                className="shrink-0 text-xs text-muted-foreground underline hover:text-accent"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
