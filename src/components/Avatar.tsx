import { useRef } from "react";
import { X, Upload } from "lucide-react";
import {
  ALL_AVATARS,
  findAvatar,
  avatarValue,
  isAvatarValue,
} from "../lib/avatars";
import { cn } from "../lib/utils";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_MAP: Record<Size, { box: string; text: string }> = {
  xs: { box: "h-6 w-6", text: "text-xs" },
  sm: { box: "h-8 w-8", text: "text-base" },
  md: { box: "h-10 w-10", text: "text-xl" },
  lg: { box: "h-16 w-16", text: "text-3xl" },
  xl: { box: "h-20 w-20", text: "text-4xl" },
};

/**
 * Renders an avatar from a stored value. Three cases:
 * - `avatar:<key>` → colored circle with emoji
 * - data URL or http(s) URL → <img>
 * - else → initials fallback
 */
export function Avatar({
  value,
  fallback,
  size = "md",
  className,
  shape = "circle",
}: {
  value: string | null | undefined;
  fallback?: string;
  size?: Size;
  className?: string;
  shape?: "circle" | "square";
}) {
  const s = SIZE_MAP[size];
  const radius = shape === "circle" ? "rounded-full" : "rounded-2xl";

  const opt = findAvatar(value);
  if (opt) {
    return (
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden",
          s.box,
          radius,
          className
        )}
        style={{ background: opt.bg }}
        aria-label={opt.label}
      >
        <img
          src={opt.image}
          alt={opt.label}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  if (value && !isAvatarValue(value)) {
    return (
      <img
        src={value}
        alt={fallback ?? ""}
        className={cn("shrink-0 object-cover", s.box, radius, className)}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center bg-primary/15 font-semibold text-primary",
        s.box,
        s.text,
        radius,
        className
      )}
    >
      {fallback ?? "؟"}
    </div>
  );
}

export function AvatarPickerModal({
  open,
  onClose,
  onSelect,
  currentValue,
  title,
  allowUpload = true,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (value: string) => void;
  currentValue?: string | null;
  /** legacy prop — kept for API compatibility, no longer affects content */
  variant?: "people" | "projects" | "all";
  title?: string;
  allowUpload?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const list = ALL_AVATARS;

  const currentKey = currentValue && isAvatarValue(currentValue)
    ? currentValue.slice("avatar:".length)
    : null;

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onSelect(reader.result as string);
      onClose();
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md mx-4 rounded-3xl border border-border/60 bg-card shadow-2xl p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="font-display text-base font-semibold">
            {title ?? "اختر صورتك"}
          </h2>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted-foreground/60 hover:bg-secondary hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="font-micro text-[11px] text-muted-foreground/70">
          اختر من المجموعة أو ارفع صورة من جهازك
        </p>

        {/* Upload button */}
        {allowUpload && (
          <>
            <button
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 px-3 py-3 text-sm font-medium text-primary transition hover:bg-primary/10"
            >
              <Upload className="h-4 w-4" />
              <span>ارفع صورتك الخاصة</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
          </>
        )}

        <div className="flex items-center gap-3 pt-1">
          <div className="h-px flex-1 bg-border/40" />
          <span className="font-micro text-[10px] uppercase tracking-widest text-muted-foreground/40">
            أو اختر من المجموعة
          </span>
          <div className="h-px flex-1 bg-border/40" />
        </div>

        {/* Grid */}
        <div className="grid max-h-[55vh] grid-cols-4 gap-3 overflow-y-auto pr-1">
          {list.map((a) => {
            const isSel = a.key === currentKey;
            return (
              <button
                key={a.key}
                onClick={() => {
                  onSelect(avatarValue(a.key));
                  onClose();
                }}
                title={a.label}
                className={cn(
                  "group relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl transition-all",
                  isSel
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105"
                    : "ring-1 ring-border/30 hover:ring-primary/40 hover:scale-105"
                )}
                style={{ background: a.bg }}
              >
                <img
                  src={a.image}
                  alt={a.label}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </button>
            );
          })}
        </div>

        <p className="font-micro text-[10px] text-center text-muted-foreground/50">
          {ALL_AVATARS.length} خيار · اضغط للاختيار
        </p>
      </div>
    </div>
  );
}
