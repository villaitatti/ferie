import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string };
const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig(({ mode }) => {
  // The dev proxy follows the API's own `PORT`, so parallel checkouts each reach their own server
  // rather than whichever one claimed 3000 first — the same reason `DEV_DB_PORT` exists.
  const { PORT = "3000" } = loadEnv(mode, repositoryRoot, "");

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    },
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
    server: {
      port: 5173,
      proxy: { "/api": { target: `http://127.0.0.1:${PORT}`, changeOrigin: true } },
    },
    test: {
      setupFiles: ["./src/vitest-setup.ts"],
    },
    build: {
      outDir: "dist",
      rollupOptions: {
        output: {
          // Matched by path rather than the object form: the object form only catches a package's
          // entry module, so react-dom's real code (`react-dom/client`) landed in the app chunk and
          // was re-downloaded on every deploy instead of staying cached with the other primitives.
          manualChunks(id: string) {
            const chunks: Record<string, string[]> = {
              react: ["react", "react-dom", "scheduler", "react-router", "react-router-dom"],
              baseui: ["@base-ui/react"],
              calendar: ["react-day-picker", "date-fns"],
              data: ["@tanstack/react-query", "i18next", "react-i18next"],
              auth: ["@auth0/auth0-react"],
            };
            for (const [chunk, packages] of Object.entries(chunks)) {
              if (packages.some((name) => id.includes(`/node_modules/${name}/`))) return chunk;
            }
            return undefined;
          },
        },
      },
    },
  };
});
