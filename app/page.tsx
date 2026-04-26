import Link from "next/link";
import { programs, PROGRAM_CATEGORIES } from "@/lib/mock-data";
import { ProgramCard } from "@/components/program-card";

export default function HomePage() {
  const featuredIds = [
    "wendler-531",
    "starting-strength",
    "smolov-jr-bench",
    "ppl-6day",
    "texas-method",
    "german-volume",
  ];

  const featured = featuredIds
    .map((id) => programs.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const featuredCards = featured.length >= 6 ? featured : programs.slice(0, 6);

  const categoryCounts = PROGRAM_CATEGORIES.map((c) => ({
    ...c,
    count: programs.filter((p) => p.category === c.id).length,
  }));

  return (
    <div>
      {/* ============ Hero ============ */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 pt-20 pb-24 md:pt-28 md:pb-32">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              {programs.length} programs · interactive editor · live simulation
            </div>

            <h1 className="mt-8 font-serif text-5xl leading-[1.05] tracking-tight text-balance md:text-7xl lg:text-8xl">
              Strength training,{" "}
              <span className="italic text-accent">decoded</span>.
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-muted-foreground text-pretty md:text-xl">
              Browse the canon — from 5/3/1 to Smolov, Bulgarian Method, German
              Volume, and beyond. Edit any variable. See predicted fatigue,
              progress, and plateau risk{" "}
              <span className="text-foreground">before</span> you ever load the
              bar.
            </p>

            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link
                href="/library"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Browse the library
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/create"
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium hover:bg-muted"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Create your own
              </Link>
              <Link
                href="/about"
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                How it works →
              </Link>
            </div>
          </div>

          {/* Stats strip */}
          <div className="mt-20 grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4">
            {[
              { v: programs.length, l: "Programs in library" },
              { v: PROGRAM_CATEGORIES.length, l: "Categories" },
              { v: "∞", l: "Edits per program" },
              { v: "Live", l: "Simulation engine" },
            ].map((s) => (
              <div key={s.l} className="bg-card p-6">
                <div className="font-serif text-4xl tracking-tight">{s.v}</div>
                <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">
                  {s.l}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Categories ============ */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                Browse by category
              </div>
              <h2 className="mt-2 font-serif text-3xl tracking-tight md:text-4xl">
                Find your fit
              </h2>
            </div>
          </div>

          <div className="mt-10 grid gap-3 md:grid-cols-3 lg:grid-cols-4">
            {categoryCounts.map((c) => (
              <Link
                key={c.id}
                href={`/library?category=${c.id}`}
                className="group flex items-center justify-between rounded-lg border border-border bg-card px-5 py-4 transition-colors hover:border-foreground/20 hover:bg-secondary"
              >
                <div>
                  <div className="font-medium">{c.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.count} {c.count === 1 ? "program" : "programs"}
                  </div>
                </div>
                <span className="text-muted-foreground transition-all group-hover:translate-x-0.5 group-hover:text-foreground">
                  →
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Featured ============ */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                Featured
              </div>
              <h2 className="mt-2 font-serif text-3xl tracking-tight md:text-4xl">
                Start with the classics
              </h2>
            </div>
            <Link
              href="/library"
              className="hidden text-sm text-muted-foreground hover:text-foreground md:block"
            >
              See all {programs.length} →
            </Link>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {featuredCards.map((p) => (
              <ProgramCard key={p.id} program={p} />
            ))}
          </div>

          <div className="mt-10 flex justify-center md:hidden">
            <Link
              href="/library"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              See all {programs.length} →
            </Link>
          </div>
        </div>
      </section>

      {/* ============ How it works ============ */}
      <section>
        <div className="mx-auto max-w-7xl px-6 py-24">
          <h2 className="max-w-2xl font-serif text-3xl tracking-tight md:text-4xl">
            A simple, three-step flow.
          </h2>

          <div className="mt-16 grid gap-12 md:grid-cols-3">
            {[
              {
                n: "01",
                t: "Browse the library",
                d: "Filter the catalog by goal, level, and frequency. Open a program to read the full philosophy and structure.",
              },
              {
                n: "02",
                t: "Edit any variable",
                d: "Tune sets, reps, intensity, even individual exercises. Edits live in your workspace — the original stays pristine.",
              },
              {
                n: "03",
                t: "Simulate the change",
                d: "See predicted fatigue, progress, plateau risk, and adherence load. Adjust your sandbox, watch metrics react in real time.",
              },
            ].map((s) => (
              <div key={s.n}>
                <div className="font-serif text-5xl text-accent">{s.n}</div>
                <div className="mt-6 text-lg font-medium">{s.t}</div>
                <p className="mt-3 leading-relaxed text-muted-foreground">
                  {s.d}
                </p>
              </div>
            ))}
          </div>

          {/* Two-card CTA — browse vs build */}
          <div className="mt-20 grid gap-4 md:grid-cols-2">
            <Link
              href="/library"
              className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-border bg-card p-8 transition-colors hover:border-foreground/20 hover:bg-secondary md:p-10"
            >
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  For explorers
                </div>
                <h3 className="mt-4 font-serif text-2xl tracking-tight md:text-3xl">
                  Browse the canon
                </h3>
                <p className="mt-3 max-w-md text-muted-foreground">
                  Open any of {programs.length} programs, edit it, and run it
                  through the simulator.
                </p>
              </div>
              <div className="mt-8 inline-flex items-center gap-2 text-sm font-medium">
                Browse programs
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </div>
            </Link>

            <Link
              href="/create"
              className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-foreground bg-foreground p-8 text-background transition-opacity hover:opacity-90 md:p-10"
            >
              <div>
                <div className="text-xs uppercase tracking-widest opacity-70">
                  For architects
                </div>
                <h3 className="mt-4 font-serif text-2xl tracking-tight md:text-3xl">
                  Build your own
                </h3>
                <p className="mt-3 max-w-md opacity-80">
                  Start with a blank canvas. Pick exercises, set sets and reps,
                  shape your week — and simulate it.
                </p>
              </div>
              <div className="mt-8 inline-flex items-center gap-2 text-sm font-medium">
                Create a program
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </div>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
