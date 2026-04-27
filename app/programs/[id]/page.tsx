"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import {
  programs,
  buildWeekGrid,
  programMaxStress,
  weeklyStressSeries,
} from "@/lib/mock-data";
import { useWorkspace } from "@/components/workspace-provider";
import { ProgramCard } from "@/components/program-card";

const CATEGORY_LABEL: Record<string, string> = {
  powerlifting: "Powerlifting",
  strength: "Strength",
  hypertrophy: "Hypertrophy",
  beginner: "Beginner",
  olympic: "Olympic",
  hybrid: "Hybrid",
  conditioning: "Conditioning",
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function heatColor(scale: number): string {
  if (scale <= 0) return "var(--stress-rest)";
  if (scale < 0.25) return "var(--stress-low)";
  if (scale < 0.5) return "var(--stress-mid)";
  if (scale < 0.8) return "var(--stress-high)";
  return "var(--stress-peak)";
}

export default function ProgramDetailPage() {
  const params = useParams<{ id: string }>();
  const { resolveProgram, hasChanges } = useWorkspace();

  const resolved = resolveProgram(params.id);
  if (!resolved) {
    notFound();
  }
  const { program, isCustom, isDraft } = resolved;

  // Drafts shouldn't reach this page — bounce them back to the builder
  if (isDraft) {
    if (typeof window !== "undefined") {
      window.location.replace(`/create/${program.id}/builder`);
    }
    return null;
  }

  const max = programMaxStress(program, 100, 100);
  const series = weeklyStressSeries(program, 100, 100);
  const seriesMax = Math.max(...series.map((s) => s.stress), 1);
  const modified = hasChanges(program.id);

  // Related programs — same category from presets, exclude self
  const related = programs
    .filter((p) => p.category === program.category && p.id !== program.id)
    .slice(0, 3);

  return (
    <article>
      {/* ============ Hero ============ */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 pt-10 pb-16 md:pt-14 md:pb-24">
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
            <span className="text-foreground">{program.name}</span>
          </nav>

          <div className="mt-8 flex flex-wrap items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
            <span>{CATEGORY_LABEL[program.category]}</span>
            <span className="text-border">·</span>
            <span>{program.level}</span>
            {isCustom && (
              <>
                <span className="text-border">·</span>
                <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium tracking-wide">
                  Custom
                </span>
              </>
            )}
            {modified && (
              <>
                <span className="text-border">·</span>
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium tracking-wide text-accent">
                  Modified in your workspace
                </span>
              </>
            )}
          </div>

          <h1 className="mt-4 font-serif text-5xl leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
            {program.name}
          </h1>
          <div className="mt-4 text-lg text-muted-foreground">
            By {program.author}
          </div>

          <p className="mt-8 max-w-3xl text-lg leading-relaxed text-foreground/85 text-pretty">
            {program.description}
          </p>

          <div className="mt-8 flex flex-wrap gap-1.5">
            {program.tags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>

          {/* CTAs */}
          <div className="mt-12 flex flex-wrap items-center gap-3">
            <Link
              href={`/programs/${program.id}/coach`}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Start coaching
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0Z" />
                <path d="m10 9 5 3-5 3V9Z" />
              </svg>
            </Link>
            <Link
              href={`/programs/${program.id}/editor`}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium hover:bg-muted"
            >
              Edit template
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
            </Link>
            <Link
              href={`/programs/${program.id}/simulate`}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium hover:bg-muted"
            >
              Diagnose
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M12 3v18M3 12h18" />
              </svg>
            </Link>
            {isCustom && (
              <Link
                href={`/create/${program.id}/builder`}
                className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium hover:bg-muted"
              >
                Edit structure
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
                </svg>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* ============ Stats ============ */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4">
            {[
              { l: "Duration", v: `${program.duration} weeks` },
              { l: "Frequency", v: `${program.daysPerWeek}× / week` },
              { l: "Volume index", v: program.baseVolume },
              { l: "Intensity index", v: program.baseIntensity },
            ].map((s) => (
              <div key={s.l} className="bg-card p-6">
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  {s.l}
                </div>
                <div className="mt-2 font-serif text-3xl tracking-tight">
                  {s.v}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Week structure ============ */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground">
                Structure
              </div>
              <h2 className="mt-2 font-serif text-3xl tracking-tight md:text-4xl">
                How a typical week looks
              </h2>
              <p className="mt-2 max-w-xl text-muted-foreground">
                Each cell is a training day, shaded by relative session stress.
                Open the editor to dive in.
              </p>
            </div>
          </div>

          {/* Heatmap of week 1 */}
          <div className="mt-10 rounded-xl border border-border bg-card p-6 md:p-8">
            <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-widest text-muted-foreground">
              <span>Week 1</span>
              <span>{program.weeks[0].days.length} sessions</span>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {DAYS.map((d) => {
                const cell = buildWeekGrid(
                  program.weeks[0],
                  100,
                  100,
                  max,
                ).find((c) => c.day === d);
                const w = cell?.workout;
                const scale = cell?.intensityScale ?? 0;
                return (
                  <div
                    key={d}
                    className="group relative flex aspect-[3/4] flex-col rounded-lg border border-border p-3 transition-transform hover:-translate-y-0.5"
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
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stress curve across full program */}
          <div className="mt-8 rounded-xl border border-border bg-card p-6 md:p-8">
            <div className="flex items-baseline justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground">
                  Weekly stress curve
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Total session stress per week across the {program.duration}
                  -week block.
                </div>
              </div>
            </div>
            <div className="mt-6 flex h-32 items-end gap-1.5">
              {series.map((s) => {
                const h = Math.max(8, (s.stress / seriesMax) * 100);
                return (
                  <div key={s.week} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className={`w-full rounded-sm transition-colors ${
                        s.deload
                          ? "bg-foreground/15"
                          : "bg-accent/70"
                      }`}
                      style={{ height: `${h}%` }}
                    />
                    <div className="text-[10px] text-muted-foreground">
                      {s.week}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-2 flex items-center gap-4 text-[11px] uppercase tracking-widest text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-accent/70" /> Working week
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-foreground/15" /> Deload
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Related ============ */}
      {related.length > 0 && (
        <section>
          <div className="mx-auto max-w-5xl px-6 py-16">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">
              Related
            </div>
            <h2 className="mt-2 font-serif text-3xl tracking-tight md:text-4xl">
              More {CATEGORY_LABEL[program.category].toLowerCase()} programs
            </h2>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {related.map((p) => (
                <ProgramCard key={p.id} program={p} />
              ))}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
