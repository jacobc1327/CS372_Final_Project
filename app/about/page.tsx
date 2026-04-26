import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">
        About
      </div>
      <h1 className="mt-3 font-serif text-5xl tracking-tight md:text-6xl">
        How it works
      </h1>

      <div className="mt-12 space-y-12 text-lg leading-relaxed text-foreground">
        <p className="text-balance">
          Workout Program Editor is a way to read famous strength programs the way a coach
          would — not as a fixed prescription, but as a system of variables that
          you can pull on and watch react.
        </p>

        <section>
          <h2 className="font-serif text-2xl tracking-tight">
            What's in the library
          </h2>
          <p className="mt-4 text-muted-foreground">
            The catalog covers powerlifting, strength, hypertrophy, beginner,
            Olympic, hybrid, and conditioning programs. Each one has its
            published structure: weeks, days, exercises, sets, reps, and
            intensity targets. The progression model — linear, wave, block,
            taper — is encoded so weekly stress shifts feel real.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl tracking-tight">
            What the editor changes
          </h2>
          <p className="mt-4 text-muted-foreground">
            In the editor, you can adjust three master modifiers — volume,
            intensity, and frequency — and tune individual exercises. Your
            edits live in a workspace separate from the original program, so
            you can always reset.
          </p>
        </section>

        <section>
          <h2 className="font-serif text-2xl tracking-tight">
            What the simulator predicts
          </h2>
          <p className="mt-4 text-muted-foreground">
            The simulator combines your modified program with a sandbox of
            personal variables — sleep, soreness, recovery, recent progress,
            goal — and produces four scores: fatigue, progress, plateau risk,
            and adherence difficulty. The model is a simplified abstraction of
            how training stress accumulates and how recovery interacts with
            progress.
          </p>
          <div className="mt-6 rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
            <strong className="text-foreground">A word of caution.</strong>{" "}
            These predictions are illustrative, not medical or coaching advice.
            They exist to help you think clearly about trade-offs — not to
            replace a real coach who knows your history.
          </div>
        </section>

        <section>
          <h2 className="font-serif text-2xl tracking-tight">
            Try it yourself
          </h2>
          <p className="mt-4 text-muted-foreground">
            The fastest way to understand the tool is to open a familiar
            program — say, 5/3/1 — and start sliding things around.
          </p>
          <div className="mt-6">
            <Link
              href="/library"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Browse the library
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
