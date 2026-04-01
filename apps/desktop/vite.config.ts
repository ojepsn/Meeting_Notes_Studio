import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  envPrefix: ["VITE_", "TAURI_"],
  resolve: {
    extensions: [".ts", ".tsx", ".mjs", ".js", ".jsx", ".json"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/mammoth")) {
            return "mammoth";
          }
          if (id.includes("node_modules/jszip")) {
            return "docx-zip";
          }
          if (
            id.includes("node_modules/xmlbuilder") ||
            id.includes("node_modules/@xmldom") ||
            id.includes("node_modules/underscore")
          ) {
            return "docx-xml";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    port: 1420,
    strictPort: true,
  },
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts"],
  },
});
