import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async ({ mode }) => {
  // Guard: fail at build-time if a service_role key accidentally ends up in
  // a VITE_ env var (which would expose it to the client bundle).
  const env = loadEnv(mode, process.cwd(), "VITE_");
  for (const [key, val] of Object.entries(env)) {
    if (val.includes("service_role")) {
      throw new Error(
        `[security] ${key} appears to contain a Supabase service_role key. ` +
        `Never expose service_role keys to the client.`
      );
    }
  }

  return {
    plugins: [react()],

    resolve: {
      dedupe: ["react", "react-dom"],
    },

    optimizeDeps: {
      include: ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
    },

    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            recharts: ["recharts"],
            dndkit: ["@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
            vendor: ["react", "react-dom", "react-router-dom"],
            supabase: ["@supabase/supabase-js"],
            motion: ["framer-motion"],
            radix: [
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-popover",
              "@radix-ui/react-select",
              "@radix-ui/react-tabs",
              "@radix-ui/react-toast",
              "@radix-ui/react-tooltip",
            ],
          },
        },
      },
    },

    clearScreen: false,
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
      watch: { ignored: ["**/src-tauri/**"] },
    },
  };
});
