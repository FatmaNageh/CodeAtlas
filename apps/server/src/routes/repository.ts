import { Hono } from "hono";

import {
  deleteRepositoryGraph,
  deleteRepositoryInputSchema,
  validateRepository,
  validateRepositoryInputSchema,
} from "@/services/repository";

export const repositoryRoute = new Hono();

repositoryRoute.post("/repository/validate", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = validateRepositoryInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.flatten() }, 400);
  }

  try {
    const result = await validateRepository(parsed.data);
    return c.json(result, result.ok ? 200 : 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ ok: false, error: message }, 500);
  }
});

repositoryRoute.post("/repository/delete", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = deleteRepositoryInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.flatten() }, 400);
  }

  try {
    const result = await deleteRepositoryGraph(parsed.data);
    return c.json(result, result.ok ? 200 : 404);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return c.json({ ok: false, error: message }, 500);
  }
});
