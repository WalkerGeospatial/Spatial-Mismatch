import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ["@duckdb/duckdb-wasm"],
  },
  assetsInclude: ["**/*.wasm"],
  server: {
    headers: {
      // Required for DuckDB-WASM SharedArrayBuffer
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
});
