"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  PROGRAM_CATEGORIES,
  PROGRAM_LEVELS,
  type ProgramCategory,
  type ProgramLevel,
} from "@/lib/mock-data";
import { useWorkspace } from "@/components/workspace-provider";
import { cn } from "@/lib/utils";

export default function CreatePage() {
  const router = useRouter();
  const { createCustomProgram } = useWorkspace();

  const [name, setName] = useState("");
  const [author, setAuthor] = useState("You");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ProgramCategory>("strength");
  const [level, setLevel] = useState<ProgramLevel>("intermediate");
  const [daysPerWeek, setDaysPerWeek] = useState(4);
  const [duration, setDuration] = useState(4);

  const canSubmit = name.trim().length > 0;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const id = createCustomProgram({
      name: name.trim(),
      author: author.trim() || "You",
      description: description.trim(),
      category,
      level,
      daysPerWeek,
      duration,
    });
    router.push(`/create/${id}/builder`);
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 md:py-16">
      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground">
        <Link href="/library" className="hover:text-foreground">
          Library
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">Create program</span>
      </nav>

      {/* Header */}
      <header className="mt-8 max-w-2xl">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">
          Step 1 of 2 · Basics
        </div>
        <h1 className="mt-3 font-serif text-5xl tracking-tight md:text-6xl">
          Build your own program.
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
          Start with a few basics. You&apos;ll add the weekly structure and
          exercises in the next step.
        </p>
      </header>

      {/* Form */}
      <form onSubmit={handleSubmit} className="mt-12 space-y-12">
        {/* Section: Identity */}
        <section className="grid gap-8 border-t border-border pt-8 md:grid-cols-[200px_1fr]">
          <div>
            <h2 className="font-serif text-xl tracking-tight">Identity</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              How others will find and recognize this program.
            </p>
          </div>
          <div className="space-y-6">
            <Field
              label="Program name"
              required
              hint={'A short, distinctive title — like "Push-Pull Block" or "Spring Strength".'}
            >
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My program"
                className="w-full rounded-md border border-border bg-card px-3.5 py-3 text-base placeholder:text-muted-foreground focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-ring/30"
                autoFocus
              />
            </Field>

            <Field label="Author" hint="Who designed this? Yourself, a coach, anyone.">
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="You"
                className="w-full rounded-md border border-border bg-card px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </Field>

            <Field
              label="Description"
              hint="Two or three sentences on the goal, who it's for, or how to use it."
            >
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="A 4-week strength block focused on the squat and bench press."
                className="w-full rounded-md border border-border bg-card px-3.5 py-2.5 text-sm placeholder:text-muted-foreground focus:border-foreground/30 focus:outline-none focus:ring-2 focus:ring-ring/30"
              />
            </Field>
          </div>
        </section>

        {/* Section: Style */}
        <section className="grid gap-8 border-t border-border pt-8 md:grid-cols-[200px_1fr]">
          <div>
            <h2 className="font-serif text-xl tracking-tight">Style</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Helps the simulator and library show the right context.
            </p>
          </div>
          <div className="space-y-6">
            <Field label="Category">
              <div className="flex flex-wrap gap-1.5">
                {PROGRAM_CATEGORIES.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.label}
                    active={category === c.id}
                    onClick={() => setCategory(c.id)}
                  />
                ))}
              </div>
            </Field>

            <Field label="Experience level">
              <div className="flex flex-wrap gap-1.5">
                {PROGRAM_LEVELS.map((l) => (
                  <Chip
                    key={l.id}
                    label={l.label}
                    active={level === l.id}
                    onClick={() => setLevel(l.id)}
                  />
                ))}
              </div>
            </Field>
          </div>
        </section>

        {/* Section: Volume */}
        <section className="grid gap-8 border-t border-border pt-8 md:grid-cols-[200px_1fr]">
          <div>
            <h2 className="font-serif text-xl tracking-tight">Schedule</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              How long is the block and how often you&apos;ll train.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <NumberStepper
              label="Days per week"
              value={daysPerWeek}
              min={1}
              max={7}
              onChange={setDaysPerWeek}
              suffix={daysPerWeek === 1 ? "session" : "sessions"}
            />
            <NumberStepper
              label="Duration"
              value={duration}
              min={1}
              max={16}
              onChange={setDuration}
              suffix={duration === 1 ? "week" : "weeks"}
            />
          </div>
        </section>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-border pt-8">
          <Link
            href="/library"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium transition-colors",
              canSubmit
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "cursor-not-allowed bg-muted text-muted-foreground",
            )}
          >
            Continue to builder
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-sm font-medium">
        {label}
        {required && <span className="text-accent">*</span>}
      </label>
      <div className="mt-2">{children}</div>
      {hint && (
        <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function Chip({
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
        "rounded-full border px-3.5 py-1.5 text-sm transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function NumberStepper({
  label,
  value,
  min,
  max,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  suffix: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="mt-2 flex items-center gap-2 rounded-md border border-border bg-card p-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="h-9 w-9 rounded-md text-lg leading-none text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <div className="flex-1 text-center">
          <div className="font-serif text-2xl tabular-nums leading-none">
            {value}
          </div>
          <div className="mt-0.5 text-[11px] uppercase tracking-widest text-muted-foreground">
            {suffix}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="h-9 w-9 rounded-md text-lg leading-none text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}
