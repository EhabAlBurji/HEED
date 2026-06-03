import { Suspense, lazy, useEffect } from "react";
import { Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { ErrorBoundary } from "./components/layout/ErrorBoundary";
import { useUIStore, fontSizePx } from "./stores/uiStore";
import { useTimerStore } from "./stores/timerStore";
import { useAuthStore } from "./stores/authStore";
import { formatHMS } from "./lib/utils";
import { startMcpBridge, stopMcpBridge } from "./lib/mcpBridge";
import { pauseAndCommit, stopTimerAndCommit } from "./lib/timerActions";
import { useInitialSync } from "./hooks/useInitialSync";
import { UpdateChecker } from "./components/UpdateChecker";
import { startNotifications, stopNotifications } from "./lib/teamSync";
import { startCanvasSync, stopCanvasSync } from "./lib/canvasSync";
import { EarlyAccessGate } from "./components/auth/EarlyAccessGate";
import { isAdmin } from "./lib/admin";

const Dashboard    = lazy(() => import("./pages/Dashboard"));
const Projects     = lazy(() => import("./pages/Projects"));
const ProjectBoard = lazy(() => import("./pages/ProjectBoard"));
const Boards       = lazy(() => import("./pages/Boards"));
const BoardView    = lazy(() => import("./pages/BoardView"));
const Settings     = lazy(() => import("./pages/Settings"));
const AdminUsers   = lazy(() => import("./pages/AdminUsers"));
const LoginPage    = lazy(() => import("./pages/LoginPage"));

export default function App() {
  const fontSize  = useUIStore((s) => s.fontSize);
  const theme     = useUIStore((s) => s.theme);
  const isTray    = useUIStore((s) => s.isTray);
  const setIsTray = useUIStore((s) => s.setIsTray);
  const user      = useAuthStore((s) => s.user);
  const accessStatus = useAuthStore((s) => s.accessStatus);
  const checkSession = useAuthStore((s) => s.checkSession);
  useInitialSync();

  useEffect(() => {
    document.documentElement.style.fontSize = fontSizePx[fontSize];
  }, [fontSize]);

  useEffect(() => {
    // Light is now the default (defined on :root); .dark class flips to dark variant
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    void checkSession();
    startMcpBridge();
    return () => stopMcpBridge();
  }, [checkSession]);

  // Re-check access while signed in (on focus + every 2 min) so that an admin
  // revoking a user takes effect on their open session, not just at next login.
  useEffect(() => {
    if (!user || user.id === "guest") return;
    const recheck = () => void useAuthStore.getState().fetchAccessStatus();
    const id = setInterval(recheck, 120_000);
    window.addEventListener("focus", recheck);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", recheck);
    };
  }, [user]);

  // Cross-user notifications + shared boards: pull + realtime while signed in.
  useEffect(() => {
    let cancelled = false;
    if (user && user.id !== "guest") {
      void useAuthStore.getState().fetchAccessStatus();
      void (async () => {
        await startNotifications();
        if (cancelled) { stopNotifications(); return; }
        await startCanvasSync();
        if (cancelled) stopCanvasSync();
      })();
    }
    return () => {
      cancelled = true;
      stopNotifications();
      stopCanvasSync();
    };
  }, [user]);

  // Deep link OAuth callback: heed://auth-callback?code=...
  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    (async () => {
      try {
        const { onOpenUrl, getCurrent } = await import("@tauri-apps/plugin-deep-link");
        const handle = (urls: string[]) => {
          for (const url of urls) {
            if (url.startsWith("heed://auth-callback")) {
              void useAuthStore.getState().handleOAuthCallback(url);
            }
          }
        };
        // Handle URLs the app was launched with (cold start)
        const initial = await getCurrent();
        if (initial && initial.length) handle(initial);
        // Subscribe to subsequent deep-link events (warm start)
        const un = await onOpenUrl(handle);
        unlisteners.push(un);
      } catch {
        // Plugin unavailable (e.g. running in the browser preview) — ignore.
      }
    })();
    return () => unlisteners.forEach((fn) => fn());
  }, []);

  // While window is hidden in tray: tick menu bar + listen for restore and timer menu actions
  useEffect(() => {
    if (!isTray) return;
    let intervalId: ReturnType<typeof setInterval>;
    const unlisteners: (() => void)[] = [];

    async function setup() {
      const { invoke } = await import("@tauri-apps/api/core");
      const { listen }  = await import("@tauri-apps/api/event");

      intervalId = setInterval(() => {
        const { getElapsedSeconds, isRunning, activeTask } = useTimerStore.getState();
        const seconds = getElapsedSeconds();
        const timeStr = formatHMS(seconds);
        const taskName = activeTask?.title ?? "";
        const title = taskName ? `${timeStr} ${taskName}` : timeStr;
        void invoke("update_tray_state", { title, isRunning });
      }, 1000);

      const unShow = await listen("tray:show", () => setIsTray(false));
      unlisteners.push(unShow);

      const unPause  = await listen("timer:pause",  () => pauseAndCommit());
      const unResume = await listen("timer:resume", () => useTimerStore.getState().resume());
      const unStop   = await listen("timer:stop",   () => stopTimerAndCommit());
      unlisteners.push(unPause, unResume, unStop);
    }

    void setup();
    return () => {
      clearInterval(intervalId);
      unlisteners.forEach((fn) => fn());
    };
  }, [isTray, setIsTray]);

  // Show login if not authenticated
  if (!user) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<AppLoader />}>
          <LoginPage />
        </Suspense>
      </ErrorBoundary>
    );
  }

  // Early-access gate: signed-in, non-admin, non-guest users await approval — or
  // were rejected/revoked by an admin. "unknown" (offline/unconfigured) fails
  // open so the app is never bricked.
  if (
    user.id !== "guest" &&
    !isAdmin(user.email) &&
    (accessStatus === "early_access" || accessStatus === "rejected")
  ) {
    return (
      <ErrorBoundary>
        <EarlyAccessGate status={accessStatus} />
      </ErrorBoundary>
    );
  }

  return (
    <AppShell>
      <ErrorBoundary>
        <Suspense fallback={<AppLoader />}>
          <Routes>
            <Route path="/"             element={<Dashboard />} />
            <Route path="/projects"     element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectBoard />} />
            <Route path="/boards"       element={<Boards />} />
            <Route path="/boards/:id"   element={<BoardView />} />
            <Route path="/settings"     element={<Settings />} />
            <Route path="/admin"        element={<AdminUsers />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
      <UpdateChecker />
    </AppShell>
  );
}

function AppLoader() {
  return (
    <div className="grid h-full place-items-center text-sm text-muted-foreground">
      <span className="animate-pulse">بحمّل…</span>
    </div>
  );
}
