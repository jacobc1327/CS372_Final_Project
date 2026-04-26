"use client";

import { useMemo, useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  programs,
  type ProgramCategory,
  type ProgramLevel,
} from "@/lib/mock-data";
import { ProgramCard } from "@/components/program-card";
import { LibraryFilters } from "@/components/library-filters";

function LibraryInner() {
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") as ProgramCategory | null;

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<ProgramCategory | null>(
    initialCategory,
  );
  const [level, setLevel] = useState<ProgramLevel | null>(null);
  const [freq, setFreq] = useState<number | null>(null);
  const [sort, setSort] = useState<"name" | "duration" | "frequency">("name");

  useEffect(() => {
    if (initialCategory) setCategory(initialCategory);
  }, [initialCategory]);

  const filtered = useMemo(() => {
    let list = programs.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !p.author.toLowerCase().includes(q) &&
          !p.tags.some((t) => t.toLowerCase().includes(q))
        ) {
          return false;
        }
      }
      if (category && p.category !== category) return false;
      if (level && p.level !== level) return false;
      if (freq !== null && p.daysPerWeek !== freq) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "duration") return a.duration - b.duration;
      return a.daysPerWeek - b.daysPerWeek;
    });

    return list;
  }, [search, category, level, freq, sort]);

  const reset = () => {
    setCategory(null);
    setLevel(null);
    setFreq(null);
    setSearch("");
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 md:py-16">
      {/* Header */}
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-3xl">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            Library
          </div>
          <h1 className="mt-3 font-serif text-5xl tracking-tight md:text-6xl">
            The program library
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            {programs.length} canonical strength programs, ready to edit.
            Filter by category, level, or frequency — or search by name,
            author, or tag.
          </p>
        </div>
        <a
          href="/create"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Build your own
        </a>
      </header>

      {/* Search bar */}
      <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative max-w-md flex-1">
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
            placeholder="Search by name, author, or tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-border bg-card py-2.5 pl-10 pr-3 text-sm placeholder:text-muted-foreground focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>

        <div className="flex items-center gap-2 text-sm">
          <label className="text-muted-foreground">Sort by</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="rounded-md border border-border bg-card px-3 py-2 text-sm focus:border-foreground/30 focus:outline-none"
          >
            <option value="name">Name</option>
            <option value="duration">Duration</option>
            <option value="frequency">Frequency</option>
          </select>
        </div>
      </div>

      {/* Layout */}
      <div className="grid gap-12 lg:grid-cols-[220px_1fr]">
        <LibraryFilters
          category={category}
          setCategory={setCategory}
          level={level}
          setLevel={setLevel}
          freq={freq}
          setFreq={setFreq}
          total={programs.length}
          filtered={filtered.length}
          onReset={reset}
        />

        <div>
          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/50 p-16 text-center">
              <div className="font-serif text-2xl tracking-tight">
                Nothing matches.
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                Try widening your filters or clearing the search.
              </p>
              <button
                onClick={reset}
                className="mt-6 rounded-md border border-border bg-card px-4 py-2 text-sm hover:bg-muted"
              >
                Reset all filters
              </button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {filtered.map((p) => (
                <ProgramCard key={p.id} program={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-6 py-16 text-muted-foreground">
          Loading library…
        </div>
      }
    >
      <LibraryInner />
    </Suspense>
  );
}
