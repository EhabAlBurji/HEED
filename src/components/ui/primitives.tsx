import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

// Shared primitives — single home for the markup that was copy-pasted across
// the task forms, drawers, and pages (audit found Card/Chip/Label/Input
// re-implemented per file). Adopt incrementally.

// ── Button ──────────────────────────────────────────────────────────────
type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type ButtonSize = "sm" | "md";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  outline: "border border-border/60 bg-transparent hover:bg-secondary",
  ghost: "text-muted-foreground hover:bg-secondary hover:text-foreground",
  destructive: "text-destructive hover:bg-destructive/10",
};
const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-xs",
  md: "h-10 px-4 text-sm",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }
>(({ className, variant = "primary", size = "md", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
      buttonVariants[variant],
      buttonSizes[size],
      className
    )}
    {...props}
  />
));
Button.displayName = "Button";

// ── Input / Textarea ────────────────────────────────────────────────────
const fieldBase =
  "w-full rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-sm outline-none transition focus:border-primary/50";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(fieldBase, className)} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(fieldBase, "resize-y", className)} {...props} />
  )
);
Textarea.displayName = "Textarea";

// ── Card ────────────────────────────────────────────────────────────────
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border/60 bg-card/40", className)}>{children}</div>
  );
}

// ── Label (form section label) ──────────────────────────────────────────
export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("font-micro text-[11px] uppercase tracking-widest text-muted-foreground", className)}>
      {children}
    </p>
  );
}

// ── Chip (toggle pill) ──────────────────────────────────────────────────
export function Chip({
  active = false,
  onClick,
  className,
  activeClassName,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  className?: string;
  activeClassName?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-2.5 py-0.5 font-micro text-[10px] transition",
        active
          ? activeClassName ?? "border-primary/45 bg-primary/15 text-primary"
          : "border-border/40 bg-background/40 text-muted-foreground hover:border-primary/35 hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  );
}
