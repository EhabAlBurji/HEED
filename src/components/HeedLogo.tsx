// Heed brand logo — the official "H on rounded square" icon.
// PNG source lives in public/heed-icon.png. Pass `className` to size it.
export function HeedLogo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <img
      src="/heed-icon.png"
      alt="Heed"
      className={className}
      draggable={false}
    />
  );
}

// Full wordmark version (icon + "HEED" text). Use on landing / login etc.
export function HeedLogoFull({ className = "h-8" }: { className?: string }) {
  return (
    <img
      src="/heed-logo-full.png"
      alt="Heed"
      className={className}
      draggable={false}
    />
  );
}
