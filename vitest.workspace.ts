import { defineWorkspace } from "vitest/config";
import path from "path";

const serverRoot = path.resolve(__dirname, "apps/server");

export default defineWorkspace([
  {
    test: {
      name: "server",
      root: serverRoot,
      globals: true,
      environment: "node",
      include: [`${serverRoot}/src/__tests__/**/*.test.ts`],
      exclude: [
        `${serverRoot}/node_modules/**`,
        `${serverRoot}/dist/**`,
        `${serverRoot}/src/__tests__/fixtures/**`,
      ],
      testTimeout: 30000,
      hookTimeout: 30000,
    },
    resolve: {
      alias: {
        "@": path.resolve(serverRoot, "src"),
      },
    },
  },
]);
