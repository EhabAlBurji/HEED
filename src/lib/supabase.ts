import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";

// Public Supabase config — the anon key is safe to ship in clients (RLS-protected).
// Fallback literals allow the app to run without a .env file (e.g. GitHub Pages deploy).
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "https://fojakeyxfvdrahxcrdoj.supabase.co";
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZvamFrZXl4ZnZkcmFoeGNyZG9qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNTQyODUsImV4cCI6MjA5NTYzMDI4NX0.wBZjwfHLgRVZq_8pEFwiy3EVVJYPujMNJwggtaZ_YDg";

// Exported so features that talk to Edge Functions directly (e.g. the HEED CHAT
// streaming proxy, which needs a raw fetch for SSE) can build the URL + headers.
export const supabaseUrl = url;
export const supabaseAnonKey = anonKey;

let client: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (client) return client;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env"
    );
  }
  client = createClient<Database>(url, anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

export const isSupabaseConfigured = () => Boolean(url && anonKey);
