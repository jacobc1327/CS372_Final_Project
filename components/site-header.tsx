"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/library", label: "Library" },
  { href: "/my-programs", label: "My programs" },
  { href: "/coach", label: "Coach" },
  { href: "/history", label: "History" },
  { href: "/demo", label: "Demo" },
  { href: "/about", label: "About" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M5 9v6M9 6v12M15 6v12M19 9v6" />
            </svg>
          </div>
          <span className="font-serif text-base leading-tight tracking-tight md:text-lg">
            <span className="hidden sm:inline">Workout Program Editor</span>
            <span className="sm:hidden">Workout Editor</span>
            <span className="ml-2 hidden text-muted-foreground md:inline">
              — CS372 Final Project
            </span>
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/create"
            className="ml-2 inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Create program
          </Link>
        </nav>
      </div>
    </header>
  );
}
