import { Hono } from "hono";
import { embedASTFiles } from "../pipeline/embed/embedASTFiles";

export const embedRoute = new Hono();

// POST /debug/embedASTFiles
embedRoute.post("/embedASTFiles", async (c) => {
  // Parse JSON body safely
  const body: { repoId?: string; projectPath?: string } = await c.req.json().catch(() => ({}));

  const { repoId, projectPath } = body;

  if (!repoId || !projectPath) {
    return c.json(
      { ok: false, error: "Missing repoId or projectPath" },
      400
    );
  }

  console.log(`[EMBED-ROUTE] Embedding AST files for repoId=${repoId}, projectPath=${projectPath}`);

  try {
    const result = await embedASTFiles(repoId, projectPath);
    return c.json({ ok: true, ...result });
  } catch (err: any) {
    console.error(`[EMBED-ROUTE] Error embedding AST files:`, err);
    return c.json({ ok: false, error: String(err) }, 500);
  }
});
