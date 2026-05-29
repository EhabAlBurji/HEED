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

const Dashboard    = lazy(() => import("./pages/Dashboard"));
const Projects     = lazy(() => import("./pages/Projects"));
const ProjectBoard = lazy(() => import("./pages/ProjectBoard"));
const Settings     = lazy(() => import("./pages/Settings"));
const Schedule     = lazy(() => import("./pages/Schedule"));
const LoginPage    = lazy(() => import("./pages/LoginPage"));

export default function App() {
  const fontSize  = useUIStore((s) => s.fontSize);
  const theme     = useUIStore((s) => s.theme);
  const isTray    = useUIStore((s) => s.isTray);
  const setIsTray = useUIStore((s) => s.setIsTray);
  const user      = useAuthStore((s) => s.user);
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

  // Deep link OAuth callback: mindora://auth-callback?code=...
  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    (async () => {
      try {
        const { onOpenUrl, getCurrent } = await import("@tauri-apps/plugin-deep-link");
        const handle = (urls: string[]) => {
          for (const url of urls) {
            if (url.startsWith("mindora://auth-callback")) {
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

  return (
    <AppShell>
      <ErrorBoundary>
        <Suspense fallback={<AppLoader />}>
          <Routes>
            <Route path="/"             element={<Dashboard />} />
            <Route path="/projects"     element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectBoard />} />
            <Route path="/settings"     element={<Settings />} />
            <Route path="/schedule"     element={<Schedule />} />
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
