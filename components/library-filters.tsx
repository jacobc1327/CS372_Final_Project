"use client";

import { PROGRAM_CATEGORIES, PROGRAM_LEVELS } from "@/lib/mock-data";
import type { ProgramCategory, ProgramLevel } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface LibraryFiltersProps {
  category: ProgramCategory | null;
  setCategory: (v: ProgramCategory | null) => void;
  level: ProgramLevel | null;
  setLevel: (v: ProgramLevel | null) => void;
  freq: number | null;
  setFreq: (v: number | null) => void;
  total: number;
  filtered: number;
  onReset: () => void;
}

const FREQ_OPTIONS = [3, 4, 5, 6];

export function LibraryFilters({
  category,
  setCategory,
  level,
  setLevel,
  freq,
  setFreq,
  total,
  filtered,
  onReset,
}: LibraryFiltersProps) {
  const anyActive = category || level || freq !== null;

  return (
    <aside className="space-y-8 lg:sticky lg:top-24 lg:self-start">
      <div className="flex items-baseline justify-between border-b border-border pb-3">
        <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Filters
        </div>
        {anyActive && (
          <button
            onClick={onReset}
            className="text-xs text-accent hover:underline"
          >
            Reset
          </button>
        )}
      </div>

      <FilterGroup label="Category">
        {PROGRAM_CATEGORIES.map((c) => (
          <FilterChip
            key={c.id}
            active={category === c.id}
            onClick={() => setCategory(category === c.id ? null : c.id)}
          >
            {c.label}
          </FilterChip>
        ))}
      </FilterGroup>

      <FilterGroup label="Level">
        {PROGRAM_LEVELS.map((l) => (
          <FilterChip
            key={l.id}
            active={level === l.id}
            onClick={() => setLevel(level === l.id ? null : l.id)}
          >
            {l.label}
          </FilterChip>
        ))}
      </FilterGroup>

      <FilterGroup label="Frequency">
        {FREQ_OPTIONS.map((f) => (
          <FilterChip
            key={f}
            active={freq === f}
            onClick={() => setFreq(freq === f ? null : f)}
          >
            {f}× / week
          </FilterChip>
        ))}
      </FilterGroup>

      <div className="border-t border-border pt-4 text-xs text-muted-foreground">
        Showing <span className="text-foreground">{filtered}</span> of {total} programs
      </div>
    </aside>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
