import { Hono } from "hono";
import { getNeo4jClient } from "@/db/neo4j/client";

export const graphRoute = new Hono();

// GET /getGraph all nodes in graph
// @returns records of stuff in db
graphRoute.get("/getGraph", async (c) => {
  const session = getNeo4jClient().session();

  try {
    const result = await session.run(
      `
      MATCH (n)
      RETURN n
      `,
    );

    console.log(`The query returned ${result.records.length} records.`);
    return c.json({ data: result.records });
  } finally {
    await session.close();
  }
});
