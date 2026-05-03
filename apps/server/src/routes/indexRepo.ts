import { Hono } from "hono";
import {
  indexRepoInputSchema,
  IndexingInProgressError,
  isIndexingInProgress,
  startIndexing,
} from "@/services/indexing";

export const indexRepoRoute = new Hono();

// POST /indexRepo
indexRepoRoute.post("/indexRepo", async (c) => {
  if (isIndexingInProgress()) {
    return c.json(
      { ok: false, error: "Indexing already in progress. Please wait for the current run to finish." },
      409,
    );
  }

  const body = await c.req.json().catch(() => ({}));
  const parsed = indexRepoInputSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ ok: false, error: parsed.error.flatten() }, 400);
  }

  try {
    const result = await startIndexing(parsed.data);
    return c.json({ ok: true, ...result });
  } catch (err: unknown) {
    if (err instanceof IndexingInProgressError) {
      return c.json({ ok: false, error: err.message }, 409);
    }

    const message = err instanceof Error ? err.message : String(err);
    console.error("[/indexRepo] error:", err);
    return c.json({ ok: false, error: message }, 500);
  }
});
