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
}));
