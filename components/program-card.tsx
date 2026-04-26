"use client";

import Link from "next/link";
import { type Program, weeklyStressSeries } from "@/lib/mock-data";
import { useWorkspace } from "@/components/workspace-provider";

const CATEGORY_LABEL: Record<Program["category"], string> = {
  powerlifting: "Powerlifting",
  strength: "Strength",
  hypertrophy: "Hypertrophy",
  beginner: "Beginner",
  olympic: "Olympic",
  hybrid: "Hybrid",
  conditioning: "Conditioning",
};

function StressBars({ program }: { program: Program }) {
  const series = weeklyStressSeries(program, 100, 100);
  const max = Math.max(...series.map((s) => s.stress), 1);
  return (
    <div className="flex h-10 items-end gap-[3px]">
      {series.map((s) => {
        const h = Math.max(8, (s.stress / max) * 100);
        return (
          <div
            key={s.week}
            className="flex-1 rounded-sm bg-foreground/15 transition-colors group-hover:bg-accent/70"
            style={{ height: `${h}%` }}
            aria-hidden
          />
        );
      })}
    </div>
  );
}

export function ProgramCard({ program }: { program: Program }) {
  const { hasChanges } = useWorkspace();
  const modified = hasChanges(program.id);

  return (
    <Link
      href={`/programs/${program.id}`}
      className="group flex flex-col rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-[0_2px_24px_-12px_rgba(0,0,0,0.12)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          {CATEGORY_LABEL[program.category]}
        </div>
        {modified && (
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
            Modified
          </span>
        )}
      </div>

      <h3 className="mt-3 font-serif text-2xl leading-tight tracking-tight text-balance">
        {program.name}
      </h3>
      <div className="mt-1 text-sm text-muted-foreground">{program.author}</div>

      <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
        {program.description}
      </p>

      <div className="mt-6">
        <StressBars program={program} />
        <div className="mt-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
          <span>Week 1</span>
          <span>{program.duration} weeks</span>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-sm">
        <div className="flex items-center gap-3 text-muted-foreground">
          <span>{program.daysPerWeek}× / week</span>
          <span className="h-1 w-1 rounded-full bg-border" />
          <span className="capitalize">{program.level}</span>
        </div>
        <span className="text-foreground transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </div>
    </Link>
  );
}
