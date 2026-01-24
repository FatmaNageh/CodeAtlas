import { Hono } from "hono";
import { z } from "zod";
import { indexRepository } from "../pipeline/indexRepo";

export const indexRepoRoute = new Hono();

const BodySchema = z.object({
  projectPath: z.string().min(1),
  mode: z.enum(["full", "incremental"]).optional().default("incremental"),
  saveDebugJson: z.boolean().optional().default(true),
  computeHash: z.boolean().optional().default(false),
});

// POST /indexRepo
indexRepoRoute.post("/indexRepo", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.flatten() }, 400);
  }

  try {
    const result = await indexRepository(parsed.data);
    return c.json({ ok: true, ...result });
  } catch (err: any) {
    console.error("[/indexRepo] error:", err);
    return c.json({ ok: false, error: err?.message || String(err) }, 500);
  }
});
