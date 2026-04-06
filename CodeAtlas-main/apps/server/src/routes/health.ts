import { Hono } from "hono";
import { getNeo4jClient } from "../db/neo4j/client";

export const healthRoute = new Hono();

// GET /health
healthRoute.get("/health", async (c) => {
  const neo4j = getNeo4jClient();
  const neo4jOk = await neo4j.ping().catch(() => false);

  return c.json({
    ok: true,
    neo4j: neo4jOk ? "ok" : "unreachable",
    timestamp: new Date().toISOString(),
  });
});
