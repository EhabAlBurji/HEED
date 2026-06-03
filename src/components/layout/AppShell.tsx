import { useEffect, useState, type ReactNode } from "react";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { GlobalSearch } from "../search/GlobalSearch";
import { useIsMobile } from "../../hooks/useIsMobile";
import { cn } from "../../lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  // Sidebar visibility. Open by default on desktop, hidden on phones. Resyncs
  // whenever we cross the breakpoint; manual toggles persist within a size.
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  useEffect(() => setSidebarOpen(!isMobile), [isMobile]);

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <GlobalSearch />
      {/* Ambient radial glow — soft purple top center */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[420px]"
        style={{
          background:
            "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(97,48,181,0.12) 0%, transparent 70%)",
        }}
      />
      <TopBar onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <div className="relative z-10 flex min-h-0 flex-1">
        {isMobile ? (
          <>
            {/* Backdrop */}
            {sidebarOpen && (
              <button
                aria-label="Close menu"
                onClick={() => setSidebarOpen(false)}
                className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              />
            )}
            {/* Slide-in drawer */}
            <div
              className={cn(
                "fixed inset-y-0 start-0 z-50 transition-transform duration-200 ease-out",
                sidebarOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
              )}
            >
              <Sidebar onNavigate={() => setSidebarOpen(false)} />
            </div>
          </>
        ) : (
          sidebarOpen && <Sidebar />
        )}
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
