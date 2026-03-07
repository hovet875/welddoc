import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig(() => ({
  base: "/",
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
