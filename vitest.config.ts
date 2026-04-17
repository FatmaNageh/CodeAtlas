import { defineConfig } from "vitest/config";
import path from "path";

const serverSrc = path.resolve(__dirname, "apps/server/src");

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    root: path.resolve(__dirname, "apps/server"),
    include: ["src/__tests__/**/*.test.ts"],
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "src/__tests__/fixtures/**",
    ],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      "@": serverSrc,
    },
  },
});
