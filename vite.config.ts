import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "ZodDefaults",
      fileName: (format) =>
        format === "es" ? "zod-defaults.js" : `zod-defaults.${format}.js`,
    },
    rollupOptions: {
      external: ["zod"],
      output: {
        globals: {
          zod: "zod",
        },
      },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
});
