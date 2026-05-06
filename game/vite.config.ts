import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  base: "/play/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@game": path.resolve(__dirname, "src/game"),
      "@net": path.resolve(__dirname, "src/net"),
      "@state": path.resolve(__dirname, "src/state"),
      "@ui": path.resolve(__dirname, "src/game/ui"),
    },
  },
  build: {
    outDir: "dist",
    target: "es2022",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          babylon: [
            "@babylonjs/core",
            "@babylonjs/gui",
            "@babylonjs/loaders",
            "@babylonjs/materials",
            "@babylonjs/post-processes",
          ],
          react: ["react", "react-dom"],
        },
      },
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
