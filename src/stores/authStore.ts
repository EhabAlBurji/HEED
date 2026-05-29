import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getSupabase, isSupabaseConfigured } from "../lib/supabase";
import { resetAllStores } from "../lib/resetStores";

const LAST_USER_KEY = "mindora:last_identity";

// Wipe local stores whenever identity changes (different user, guest→auth,
// or auth→none). Same-identity rehydration is a no-op so authenticated users
// who refresh the app keep their cached data until pullAll() refreshes it.
function ensureFreshFor(newId: string | null) {
  const prev = (typeof localStorage !== "undefined" && localStorage.getItem(LAST_USER_KEY)) || "";
  const curr = newId ?? "";
  if (prev !== curr) {
    resetAllStores();
    if (typeof localStorage !== "undefined") {
      if (curr) localStorage.setItem(LAST_USER_KEY, curr);
      else localStorage.removeItem(LAST_USER_KEY);
    }
  }
}

// Tauri injects `__TAURI_INTERNALS__` on window. In the browser (vite dev), it's absent.
const isTauri = () =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null; // base64 data URL or remote URL
};

type AuthState = {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;

  // Auth methods
  signInWithGoogle: () => Promise<void>;
  handleOAuthCallback: (url: string) => Promise<void>;
  sendOtp: (email: string) => Promise<void>;
  verifyOtp: (email: string, token: string) => Promise<void>;

  // Profile
  updateProfile: (patch: { name?: string; avatarUrl?: string }) => Promise<void>;

  signOut: () => void;
  checkSession: () => Promise<void>;
  continueAsGuest: () => void;
  clearError: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,
      error: null,

      clearError: () => set({ error: null }),

      signInWithGoogle: async () => {
        set({ isLoading: true, error: null });
        try {
          const supabase = getSupabase();
          if (isTauri()) {
            // Desktop: open in system browser, callback via mindora:// deep link
            const { data, error } = await supabase.auth.signInWithOAuth({
              provider: "google",
              options: {
                skipBrowserRedirect: true,
                redirectTo: "mindora://auth-callback",
                queryParams: { access_type: "offline", prompt: "consent" },
              },
            });
            if (error) throw error;
            if (data.url) {
              const { openUrl } = await import("@tauri-apps/plugin-opener");
              await openUrl(data.url);
            }
          } else {
            // Browser: normal OAuth redirect back to the current origin
            const { error } = await supabase.auth.signInWithOAuth({
              provider: "google",
              options: {
                redirectTo: window.location.origin,
                queryParams: { access_type: "offline", prompt: "consent" },
              },
            });
            if (error) throw error;
          }
          set({ isLoading: false });
        } catch (e) {
          set({ error: (e as Error).message, isLoading: false });
          throw e;
        }
      },

      // Handle the deep-link callback from the OAuth provider.
      // The URL looks like: mindora://auth-callback?code=XXX  (PKCE flow)
      // or                   mindora://auth-callback#access_token=...  (implicit)
      handleOAuthCallback: async (url) => {
        set({ isLoading: true, error: null });
        try {
          const supabase = getSupabase();
          // Try PKCE code exchange first
          const u = new URL(url);
          const code = u.searchParams.get("code");
          if (code) {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) throw error;
            const usr = data.user;
            if (!usr) throw new Error("No user returned");
            ensureFreshFor(usr.id);
            set({
              user: {
                id: usr.id,
                email: usr.email ?? "",
                name: (usr.user_metadata?.full_name as string) ?? null,
                avatarUrl: (usr.user_metadata?.avatar_url as string) ?? null,
              },
              isLoading: false,
            });
            return;
          }
          // Fallback: implicit-flow hash tokens
          const hash = u.hash.startsWith("#") ? u.hash.slice(1) : u.hash;
          const params = new URLSearchParams(hash);
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");
          if (access_token && refresh_token) {
            const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) throw error;
            const usr = data.user;
            if (!usr) throw new Error("No user returned");
            ensureFreshFor(usr.id);
            set({
              user: {
                id: usr.id,
                email: usr.email ?? "",
                name: (usr.user_metadata?.full_name as string) ?? null,
                avatarUrl: (usr.user_metadata?.avatar_url as string) ?? null,
              },
              isLoading: false,
            });
            return;
          }
          throw new Error("Callback missing code or tokens");
        } catch (e) {
          set({ error: (e as Error).message, isLoading: false });
        }
      },

      sendOtp: async (email) => {
        set({ isLoading: true, error: null });
        try {
          const supabase = getSupabase();
          const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { shouldCreateUser: true },
          });
          if (error) throw error;
          set({ isLoading: false });
        } catch (e) {
          set({ error: (e as Error).message, isLoading: false });
          throw e;
        }
      },

      verifyOtp: async (email, token) => {
        set({ isLoading: true, error: null });
        try {
          const supabase = getSupabase();
          const { data, error } = await supabase.auth.verifyOtp({
            email,
            token,
            type: "email",
          });
          if (error) throw error;
          const u = data.user;
          if (!u) throw new Error("فشل التحقق");
          ensureFreshFor(u.id);
          set({
            user: {
              id: u.id,
              email: u.email ?? email,
              name: (u.user_metadata?.full_name as string) ?? null,
              avatarUrl: (u.user_metadata?.avatar_url as string) ?? null,
            },
            isLoading: false,
          });
        } catch (e) {
          set({ error: (e as Error).message, isLoading: false });
          throw e;
        }
      },

      updateProfile: async ({ name, avatarUrl }) => {
        const { user } = get();
        if (!user) return;

        const updated: AuthUser = {
          ...user,
          ...(name !== undefined ? { name } : {}),
          ...(avatarUrl !== undefined ? { avatarUrl } : {}),
        };
        set({ user: updated });

        // Sync to Supabase if configured
        if (isSupabaseConfigured() && user.id !== "guest") {
          try {
            const supabase = getSupabase();
            await supabase.auth.updateUser({
              data: {
                ...(name !== undefined ? { full_name: name } : {}),
                ...(avatarUrl !== undefined ? { avatar_url: avatarUrl } : {}),
              },
            });
          } catch {}
        }
      },

      signOut: () => {
        // Wipe local cache so the next user doesn't inherit this one's data
        ensureFreshFor(null);
        set({ user: null, error: null });
        // Fire-and-forget Supabase signout in background
        if (isSupabaseConfigured()) {
          try {
            const supabase = getSupabase();
            void supabase.auth.signOut();
          } catch {}
        }
      },

      checkSession: async () => {
        if (!isSupabaseConfigured()) return;
        set({ isLoading: true });
        try {
          const supabase = getSupabase();
          const { data } = await supabase.auth.getSession();
          if (data.session?.user) {
            const u = data.session.user;
            // Keep local avatarUrl if already set (base64 from profile)
            const existing = get().user;
            ensureFreshFor(u.id);
            set({
              user: {
                id: u.id,
                email: u.email ?? "",
                name: (u.user_metadata?.full_name as string) ?? existing?.name ?? null,
                avatarUrl: existing?.avatarUrl ?? (u.user_metadata?.avatar_url as string) ?? null,
              },
            });
          }
        } finally {
          set({ isLoading: false });
        }
      },

      continueAsGuest: () => {
        ensureFreshFor("guest");
        set({
          user: { id: "guest", email: "", name: null, avatarUrl: null },
        });
      },
    }),
    {
      name: "mindora:auth",
      partialize: (s) => ({ user: s.user }),
    }
  )
);
