import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./", // IMPORTANT for webview
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});