import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { MiniRail } from "./MiniRail";
import { GlobalSearch } from "../search/GlobalSearch";
import { useIsMobile } from "../../hooks/useIsMobile";
import { cn } from "../../lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const location = useLocation();
  // On the Chat page (desktop) collapse the full nav to a slim icon rail so
  // HEED CHAT gets the full-width, ChatGPT-style canvas.
  const chatMode = !isMobile && location.pathname.startsWith("/chat");
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
            "radial-gradient(ellipse 70% 50% at 50% -10%, rgba(66,133,244,0.10) 0%, transparent 70%)",
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
        ) : chatMode ? (
          <MiniRail />
        ) : (
          sidebarOpen && <Sidebar />
        )}
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
