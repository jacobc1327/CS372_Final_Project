"use client";

import Link from "next/link";
import { useState } from "react";
import { useWorkspace } from "@/components/workspace-provider";
import { type Program } from "@/lib/mock-data";

const CATEGORY_LABEL: Record<Program["category"], string> = {
  powerlifting: "Powerlifting",
  strength: "Strength",
  hypertrophy: "Hypertrophy",
  beginner: "Beginner",
  olympic: "Olympic",
  hybrid: "Hybrid",
  conditioning: "Conditioning",
};

export default function MyProgramsPage() {
  const { customPrograms, isDraft, deleteCustomProgram } = useWorkspace();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const drafts = customPrograms.filter((p) => isDraft(p.id));
  const published = customPrograms.filter((p) => !isDraft(p.id));

  const totalSessions = (p: Program) =>
    p.weeks.reduce((sum, w) => sum + w.days.length, 0);
  const totalSlots = (p: Program) => p.duration * p.daysPerWeek;

  return (
    <div className="mx-auto max-w-7xl px-6 py-12 md:py-16">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">
            My programs
          </div>
          <h1 className="mt-3 font-serif text-5xl tracking-tight md:text-6xl">
            Your custom programs.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Anything you&apos;ve built lives here. Continue an unfinished draft
            or open a published program in the editor.
          </p>
        </div>
        <Link
          href="/create"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New program
        </Link>
      </header>

      {customPrograms.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="mt-14 space-y-14">
          {drafts.length > 0 && (
            <Section
              eyebrow="In progress"
              title={
                drafts.length === 1
                  ? "1 draft to finish"
                  : `${drafts.length} drafts to finish`
              }
              description="Pick up where you left off. Drafts only need at least one session to be saved."
            >
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {drafts.map((p) => (
                  <DraftCard
                    key={p.id}
                    program={p}
                    sessionsConfigured={totalSessions(p)}
                    sessionsTotal={totalSlots(p)}
                    onDelete={() => setPendingDelete(p.id)}
                  />
                ))}
              </div>
            </Section>
          )}

          {published.length > 0 && (
            <Section
              eyebrow="Published"
              title={
                published.length === 1
                  ? "1 published program"
                  : `${published.length} published programs`
              }
              description="Programs you've finished setting up. Open any to view, edit, or simulate."
            >
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {published.map((p) => (
                  <PublishedCard
                    key={p.id}
                    program={p}
                    sessions={totalSessions(p)}
                    onDelete={() => setPendingDelete(p.id)}
                  />
                ))}
              </div>
            </Section>
          )}
        </div>
      )}

      {/* Delete confirm */}
      {pendingDelete && (
        <DeleteDialog
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            deleteCustomProgram(pendingDelete);
            setPendingDelete(null);
          }}
        />
      )}
    </div>
  );
}

function Section({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="border-b border-border pb-6">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          {eyebrow}
        </div>
        <h2 className="mt-2 font-serif text-3xl tracking-tight md:text-4xl">
          {title}
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {description}
        </p>
      </div>
      <div className="mt-8">{children}</div>
    </section>
  );
}

function DraftCard({
  program,
  sessionsConfigured,
  sessionsTotal,
  onDelete,
}: {
  program: Program;
  sessionsConfigured: number;
  sessionsTotal: number;
  onDelete: () => void;
}) {
  const pct = sessionsTotal > 0 ? (sessionsConfigured / sessionsTotal) * 100 : 0;
  return (
    <div className="group flex flex-col rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-[0_2px_24px_-12px_rgba(0,0,0,0.12)]">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          {CATEGORY_LABEL[program.category]}
        </div>
        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">
          Draft
        </span>
      </div>

      <h3 className="mt-3 font-serif text-2xl leading-tight tracking-tight">
        {program.name || "Untitled"}
      </h3>
      <div className="mt-1 text-sm text-muted-foreground">{program.author}</div>

      {/* Progress */}
      <div className="mt-6">
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-medium">
            {sessionsConfigured} of {sessionsTotal} sessions
          </span>
          <span className="text-muted-foreground">{Math.round(pct)}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-2 border-t border-border pt-4">
        <Link
          href={`/create/${program.id}/builder`}
          className="flex-1 rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Continue
        </Link>
        <button
          onClick={onDelete}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:border-destructive/40 hover:text-destructive"
          aria-label="Delete draft"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function PublishedCard({
  program,
  sessions,
  onDelete,
}: {
  program: Program;
  sessions: number;
  onDelete: () => void;
}) {
  return (
    <div className="group flex flex-col rounded-xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-[0_2px_24px_-12px_rgba(0,0,0,0.12)]">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          {CATEGORY_LABEL[program.category]}
        </div>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Custom
        </span>
      </div>

      <h3 className="mt-3 font-serif text-2xl leading-tight tracking-tight">
        {program.name}
      </h3>
      <div className="mt-1 text-sm text-muted-foreground">{program.author}</div>

      {program.description && (
        <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {program.description}
        </p>
      )}

      <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-sm">
        <div className="flex items-center gap-3 text-muted-foreground">
          <span>{program.duration} weeks</span>
          <span className="h-1 w-1 rounded-full bg-border" />
          <span>{sessions} sessions</span>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Link
          href={`/programs/${program.id}`}
          className="flex-1 rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Open
        </Link>
        <Link
          href={`/create/${program.id}/builder`}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm hover:bg-muted"
          aria-label="Edit structure"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </Link>
        <button
          onClick={onDelete}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground hover:border-destructive/40 hover:text-destructive"
          aria-label="Delete program"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-12 rounded-xl border border-dashed border-border bg-card/50 p-16 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-muted text-muted-foreground">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M12 18v-6M9 15h6" />
        </svg>
      </div>
      <h2 className="mt-6 font-serif text-3xl tracking-tight">
        Nothing here yet.
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
        Build your own program from scratch, or copy an existing one from the
        library and tweak it.
      </p>
      <div className="mt-6 flex items-center justify-center gap-2">
        <Link
          href="/create"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Create a program
        </Link>
        <Link
          href="/library"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-5 py-2.5 text-sm hover:bg-muted"
        >
          Browse library
        </Link>
      </div>
      <p className="mt-8 text-xs text-muted-foreground">
        Note: custom programs live in your browser session and reset on refresh.
      </p>
    </div>
  );
}

function DeleteDialog({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <h3 className="font-serif text-2xl tracking-tight">Delete program?</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          This will remove the program from your workspace. This can&apos;t be
          undone.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
