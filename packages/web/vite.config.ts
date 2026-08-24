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
          // Rolldown (Vite 8) replaces manualChunks with codeSplitting groups. Matched by path for
          // the same reason the old function matched by path: an entry-module match would leave
          // react-dom's real code (`react-dom/client`) in the app chunk, re-downloaded per deploy.
          codeSplitting: {
            groups: [
              { name: "react", test: /node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\// },
              { name: "baseui", test: /node_modules\/@base-ui\// },
              { name: "calendar", test: /node_modules\/(react-day-picker|date-fns)\// },
              { name: "data", test: /node_modules\/(@tanstack|i18next|react-i18next)\// },
              { name: "auth", test: /node_modules\/@auth0\// },
            ],
          },
        },
      },
    },
  };
});
