import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), tanstackRouter({}), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3001,
    proxy: {
          "/graoh": "http://localhost:3000",

      "/trpc": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/indexRepo": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/health": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/debug": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },

      // ✅ add GraphRAG
      "/graphrag": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});