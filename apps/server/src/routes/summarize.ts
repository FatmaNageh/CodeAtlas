import { Hono } from "hono";
import { summarizeFiles as summarizeFilesPipeline } from "../pipeline/summarize/summarizeFiles";

export const summarizeFilesRoute = new Hono();

summarizeFilesRoute.post("/summarizeFiles", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const repoId = body.repoId;
  if (!repoId) return c.json({ ok: false, error: "Missing repoId" }, 400);

  try {
    const result = await summarizeFilesPipeline(repoId);
    return c.json({ ok: true, ...result });
  } catch (err: any) {
    return c.json({ ok: false, error: String(err) }, 500);
  }
});
