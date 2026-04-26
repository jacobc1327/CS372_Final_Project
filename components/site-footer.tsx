import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-background">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 md:grid-cols-4">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2.5">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M5 9v6M9 6v12M15 6v12M19 9v6" />
              </svg>
            </div>
            <span className="font-serif text-lg leading-none tracking-tight">Workout Program Editor</span>
          </div>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
            An interactive editor for strength-training programs. Browse the canon, change anything, and see what would happen — before week one.
          </p>
        </div>

        <div>
          <div className="text-sm font-medium">Explore</div>
          <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
            <li><Link href="/library" className="hover:text-foreground">Program library</Link></li>
            <li><Link href="/create" className="hover:text-foreground">Create a program</Link></li>
            <li><Link href="/my-programs" className="hover:text-foreground">My programs</Link></li>
            <li><Link href="/about" className="hover:text-foreground">How it works</Link></li>
          </ul>
        </div>

        <div>
          <div className="text-sm font-medium">Disclaimer</div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Educational tool. Predictions are illustrative — consult a qualified coach for individual programming.
          </p>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-6 py-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Workout Program Editor</span>
          <span>Built by Jacob Cho — Duke BME/CS &apos;28.</span>
        </div>
      </div>
    </footer>
  );
}
