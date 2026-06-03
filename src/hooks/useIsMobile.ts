import { useEffect, useState } from "react";

// Reactive "is the viewport phone-sized" check. Defaults to the Tailwind `md`
// breakpoint (768px) so it lines up with the `md:` utility classes used across
// the UI. Updates live as the window resizes / device rotates.
export function useIsMobile(breakpoint = 768): boolean {
  const query = `(max-width: ${breakpoint - 1}px)`;
  const [isMobile, setIsMobile] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = () => setIsMobile(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [query]);

  return isMobile;
}
