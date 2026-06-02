import type { ReactNode } from "react";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";
import { GlobalSearch } from "../search/GlobalSearch";

export function AppShell({ children }: { children: ReactNode }) {
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
      <TopBar />
      <div className="relative z-10 flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-h-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
