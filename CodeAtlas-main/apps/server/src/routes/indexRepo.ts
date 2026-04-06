import { Hono } from "hono";
import { z } from "zod";
import { indexRepository } from "../pipeline/indexRepo";
import { repoRoots } from "../state/repoRoots";

export const indexRepoRoute = new Hono();

// Prevent accidental concurrent indexing runs (frontend double-clicks / refresh loops)
// which can lead to Neo4j deadlocks.
let indexingInProgress = false;

const BodySchema = z.object({
  projectPath: z.string().min(1),
  mode: z.enum(["full", "incremental"]).optional().default("incremental"),
  saveDebugJson: z.boolean().optional().default(true),
  computeHash: z.boolean().optional().default(false),
});

// POST /indexRepo
indexRepoRoute.post("/indexRepo", async (c) => {
  if (indexingInProgress) {
    return c.json(
      { ok: false, error: "Indexing already in progress. Please wait for the current run to finish." },
      409,
    );
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.flatten() }, 400);
  }

  // Normalize project paths coming from the web UI.
  // Browsers sometimes provide file URLs like: file:///C:/Users/... which Node can't use.
  let projectPath = parsed.data.projectPath
    .replace(/^file:\/\/\//i, "")
    .trim();

  // Convert to Windows path only if it looks like a Windows path (has drive letter like C:)
  // Leave Unix paths (starting with /) as-is
  const isWindowsPath = /^[a-zA-Z]:/.test(projectPath);
  if (isWindowsPath) {
    projectPath = projectPath.replace(/\//g, "\\");
  }

  try {
    indexingInProgress = true;

    const result = await indexRepository({
      ...parsed.data,
      projectPath,
    });

    // store repoRoot so /debug/ir can find .codeatlas/debug/<repoId>/ir.json
    repoRoots.set(result.repoId, projectPath);

    return c.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[/indexRepo] error:", err);
    return c.json({ ok: false, error: err?.message || String(err) }, 500);
  } finally {
    indexingInProgress = false;
  }
});
