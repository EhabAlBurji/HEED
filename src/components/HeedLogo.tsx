// Heed brand logo — stylized "H" letter on a rounded square.
// The square color uses `currentColor` so the parent can tint it (e.g. text-primary).
// Pass `className` to control sizing.
export function HeedLogo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect width="100" height="100" rx="22" fill="currentColor" />
      <path
        d="M 14 90 L 14 22 L 30 8 L 30 44 L 70 44 L 70 8 L 86 22 L 86 90 L 70 90 L 70 56 L 30 56 L 30 90 Z"
        fill="white"
      />
    </svg>
  );
}
