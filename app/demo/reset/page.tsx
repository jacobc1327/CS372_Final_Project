"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { seedDemoDataIfEmpty } from "@/lib/demo-seed";

function clearKeys(prefixes: string[]) {
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k) continue;
    if (prefixes.some((p) => k.startsWith(p))) keys.push(k);
  }
  for (const k of keys) window.localStorage.removeItem(k);
}

export default function DemoResetPage() {
  const [done, setDone] = useState(false);

  useEffect(() => {
    // No-op
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 md:py-14">
      <header className="rounded-2xl border border-border bg-card p-8 md:p-10">
        <div className="text-xs uppercase tracking-widest text-muted-foreground">Demo</div>
        <h1 className="mt-2 font-serif text-4xl tracking-tight">Reset demo data</h1>
        <p className="mt-3 text-muted-foreground">
          Clears local demo history (plans, sessions, active plan, workspace) and reseeds a clean,
          showcase-ready state.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              // Clear all app keys we use in this project (safe for demo).
              clearKeys([
                "atps-",
              ]);
              // Reseed the demo data.
              seedDemoDataIfEmpty();
              setDone(true);
            }}
          >
            Reset + reseed
          </button>
          <Link
            href="/demo"
            className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted"
          >
            Back to Demo hub
          </Link>
        </div>
        {done && (
          <div className="mt-5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-muted-foreground">
            Demo data reset complete. Go back to the hub and start the walkthrough.
          </div>
        )}
      </header>
    </div>
  );
}

