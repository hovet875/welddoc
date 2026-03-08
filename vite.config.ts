import { readFileSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));
const packageJsonPath = fileURLToPath(new URL("./package.json", import.meta.url));
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as { version?: string };
const appVersion = packageJson.version ?? "0.0.0";

export default defineConfig(() => ({
  base: "/",
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      manifest: false,
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: [
      { find: /^@react\//, replacement: `${srcDir}/react/` },
      { find: /^@\//, replacement: `${srcDir}/` },
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;

          if (id.includes("@mantine/charts") || id.includes("recharts")) {
            return "vendor-charts";
          }
          if (id.includes("@mantine")) {
            return "vendor-mantine";
          }
          if (id.includes("react-router")) {
            return "vendor-router";
          }
          if (id.includes("react-dom") || id.includes("/react/")) {
            return "vendor-react";
          }
          if (id.includes("@supabase")) {
            return "vendor-supabase";
          }
          if (id.includes("pdf-lib")) {
            return "vendor-pdf";
          }

          return undefined;
        },
      },
    },
  },
}));
