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
import { VoiceAgent } from "./components/VoiceAgent";
import { startWebUpdateWatcher } from "./lib/webUpdate";
import { startNotifications, stopNotifications } from "./lib/teamSync";
import { startCanvasSync, stopCanvasSync } from "./lib/canvasSync";
import { startChatSync, stopChatSync } from "./lib/chatSync";
import { subscribeHRRealtime } from "./lib/hrSync";
import { supabaseUrl, supabaseAnonKey, getSupabase } from "./lib/supabase";
import { stopDmSubscription } from "./lib/dmSync";
import { requestNotificationPermission } from "./lib/notifications";
import { useWorkspaceStore } from "./stores/workspaceStore";
import { EarlyAccessGate } from "./components/auth/EarlyAccessGate";
import { isAdmin } from "./lib/admin";

const Dashboard    = lazy(() => import("./pages/Dashboard"));
const Projects     = lazy(() => import("./pages/Projects"));
const ProjectBoard = lazy(() => import("./pages/ProjectBoard"));
const Boards       = lazy(() => import("./pages/Boards"));
const BoardView    = lazy(() => import("./pages/BoardView"));
const Settings     = lazy(() => import("./pages/Settings"));
const AdminUsers   = lazy(() => import("./pages/AdminUsers"));
const Inbox        = lazy(() => import("./pages/Inbox"));
const Messages     = lazy(() => import("./pages/Messages"));
const Chat         = lazy(() => import("./pages/Chat"));
const ShareChat    = lazy(() => import("./pages/ShareChat"));
const LoginPage    = lazy(() => import("./pages/LoginPage"));
const HR           = lazy(() => import("./pages/HR"));

export default function App() {
  const fontSize  = useUIStore((s) => s.fontSize);
  const theme     = useUIStore((s) => s.theme);
  const isTray    = useUIStore((s) => s.isTray);
  const setIsTray = useUIStore((s) => s.setIsTray);
  const user      = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const accessStatus = useAuthStore((s) => s.accessStatus);
  const checkSession = useAuthStore((s) => s.checkSession);
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  useInitialSync();

  useEffect(() => {
    document.documentElement.style.fontSize = fontSizePx[fontSize];
  }, [fontSize]);

  useEffect(() => {
    // Light is now the default (defined on :root); .dark class flips to dark variant
    if (theme === "system") {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const apply = (dark: boolean) => document.documentElement.classList.toggle("dark", dark);
      apply(mq.matches);
      const handler = (e: MediaQueryListEvent) => apply(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    } else {
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
  }, [theme]);

  useEffect(() => {
    // Set up persistent auth listener before checking session so that OAuth
    // redirects (where the session becomes ready asynchronously) are caught.
    const unsubAuth = useAuthStore.getState().initAuthListener();
    void checkSession();
    // MCP bridge polls Tauri IPC — only useful in the native app, not on the web.
    const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
    if (inTauri) startMcpBridge();
    return () => {
      unsubAuth();
      if (inTauri) stopMcpBridge();
    };
  }, [checkSession]);

  // Web: auto-reload to the latest deployed build when the tab regains focus,
  // so heedapp.co always opens on the newest version without a manual refresh.
  useEffect(() => { startWebUpdateWatcher(); }, []);

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

  // Cross-user notifications + chat sync: start while signed in.
  useEffect(() => {
    if (user && user.id !== "guest") {
      void useAuthStore.getState().fetchAccessStatus();
      startChatSync();
      void startNotifications();
      void requestNotificationPermission();
      // Fire-and-forget: send today's task reminder digest for this user on login.
      void (async () => {
        try {
          const { data } = await getSupabase().auth.getSession();
          const token = data.session?.access_token || supabaseAnonKey;
          await fetch(`${supabaseUrl}/functions/v1/remind-tasks`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              apikey: supabaseAnonKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ userId: user.id }),
          });
        } catch {
          // Non-critical — ignore errors silently
        }
      })();
    }
    return () => {
      stopChatSync();
      stopNotifications();
      stopDmSubscription();
    };
  }, [user]);

  // Canvas sync + HR realtime: re-run whenever the active workspace changes
  // so boards and HR data always reflect the current workspace in real-time.
  useEffect(() => {
    if (!user || user.id === "guest" || !activeWorkspaceId) return;
    let cancelled = false;
    void (async () => {
      await startCanvasSync();
      if (cancelled) stopCanvasSync();
    })();
    const unsubHR = subscribeHRRealtime(activeWorkspaceId);
    return () => {
      cancelled = true;
      stopCanvasSync();
      unsubHR();
    };
  }, [user, activeWorkspaceId]);

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

  // Public share pages — shown without login or AppShell.
  if (window.location.pathname.startsWith("/share/")) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<AppLoader />}>
          <Routes>
            <Route path="/share/:id" element={<ShareChat />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    );
  }

  // Show a blank loader while the session is being resolved to avoid flashing the login page
  if (isLoading && !user) {
    return <AppLoader />;
  }

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

  // Access gate: only block users explicitly rejected by an admin.
  // "unknown" (offline/unconfigured) fails open so the app is never bricked.
  if (
    user.id !== "guest" &&
    !isAdmin(user.email) &&
    accessStatus === "rejected"
  ) {
    return (
      <ErrorBoundary>
        <EarlyAccessGate status={accessStatus} />
      </ErrorBoundary>
    );
  }

  return (
    <AppShell>
      <Suspense fallback={<AppLoader />}>
        <Routes>
          {/* Each route wrapped in its own ErrorBoundary so one broken page
              can't crash the sidebar or the rest of the app. */}
          <Route path="/"             element={<ErrorBoundary><Messages /></ErrorBoundary>} />
          <Route path="/messages"     element={<ErrorBoundary><Messages /></ErrorBoundary>} />
          <Route path="/inbox"        element={<ErrorBoundary><Inbox /></ErrorBoundary>} />
          <Route path="/dashboard"    element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
          <Route path="/projects"     element={<ErrorBoundary><Projects /></ErrorBoundary>} />
          <Route path="/projects/:id" element={<ErrorBoundary><ProjectBoard /></ErrorBoundary>} />
          <Route path="/boards"       element={<ErrorBoundary><Boards /></ErrorBoundary>} />
          <Route path="/boards/:id"   element={<ErrorBoundary><BoardView /></ErrorBoundary>} />
          <Route path="/settings"     element={<ErrorBoundary><Settings /></ErrorBoundary>} />
          <Route path="/chat"         element={<ErrorBoundary><Chat /></ErrorBoundary>} />
          <Route path="/admin"        element={<ErrorBoundary><AdminUsers /></ErrorBoundary>} />
          <Route path="/hr"           element={<ErrorBoundary><HR /></ErrorBoundary>} />
        </Routes>
      </Suspense>
      <UpdateChecker />
      <VoiceAgent />
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
