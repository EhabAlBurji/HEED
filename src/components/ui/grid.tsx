import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

// ── IBM Carbon-style 2x Grid ────────────────────────────────────────────
// Page  → centered max-width container with responsive gutters.
// Grid  → 4 / 8 / 16 responsive columns with a 16/24px gutter.
// Column→ spans columns; `span` = lg (out of 16), `md` (out of 8), `sm` (out of 4).

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mx-auto w-full max-w-carbon px-c5 py-c6 md:px-c7", className)}>
      {children}
    </div>
  );
}

export function Grid({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-4 gap-x-c5 gap-y-c6 md:grid-cols-8 md:gap-x-c7 lg:grid-cols-16",
        className
      )}
    >
      {children}
    </div>
  );
}

export function Column({
  children,
  span = 16,
  md,
  sm,
  className,
}: {
  children: ReactNode;
  /** columns at lg (out of 16) */
  span?: number;
  /** columns at md (out of 8) */
  md?: number;
  /** columns at sm (out of 4) — defaults to full width */
  sm?: number;
  className?: string;
}) {
  const smSpan = sm ?? 4;
  const mdSpan = md ?? Math.min(8, Math.round(span / 2));
  return (
    <div
      className={cn(
        `col-span-${smSpan}`,
        `md:col-span-${mdSpan}`,
        `lg:col-span-${span}`,
        className
      )}
    >
      {children}
    </div>
  );
}
