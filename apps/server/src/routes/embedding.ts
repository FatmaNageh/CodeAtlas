import { Hono } from "hono";
import { inspect } from 'util';
import { embedRepository } from "@/services/graphrag";

export const embedRoute = new Hono();

// POST /embedASTFiles
embedRoute.post("/embedASTFiles", async (c) => {
  // Parse JSON body safely
  const body: {
    repoId?: string;
    projectPath?: string;
    batchSize?: number;
    maxFiles?: number;
  } = await c.req.json().catch(() => ({}));

  const { repoId, projectPath, batchSize, maxFiles } = body;

  if (!repoId || !projectPath) {
    return c.json(
      { ok: false, error: "Missing repoId or projectPath" },
      400
    );
  }

  console.log(`[EMBED-ROUTE] Embedding AST files for repoId=${repoId}, projectPath=${projectPath}`);

  try {
    const result = await embedRepository(repoId, projectPath, {
      batchSize,
      maxFiles,
    });
    return c.json({ ...result, ok: true });
  } catch (err: unknown) {
    // Log detailed error to server console for debugging
    console.error(`[EMBED-ROUTE] Error embedding AST files:`, err instanceof Error ? err.stack : inspect(err));
    // Return generic error to client to avoid leaking sensitive information
    return c.json({ ok: false, error: "Internal server error" }, 500);
  }
});
