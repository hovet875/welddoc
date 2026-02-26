import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@legacy\//, replacement: `${srcDir}/legacy/` },
      { find: /^@react\//, replacement: `${srcDir}/react/` },
      { find: /^@app\//, replacement: `${srcDir}/app/` },
      { find: /^@\//, replacement: `${srcDir}/` },
    ],
  },
});
