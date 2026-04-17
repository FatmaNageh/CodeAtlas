import "dotenv/config";
import { trpcServer } from "@hono/trpc-server";
import { createContext } from "@CodeAtlas/api/context";
import { appRouter } from "@CodeAtlas/api/routers/index";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serve } from "@hono/node-server";

import { healthRoute } from "./routes/health";
import { indexRepoRoute } from "./routes/indexRepo";
import { diagnosticsRoute } from "./routes/diagnostics";
import { debugRoute } from "./routes/debug";
import { repositoryRoute } from "./routes/repository";
// import { summarizeFilesRoute } from "./routes/summarize";
import { embedRoute } from "./routes/embedding";
import { graphragRoute } from "./routes/graphrag";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);

app.get("/", (c) =>
  c.json({
    ok: true,
    service: "CodeAtlas server",
    routes: [
      "/health",
      "POST /indexRepo",
      "POST /repository/validate",
      "POST /repository/delete",
      "GET /tester",
      "GET /diagnostics/repos",
      "GET /diagnostics/check?repoId=...",
      "POST /graphrag/embedRepo",
      "POST /graphrag/summarize",
      "POST /graphrag/ask",
      "GET /graphrag/tour",
      "GET /graphrag/context?repoId=...&filePath=...",
      "GET /graphrag/status?repoId=...",
      "/trpc/*",
    ],
  }),
);

// Keep tRPC mounting (doesn't interfere with backend-only testing)
app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => createContext({ context }),
  }),
);

// Phase 1 routes
app.route("/", healthRoute);
app.route("/", indexRepoRoute);
app.route("/", repositoryRoute);
app.route("/", diagnosticsRoute);
app.route("/", debugRoute);

//testing routes
// app.route("/", summarizeFilesRoute);
app.route("/debug", embedRoute);

// GraphRAG routes
app.route("/graphrag", graphragRoute);

serve(
  { fetch: app.fetch, port: Number(process.env.PORT || 3000) },
  (info) => console.log(`Server is running on http://localhost:${info.port}`),
);
