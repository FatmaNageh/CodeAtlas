import { Hono } from "hono";
import { getNeo4jClient } from "@/db/neo4j/client";
import { toPlain } from "@/db/neo4j/value";

export const graphRoute = new Hono();

// GET /getGraph all nodes in graph
// @returns records of stuff in db
graphRoute.get("/getGraph", async (c) => {
  const session = getNeo4jClient().session();

  try {
    const result = await session.executeRead((tx) =>
      tx.run(
        `
        MATCH (n)
        RETURN n
        `,
      ),
    );

    const convertedRecords = result.records.map((record) =>
      toPlain(record.toObject()),
    );

    console.log(`The query returned ${convertedRecords.length} records.`);
    return c.json({ data: convertedRecords });
  } finally {
    await session.close();
  }
});
